import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import bcrypt from 'bcrypt';
import { requireAdmin } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AdminUserUpdateSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id] - Update admin user
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const json = await req.json();
    const parsed = AdminUserUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const updates: any = {};
    if (parsed.data.email) {
      // Check if email already exists (excluding current user)
      const { data: existing } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('email', parsed.data.email)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
      updates.email = parsed.data.email;
    }

    if (parsed.data.password) {
      updates.password_hash = await bcrypt.hash(parsed.data.password, 10);
    }

    if (parsed.data.role) {
      updates.role = parsed.data.role;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .update(updates)
      .eq('id', id)
      .select('id, email, role, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: data });
  } catch (error: any) {
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - Delete admin user
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const currentAdmin = await requireAdmin(req);
    const { id } = await params;

    // Prevent deleting yourself
    if (currentAdmin.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('admin_users')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


