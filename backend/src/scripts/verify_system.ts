
import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid'; // Need to mock UUID or use string
// Note: verify_system.ts usually doesn't have uuid installed, but I can use crypto.randomUUID if node 19+ or just a fixed string if valid uuid.
// backend likely has uuid package or not? package.json doesn't show it.
// I'll use crypto.randomUUID() (Node 15.6+)
import { randomUUID } from 'crypto';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET!;
const DATABASE_URL = process.env.DATABASE_URL!;
const API_URL = 'http://127.0.0.1:5000/api';

if (!JWT_SECRET || !DATABASE_URL) {
    console.error('Missing credentials in .env');
    process.exit(1);
}

const TEST_ID = randomUUID();
const ADMIN_ID = randomUUID();
const timestamp = Math.floor(Date.now() / 1000);

// Forge Tokens
const userToken = jwt.sign({
    sub: TEST_ID,
    email: `verifier_local_${timestamp}@dsaos.app`,
    role: 'authenticated',
    aud: 'authenticated',
    exp: timestamp + 3600
}, JWT_SECRET);

const adminToken = jwt.sign({
    sub: ADMIN_ID,
    email: `admin_local_${timestamp}@dsaos.app`,
    role: 'authenticated',
    aud: 'authenticated',
    exp: timestamp + 3600
}, JWT_SECRET);

// Insert Users via PSQL
function seedUsers() {
    try {
        console.log('Seeding fake users into public.users via PSQL...');
        const userSql = `INSERT INTO public.users (id, email, full_name, role) VALUES ('${TEST_ID}', 'verifier_local_${timestamp}@dsaos.app', 'Test Verifier Local', 'user') ON CONFLICT (id) DO NOTHING;`;
        const adminSql = `INSERT INTO public.users (id, email, full_name, role) VALUES ('${ADMIN_ID}', 'admin_local_${timestamp}@dsaos.app', 'Admin Verifier Local', 'admin') ON CONFLICT (id) DO NOTHING;`;

        execSync(`psql "${DATABASE_URL}" -c "${userSql}"`);
        execSync(`psql "${DATABASE_URL}" -c "${adminSql}"`);
        console.log('Seeding successful.');
    } catch (e: any) {
        console.error('Seeding failed:', e.message);
        // Continue anyway, maybe they exist?
    }
}

const ENDPOINTS = [
    // Phase 1
    // Phase 2
    { method: 'GET', url: '/problems', role: 'public' },
    { method: 'GET', url: '/users/me', role: 'user' },
    { method: 'GET', url: '/users/me/stats', role: 'user' },
    { method: 'GET', url: '/users/me/progress', role: 'user' },
    { method: 'GET', url: '/leaderboard', role: 'public' },
    // Phase 3
    { method: 'GET', url: '/subscriptions/plans', role: 'user' },
    { method: 'GET', url: '/subscriptions/current', role: 'user' },
    // Phase 4
    { method: 'GET', url: '/referrals/info', role: 'user' },
    { method: 'GET', url: '/referrals/leaderboard', role: 'public' },
    // Phase 5 Admin
    { method: 'GET', url: '/admin/users', role: 'admin' },
    { method: 'GET', url: '/admin/dashboard', role: 'admin' },
    { method: 'GET', url: '/admin/logs', role: 'admin' },
    // Phase 6 Analytics
    { method: 'GET', url: '/users/analytics/activity', role: 'user' },
    { method: 'GET', url: '/users/analytics/radar', role: 'user' },
    { method: 'GET', url: '/users/analytics/weekly', role: 'user' },
    { method: 'POST', url: '/users/study-time', role: 'user', body: { seconds: 120 } },
];

async function run() {
    seedUsers();

    console.log('# Endpoint Verification Report\n');
    console.log('| Section | Endpoint | Method | Role | Status | Result |');
    console.log('|---|---|---|---|---|---|');

    for (const ep of ENDPOINTS) {
        const token = ep.role === 'admin' ? adminToken : (ep.role === 'user' ? userToken : undefined);
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const res = await fetch(`${API_URL}${ep.url}`, {
                method: ep.method,
                headers,
                body: ep.body ? JSON.stringify(ep.body) : undefined
            });

            const status = res.status;
            const ok = status >= 200 && status < 300;
            const icon = ok ? '✅' : (status === 404 ? '❌ (404)' : `⚠️ (${status})`);

            console.log(`| ${ep.role.toUpperCase()} | \`${ep.url}\` | ${ep.method} | ${ep.role} | ${status} | ${icon} |`);
        } catch (err) {
            console.log(`| ${ep.role.toUpperCase()} | \`${ep.url}\` | ${ep.method} | ${ep.role} | ERR | ❌ (Conn Refused) |`);
        }
    }
}

run();
