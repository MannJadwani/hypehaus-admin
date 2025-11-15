import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import bcrypt from 'bcrypt';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AdminUserCreateSchema } from '@/lib/validation';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/users - List all admin users
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] });
  } catch (error: any) {
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/users - Create new admin user
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const json = await req.json();
    const parsed = AdminUserCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { email, password, role } = parsed.data;

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .insert({ email, password_hash: passwordHash, role })
      .select('id, email, role, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data }, { status: 201 });
  } catch (error: any) {
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

