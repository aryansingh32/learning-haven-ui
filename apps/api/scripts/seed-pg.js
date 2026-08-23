/**
 * seed-pg.js
 *
 * NOTE: The previous version of this script was used exclusively to seed a
 * hardcoded bypass user (UUID: 12345678-1234-1234-1234-123456789012) that
 * paired with a now-deleted generate-token script. That bypass mechanism has
 * been removed (see requireAdmin.ts).
 *
 * If you need to seed a real admin user, create them via Supabase Auth
 * (supabase.auth.admin.createUser) and then update their role in
 * public.users via Supabase dashboard or a proper migration.
 *
 * This script intentionally does nothing now to avoid re-introducing the
 * bypass UUID pattern.
 */

console.log('seed-pg: bypass seeding removed. Use Supabase Auth to create admin users.');
