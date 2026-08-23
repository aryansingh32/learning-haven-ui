/**
 * upsert-user.js
 *
 * NOTE: The previous version of this script was used exclusively to upsert a
 * hardcoded bypass user (UUID: 12345678-1234-1234-1234-123456789012) that
 * paired with a now-deleted generate-token script. That bypass mechanism has
 * been removed (see requireAdmin.ts).
 *
 * If you need to create or promote a real admin user:
 *   1. Create the user via Supabase Auth admin API.
 *   2. Update their role in public.users:
 *      UPDATE public.users SET role = 'admin' WHERE email = 'your@email.com';
 */

console.log('upsert-user: bypass seeding removed. Use Supabase Auth + SQL to manage admin users.');
