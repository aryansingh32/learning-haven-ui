import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const backendUrl = process.env.API_URL || 'http://localhost:5000';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase URL or Service Key in env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function run() {
  console.log('🚀 Build Haven GitHub Webhook Simulator starting...\n');

  // 1. Fetch active build enrollments
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('build_enrollments')
    .select(`
      id,
      user_id,
      program_id,
      language,
      current_stage,
      repo_full_name,
      webhook_secret,
      status,
      apprenticeship_programs (
        title,
        slug
      )
    `)
    .order('updated_at', { ascending: false });

  if (enrollmentsError) {
    console.error('❌ Failed to fetch build enrollments:', enrollmentsError.message);
    process.exit(1);
  }

  if (!enrollments || enrollments.length === 0) {
    console.log('⚠️ No build enrollments found in database.');
    console.log('💡 Tip: Go to the frontend and start a build challenge track first, then run this script.');
    process.exit(0);
  }

  // Get argument from command line or pick the latest one
  const targetIdOrSlug = process.argv[2];
  let targetEnrollment = enrollments[0];

  if (targetIdOrSlug) {
    const found = enrollments.find(e => 
      e.id === targetIdOrSlug || 
      e.repo_full_name?.includes(targetIdOrSlug) ||
      (e.apprenticeship_programs as any)?.slug === targetIdOrSlug
    );
    if (!found) {
      console.error(`❌ Could not find enrollment matching "${targetIdOrSlug}".`);
      console.log('Available enrollments:');
      enrollments.forEach(e => {
        console.log(`- ID: ${e.id} | Challenge: ${(e.apprenticeship_programs as any)?.title} | Repo: ${e.repo_full_name}`);
      });
      process.exit(1);
    }
    targetEnrollment = found;
  }

  const { id, repo_full_name, webhook_secret, current_stage, language } = targetEnrollment;
  const challengeTitle = (targetEnrollment.apprenticeship_programs as any)?.title || 'Unknown';
  const commitHash = crypto.randomBytes(20).toString('hex'); // Mock commit SHA

  console.log('--------------------------------------------------');
  console.log(`📦 Challenge   : ${challengeTitle}`);
  console.log(`🔑 Enrollment  : ${id}`);
  console.log(`💻 Language    : ${language}`);
  console.log(`📚 Current Stage: ${current_stage}`);
  console.log(`🐙 Repository   : ${repo_full_name}`);
  console.log(`🔗 Webhook Sec  : ${webhook_secret ? '✅ Loaded' : '❌ NOT SET'}`);
  console.log(`📌 Simulated SHA: ${commitHash}`);
  console.log('--------------------------------------------------\n');

  if (!repo_full_name) {
    console.error('❌ Enrollment has no repository full name.');
    process.exit(1);
  }

  if (!webhook_secret) {
    console.error('❌ Enrollment has no webhook secret configured. Cannot compute signature.');
    process.exit(1);
  }

  // 2. Build mock GitHub push payload
  const payload = {
    ref: 'refs/heads/main',
    after: commitHash,
    before: crypto.randomBytes(20).toString('hex'),
    created: false,
    deleted: false,
    forced: false,
    compare: `https://github.com/${repo_full_name}/compare/...`,
    commits: [
      {
        id: commitHash,
        tree_id: crypto.randomBytes(20).toString('hex'),
        distinct: true,
        message: `Simulated push for stage ${current_stage} verification`,
        timestamp: new Date().toISOString(),
        url: `https://github.com/${repo_full_name}/commit/${commitHash}`,
        author: {
          name: 'Learning Haven Builder',
          email: 'builder@learninghaven.dev',
          username: 'builder'
        },
        committer: {
          name: 'Learning Haven Builder',
          email: 'builder@learninghaven.dev',
          username: 'builder'
        },
        added: ['src/main.py'],
        removed: [],
        modified: []
      }
    ],
    head_commit: {
      id: commitHash,
      message: `Simulated push for stage ${current_stage} verification`,
      timestamp: new Date().toISOString(),
      author: {
        name: 'Learning Haven Builder',
        username: 'builder'
      }
    },
    repository: {
      id: 123456789,
      name: repo_full_name.split('/')[1] || 'challenge-repo',
      full_name: repo_full_name,
      private: true,
      owner: {
        name: repo_full_name.split('/')[0] || 'learning-haven',
        email: 'org@learninghaven.dev'
      },
      html_url: `https://github.com/${repo_full_name}`,
      description: `Starter repository for ${challengeTitle}`
    },
    pusher: {
      name: 'builder',
      email: 'builder@learninghaven.dev'
    }
  };

  const rawPayload = Buffer.from(JSON.stringify(payload));

  // 3. Compute x-hub-signature-256 using HMAC-SHA256 and the webhook_secret
  const signature = `sha256=${crypto
    .createHmac('sha256', webhook_secret)
    .update(rawPayload)
    .digest('hex')}`;

  console.log(`🔒 Calculated Webhook Signature: ${signature}`);
  console.log(`📡 Sending mock webhook request to ${backendUrl}/api/v1/build/webhooks/github ...`);

  try {
    const response = await axios.post(`${backendUrl}/api/v1/build/webhooks/github`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': signature,
      },
    });

    console.log('\n🟢 Response Status:', response.status);
    console.log('🟢 Response Body:', JSON.stringify(response.data, null, 2));
    console.log('\n✅ Successfully triggered the auto-verification pipeline!');
    console.log('📊 Check the frontend workspace or admin panel to see the progress update.');
    console.log('💡 Note: You must have the BullMQ worker running (`npm run dev` in backend) and Redis running to process the queued job.');
  } catch (error: any) {
    console.error('\n🔴 Request Failed!');
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data  :', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error Message  :', error.message);
    }
    process.exit(1);
  }
}

run().catch(console.error);
