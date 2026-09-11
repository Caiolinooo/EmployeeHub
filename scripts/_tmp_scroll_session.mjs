// TEMP (verification only): mint a real session for an active ADMIN user via
// service-role generateLink + verifyOtp, so Playwright can test authenticated pages.
// Does NOT modify any user or password. Deleted after use.
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error('missing supabase env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// 1) find an active ADMIN in users_unified with an email
const { data: admins, error: admErr } = await admin
  .from('users_unified')
  .select('id, email, role, active, first_name, last_name, phone_number')
  .eq('role', 'ADMIN')
  .eq('active', true)
  .not('email', 'is', null)
  .limit(10);
if (admErr) { console.error('users_unified error', admErr.message); process.exit(1); }
if (!admins?.length) { console.error('no active ADMIN found'); process.exit(1); }

// 2) profile lookup keys on users_unified.id === auth.users.id — join by id
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
let target = null;
for (const a of admins) {
  const authUser = list?.users?.find((u) => u.id === a.id);
  if (authUser) { target = { profile: a, authUser }; break; }
}
if (!target) { console.error('no admin with users_unified.id === auth.users.id'); process.exit(1); }

// 3) mint a session without touching the password
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: target.authUser.email,
});
if (linkErr) { console.error('generateLink error', linkErr.message); process.exit(1); }

const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: 'email',
});
if (verifyErr) { console.error('verifyOtp error', verifyErr.message); process.exit(1); }

// Custom app JWT (same shape as generateToken in src/lib/auth.ts)
const customToken = jwt.sign(
  { userId: target.profile.id, phoneNumber: target.profile.phone_number || '', role: target.profile.role },
  process.env.JWT_SECRET,
  { expiresIn: '1d' }
);

const out = {
  session: verifyData.session,
  profile: target.profile,
  email: target.authUser.email,
  customToken,
};
fs.writeFileSync(path.resolve(process.cwd(), 'scripts/_tmp_scroll_session.json'), JSON.stringify(out, null, 2));
console.log('OK session minted for', target.authUser.email, 'role', target.profile.role);
