import { Octokit } from '@octokit/rest';
import crypto from 'crypto';
import { supabase as supabaseAdmin } from '../../config/database';
import redis from '../../config/redis';
import logger from '../../config/logger';
import { validateGitHubReturnPath } from '../../utils/githubRedirect';
import { env } from '../../config/env';
import { circuitBreakers } from '../../reliability/circuitBreaker';

const CLIENT_ID = env.GITHUB_CLIENT_ID || '';
const CLIENT_SECRET = env.GITHUB_CLIENT_SECRET || '';
const ENCRYPTION_KEY = env.GITHUB_TOKEN_ENCRYPTION_KEY;
const WEBHOOK_BASE_URL = env.WEBHOOK_BASE_URL;

/** Parse https://github.com/owner/repo(.git) or owner/repo into API-ready names. */
export function parseGitHubRepoRef(input: string): { owner: string; repo: string } {
  const raw = String(input || '').trim();
  if (!raw) {
    throw new Error('Starter repository URL is required');
  }

  let owner: string;
  let repo: string;

  if (/^[\w.-]+\/[\w.-]+$/i.test(raw)) {
    [owner, repo] = raw.split('/');
  } else {
    let pathname: string;
    try {
      pathname = new URL(raw.includes('://') ? raw : `https://${raw}`).pathname;
    } catch {
      throw new Error(`Invalid starter repository URL: ${raw}`);
    }
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Invalid starter repository URL (expected owner/repo): ${raw}`);
    }
    owner = parts[0];
    repo = parts[1];
  }

  repo = repo.replace(/\.git$/i, '');
  if (!owner || !repo) {
    throw new Error(`Invalid starter repository URL: ${raw}`);
  }

  return { owner, repo };
}

/** GitHub repo names: alphanumeric, hyphens, underscores; max 100 chars. */
export function slugifyGitHubRepoSegment(value: string, maxLen = 60): string {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (slug || 'repo').slice(0, maxLen);
}

const OAUTH_RETURN_TTL_SEC = 600;

export class GitHubService {
  static async generateOAuthUrl(userId: string, returnTo?: string) {
    const stateNonce = crypto.randomBytes(16).toString('hex');
    const state = `${stateNonce}__${userId}`;
    const url = new URL('https://github.com/login/oauth/authorize');

    url.searchParams.append('client_id', CLIENT_ID);
    url.searchParams.append('state', state);
    url.searchParams.append('scope', 'repo admin:repo_hook');
    const callbackUrl = env.GITHUB_OAUTH_CALLBACK_URL?.trim();
    if (callbackUrl) {
      url.searchParams.append('redirect_uri', callbackUrl.replace(/\/$/, ''));
    }

    const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
    const safeReturn = validateGitHubReturnPath(returnTo, frontendUrl);
    if (returnTo && !safeReturn) {
      logger.warn('GitHub OAuth: ignored invalid return_to', { userId, returnTo });
    }
    if (safeReturn) {
      await redis.setex(`github_oauth_return:${stateNonce}`, OAUTH_RETURN_TTL_SEC, safeReturn);
    }

    return url.toString();
  }

  static async consumeOAuthReturnPath(state: string): Promise<string | null> {
    const [stateNonce] = state.split('__');
    if (!stateNonce) return null;
    const key = `github_oauth_return:${stateNonce}`;
    const path = await redis.get(key);
    if (path) {
      await redis.del(key);
    }
    return path;
  }

  static async handleOAuthCallback(code: string, state: string) {
    const [, userId] = state.split('__');
    if (!userId) {
      throw new Error('Invalid state token');
    }

    const response = await circuitBreakers.github.execute(() =>
      fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
        }),
        signal: AbortSignal.timeout(10_000),
      })
    );

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    const accessToken = data.access_token;
    const octokit = new Octokit({ auth: accessToken });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    const encryptedToken = this.encryptToken(accessToken);

    const { error } = await supabaseAdmin
      .from('apprenticeship_github_connections')
      .upsert({
        user_id: userId,
        github_username: user.login,
        github_user_id: user.id,
        access_token: encryptedToken,
        token_scopes: ['repo', 'admin:repo_hook'],
        connected_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        is_active: true,
        revoked_at: null,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      logger.error('handleOAuthCallback error:', error);
      throw error;
    }

    return { success: true, username: user.login };
  }

  static async provisionRepository(
    userId: string,
    programSlug: string,
    projectSlug: string,
    templateRepoUrl: string
  ) {
    const { data: connection, error } = await supabaseAdmin
      .from('apprenticeship_github_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !connection) {
      throw new Error('User has no active GitHub connection');
    }

    const token = this.decryptToken(connection.access_token);
    const octokit = new Octokit({ auth: token });
    const { owner: templateOwner, repo: templateRepo } = parseGitHubRepoRef(templateRepoUrl);
    const newRepoName = slugifyGitHubRepoSegment(
      `lh-${slugifyGitHubRepoSegment(programSlug, 35)}-${slugifyGitHubRepoSegment(projectSlug, 25)}-${connection.github_username}`,
      100
    );
    const webhookSecret = crypto.randomBytes(24).toString('hex');

    try {
      let templateMeta: { is_template?: boolean };
      try {
        const { data } = await octokit.rest.repos.get({
          owner: templateOwner,
          repo: templateRepo,
        });
        templateMeta = data;
      } catch (lookupError: any) {
        if (lookupError?.status === 404) {
          throw new Error(
            `Template repository ${templateOwner}/${templateRepo} was not found. ` +
              'Check the starter repo URL in the admin panel and ensure your GitHub account can access it.'
          );
        }
        throw lookupError;
      }

      if (!templateMeta.is_template) {
        throw new Error(
          `Repository ${templateOwner}/${templateRepo} is not a GitHub template. ` +
            'Open the repo on GitHub → Settings → check "Template repository", then try again.'
        );
      }

      const { data: repo } = await octokit.rest.repos.createUsingTemplate({
        template_owner: templateOwner,
        template_repo: templateRepo,
        owner: connection.github_username,
        name: newRepoName,
        private: true,
        description: `Learning Haven apprenticeship project ${projectSlug}`,
      });

      await octokit.rest.repos.createWebhook({
        owner: repo.owner.login,
        repo: repo.name,
        name: 'web',
        events: ['push'],
        config: {
          url: `${WEBHOOK_BASE_URL}/api/v1/build/webhooks/github`,
          content_type: 'json',
          secret: webhookSecret,
          insecure_ssl: '0',
        },
      });

      await supabaseAdmin
        .from('apprenticeship_github_connections')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', connection.id);

      return {
        clone_url: repo.clone_url,
        html_url: repo.html_url,
        repo_name: `${repo.owner.login}/${repo.name}`,
        webhook_secret: webhookSecret,
      };
    } catch (provisionError: any) {
      if (provisionError?.status === 403 && String(provisionError?.message || '').includes('rate limit')) {
        logger.error('GitHub API rate limit hit during provisioning', { userId });
        throw new Error('GitHub API rate limit exceeded. Please wait a few minutes before trying again.');
      }

      if (provisionError?.status === 422 || String(provisionError?.message || '').includes('already exists')) {
        logger.info('Repository might already exist, attempting to reuse', { owner: connection.github_username, name: newRepoName });
        try {
          const { data: repo } = await octokit.rest.repos.get({
            owner: connection.github_username,
            repo: newRepoName,
          });

          // Check if webhook already exists, if not, create one
          const { data: hooks } = await octokit.rest.repos.listWebhooks({
            owner: repo.owner.login,
            repo: repo.name,
          });

          const targetUrl = `${WEBHOOK_BASE_URL}/api/v1/build/webhooks/github`;
          const existingHook = hooks.find(h => h.config.url === targetUrl);

          if (!existingHook) {
            await octokit.rest.repos.createWebhook({
              owner: repo.owner.login,
              repo: repo.name,
              name: 'web',
              events: ['push'],
              config: {
                url: targetUrl,
                content_type: 'json',
                secret: webhookSecret,
                insecure_ssl: '0',
              },
            });
          }

          await supabaseAdmin
            .from('apprenticeship_github_connections')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', connection.id);

          return {
            clone_url: repo.clone_url,
            html_url: repo.html_url,
            repo_name: `${repo.owner.login}/${repo.name}`,
            webhook_secret: existingHook?.config.secret || webhookSecret,
          };
        } catch (reuseError: any) {
          if (reuseError?.status === 404) {
            // The repository didn't actually exist! 
            // So the 422 error from createUsingTemplate was for another reason.
            logger.error('createUsingTemplate failed with 422:', provisionError.response?.data || provisionError.message);
            const githubMsg = provisionError.response?.data?.message || provisionError.message;
            throw new Error(`Failed to create repository from template: ${githubMsg}`);
          }
          logger.error('Failed to reuse existing repository:', reuseError);
          throw reuseError;
        }
      }

      if (provisionError?.status === 404) {
        logger.error('provisionRepository template generate 404:', {
          templateOwner,
          templateRepo,
          newRepoName,
        });
        throw new Error(
          `Could not create repo from template ${templateOwner}/${templateRepo}. ` +
            'Confirm the repository exists, is marked as a template, and your GitHub token has repo access.'
        );
      }

      logger.error('provisionRepository error:', provisionError);
      throw provisionError;
    }
  }

  private static encryptToken(token: string) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  static decryptToken(value: string) {
    const [ivHex, encrypted] = value.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static async getUserToken(userId: string): Promise<string | null> {
    const { data: connection } = await supabaseAdmin
      .from('apprenticeship_github_connections')
      .select('access_token')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!connection?.access_token) return null;
    return this.decryptToken(connection.access_token);
  }
}
