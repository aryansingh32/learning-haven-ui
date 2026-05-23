import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { supabase } from '../../config/database';
import logger from '../../config/logger';
import { fail, ok } from './http';

async function requireEnrollment(userId: string, programId: string) {
  const { data, error } = await supabase
    .from('apprenticeship_enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .in('status', ['active', 'completed'])
    .maybeSingle();

  if (error) throw error;
  return data;
}

export class CommunityController {
  static async listPosts(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const programId = String(req.params.programId || '');
      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';
      const page = Number(req.query.page || 1);
      const limit = Math.min(20, Number(req.query.limit || 20));

      const enrollment = await requireEnrollment(userId, programId);
      if (!enrollment) {
        return res.status(403).json(fail('Enrollment required', 'E_COMMUNITY_403'));
      }

      let query = supabase
        .from('apprenticeship_posts')
        .select(`
          *,
          users:user_id (id, full_name),
          apprenticeship_projects:project_id (id, title)
        `)
        .eq('program_id', programId)
        .eq('is_deleted', false)
        .range((page - 1) * limit, (page * limit) - 1);

      if (projectId) query = query.eq('project_id', projectId);
      query = sort === 'popular'
        ? query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
        : query.order('created_at', { ascending: false });

      const { data: posts, error } = await query;
      if (error) throw error;

      const postIds = (posts || []).map((post: any) => post.id);
      const [upvotesResult, repliesResult] = await Promise.all([
        postIds.length
          ? supabase
              .from('apprenticeship_post_upvotes')
              .select('post_id')
              .eq('user_id', userId)
              .in('post_id', postIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        postIds.length
          ? supabase
              .from('apprenticeship_post_replies')
              .select(`
                *,
                users:user_id (id, full_name)
              `)
              .in('post_id', postIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (upvotesResult.error) throw upvotesResult.error;
      if (repliesResult.error) throw repliesResult.error;

      const upvoted = new Set((upvotesResult.data || []).map((row: any) => row.post_id));
      const repliesByPost = new Map<string, any[]>();
      for (const reply of repliesResult.data || []) {
        const current = repliesByPost.get(reply.post_id) || [];
        current.push({
          id: reply.id,
          content: reply.content,
          created_at: reply.created_at,
          upvotes: reply.upvotes || 0,
          user: {
            id: reply.users?.id,
            name: reply.users?.full_name || 'Student',
          },
        });
        repliesByPost.set(reply.post_id, current);
      }

      res.json(ok({
        posts: (posts || []).map((post: any) => ({
          id: post.id,
          content: post.content,
          upvotes: post.upvotes || 0,
          replies_count: post.replies_count || 0,
          created_at: post.created_at,
          project_id: post.project_id,
          project: post.apprenticeship_projects
            ? { id: post.apprenticeship_projects.id, title: post.apprenticeship_projects.title }
            : null,
          user: {
            id: post.users?.id,
            name: post.users?.full_name || 'Student',
            avatar_url: null,
          },
          is_upvoted_by_you: upvoted.has(post.id),
          replies: repliesByPost.get(post.id) || [],
        })),
        page,
        limit,
      }));
    } catch (error) {
      logger.error('Error listing community posts:', error);
      res.status(500).json(fail('Failed to load community posts', 'E_COMMUNITY_500'));
    }
  }

  static async createPost(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const programId = String(req.params.programId || '');
      const { content, projectId } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json(fail('Post content is required', 'E_COMMUNITY_400'));
      }

      const enrollment = await requireEnrollment(userId, programId);
      if (!enrollment) {
        return res.status(403).json(fail('Enrollment required', 'E_COMMUNITY_403'));
      }

      const { data, error } = await supabase
        .from('apprenticeship_posts')
        .insert({
          program_id: programId,
          project_id: projectId || null,
          user_id: userId,
          content: content.trim(),
        })
        .select(`
          *,
          users:user_id (id, full_name),
          apprenticeship_projects:project_id (id, title)
        `)
        .single();

      if (error) throw error;

      res.status(201).json(ok({
        post: {
          id: data.id,
          content: data.content,
          upvotes: data.upvotes || 0,
          replies_count: data.replies_count || 0,
          created_at: data.created_at,
          project_id: data.project_id,
          project: data.apprenticeship_projects
            ? { id: data.apprenticeship_projects.id, title: data.apprenticeship_projects.title }
            : null,
          user: {
            id: data.users?.id,
            name: data.users?.full_name || 'Student',
            avatar_url: null,
          },
          is_upvoted_by_you: false,
          replies: [],
        },
      }));
    } catch (error) {
      logger.error('Error creating community post:', error);
      res.status(500).json(fail('Failed to create post', 'E_COMMUNITY_501'));
    }
  }

  static async toggleUpvote(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { postId } = req.params;

      const { data: post, error: postError } = await supabase
        .from('apprenticeship_posts')
        .select('id, upvotes')
        .eq('id', postId)
        .maybeSingle();

      if (postError) throw postError;
      if (!post) {
        return res.status(404).json(fail('Post not found', 'E_COMMUNITY_404'));
      }

      const { data: existing } = await supabase
        .from('apprenticeship_post_upvotes')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

      let upvoted = false;
      if (existing) {
        const { error } = await supabase
          .from('apprenticeship_post_upvotes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
        if (error) throw error;

        await supabase
          .from('apprenticeship_posts')
          .update({ upvotes: Math.max(0, (post.upvotes || 0) - 1) })
          .eq('id', postId);
      } else {
        const { error } = await supabase
          .from('apprenticeship_post_upvotes')
          .insert({ post_id: postId, user_id: userId });
        if (error) throw error;

        await supabase
          .from('apprenticeship_posts')
          .update({ upvotes: (post.upvotes || 0) + 1 })
          .eq('id', postId);
        upvoted = true;
      }

      const { data: updated } = await supabase
        .from('apprenticeship_posts')
        .select('upvotes')
        .eq('id', postId)
        .single();

      res.json(ok({
        upvoted,
        upvotes: updated?.upvotes || 0,
      }));
    } catch (error) {
      logger.error('Error toggling community upvote:', error);
      res.status(500).json(fail('Failed to update upvote', 'E_COMMUNITY_502'));
    }
  }

  static async createReply(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { postId } = req.params;
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json(fail('Reply content is required', 'E_COMMUNITY_400'));
      }

      const { data: post, error: postError } = await supabase
        .from('apprenticeship_posts')
        .select('id, program_id, replies_count')
        .eq('id', postId)
        .maybeSingle();

      if (postError) throw postError;
      if (!post) {
        return res.status(404).json(fail('Post not found', 'E_COMMUNITY_404'));
      }

      const enrollment = await requireEnrollment(userId, post.program_id);
      if (!enrollment) {
        return res.status(403).json(fail('Enrollment required', 'E_COMMUNITY_403'));
      }

      const { data, error } = await supabase
        .from('apprenticeship_post_replies')
        .insert({
          post_id: postId,
          user_id: userId,
          content: content.trim(),
        })
        .select(`
          *,
          users:user_id (id, full_name)
        `)
        .single();

      if (error) throw error;

      await supabase
        .from('apprenticeship_posts')
        .update({ replies_count: (post.replies_count || 0) + 1 })
        .eq('id', postId);

      res.status(201).json(ok({
        reply: {
          id: data.id,
          content: data.content,
          created_at: data.created_at,
          upvotes: data.upvotes || 0,
          user: {
            id: data.users?.id,
            name: data.users?.full_name || 'Student',
          },
        },
      }));
    } catch (error) {
      logger.error('Error creating community reply:', error);
      res.status(500).json(fail('Failed to create reply', 'E_COMMUNITY_503'));
    }
  }
}
