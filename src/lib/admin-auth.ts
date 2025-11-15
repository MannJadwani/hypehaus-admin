import { NextRequest } from 'next/server';
import { verifyAdminJWT } from '@/lib/jwt';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type AdminRole = 'admin' | 'moderator';

export type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
};

/**
 * Get the current admin user from the request
 */
export async function getCurrentAdmin(req: NextRequest): Promise<AdminUser | null> {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) {
    return null;
  }

  try {
    const { sub: adminId } = verifyAdminJWT(token);
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, email, role')
      .eq('id', adminId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Check if the current admin has admin role
 */
export async function requireAdmin(req: NextRequest): Promise<AdminUser> {
  const admin = await getCurrentAdmin(req);
  if (!admin || admin.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required');
  }
  return admin;
}

/**
 * Check if the current user is authenticated (admin or moderator)
 */
export async function requireAuth(req: NextRequest): Promise<AdminUser> {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    throw new Error('Unauthorized: Authentication required');
  }
  return admin;
}

/**
 * Check if the current admin can create events (admin only)
 */
export async function requireEventCreate(req: NextRequest): Promise<AdminUser> {
  const admin = await requireAuth(req);
  if (admin.role !== 'admin') {
    throw new Error('Unauthorized: Only admins can create events');
  }
  return admin;
}

/**
 * Check if the current admin can delete events (admin only)
 */
export async function requireEventDelete(req: NextRequest): Promise<AdminUser> {
  const admin = await requireAuth(req);
  if (admin.role !== 'admin') {
    throw new Error('Unauthorized: Only admins can delete events');
  }
  return admin;
}

/**
 * Check if the current admin can edit events (admin or moderator)
 */
export async function requireEventEdit(req: NextRequest): Promise<AdminUser> {
  return requireAuth(req);
}


