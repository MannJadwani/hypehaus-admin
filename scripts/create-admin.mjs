// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE=... node scripts/create-admin.mjs \
//     --email hypehaus21@gmail.com --password Aditya@21 [--role admin]

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

function getArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE environment variables');
  process.exit(1);
}

const email = getArg('--email', 'hypehaus21@gmail.com');
const password = getArg('--password', 'Aditya@21');
const role = getArg('--role', 'admin');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('admin_users')
    .upsert({ email, password_hash: passwordHash, role }, { onConflict: 'email' })
    .select('*')
    .single();

  if (error) {
    console.error('Error inserting admin user:', error.message);
    process.exit(1);
  }
  console.log('Admin user upserted:', { id: data.id, email: data.email, role: data.role });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


