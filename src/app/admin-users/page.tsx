"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminUserCreateSchema, AdminUserUpdateSchema, type AdminUserCreateInput, type AdminUserUpdateInput } from '@/lib/validation';

type AdminUser = {
  id: string;
  email: string;
  role: 'admin' | 'moderator';
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role: 'admin' | 'moderator' } | null>(null);

  useEffect(() => {
    // Load current user role
    fetch('/api/admin/me')
      .then(res => res.json())
      .then(data => {
        if (data.admin) {
          setCurrentUser(data.admin);
          // Redirect moderators - they shouldn't access this page
          if (data.admin.role !== 'admin') {
            window.location.href = '/events';
          }
        }
      })
      .catch(() => {});
  }, []);

  const createForm = useForm<AdminUserCreateInput>({
    resolver: zodResolver(AdminUserCreateSchema),
    defaultValues: { email: '', password: '', role: 'admin' },
  });

  const updateForm = useForm<AdminUserUpdateInput>({
    resolver: zodResolver(AdminUserUpdateSchema),
    defaultValues: {},
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Failed to load admin users');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (values: AdminUserCreateInput) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Failed to create admin user');
        return;
      }
      createForm.reset();
      setShowCreateModal(false);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to create admin user');
    }
  };

  const onUpdate = async (values: AdminUserUpdateInput) => {
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Failed to update admin user');
        return;
      }
      updateForm.reset();
      setEditingUser(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to update admin user');
    }
  };

  const onDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Failed to delete admin user');
        return;
      }
      setDeleteConfirm(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete admin user');
    }
  };

  const startEdit = (user: AdminUser) => {
    setEditingUser(user);
    updateForm.reset({ email: user.email, role: user.role });
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--hh-primary)] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[var(--hh-text-secondary)]">Loading users...</div>
        </div>
      </div>
    );
  }

  // Only admins can access this page
  if (currentUser.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center max-w-md">
          <h3 className="text-lg font-bold text-red-400 mb-2">Unauthorized Access</h3>
          <p className="text-[var(--hh-text-secondary)]">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hh-text)] tracking-tight">Admin Users</h1>
          <p className="text-[var(--hh-text-secondary)] mt-1">Manage access and permissions for the admin panel.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="hh-btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
          </button>
        </div>

        {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
            {error}
          </div>
        )}

      <div className="hh-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-[var(--hh-bg-elevated)]/50 border-b border-[var(--hh-border)]">
                <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--hh-text-tertiary)] uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--hh-text-tertiary)] uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--hh-text-tertiary)] uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--hh-text-tertiary)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-[var(--hh-border)]">
                {users.length === 0 ? (
                  <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--hh-text-secondary)]">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-[var(--hh-text-tertiary)] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>No admin users found</span>
                    </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--hh-bg-elevated)]/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--hh-bg-elevated)] flex items-center justify-center text-xs font-bold text-[var(--hh-text-secondary)]">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[var(--hh-text)] font-medium">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          user.role === 'admin' 
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                        {user.role === 'admin' ? 'Administrator' : 'Moderator'}
                        </span>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--hh-text-secondary)]">
                      {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(user)}
                          className="p-1.5 rounded-lg text-[var(--hh-text-secondary)] hover:text-[var(--hh-primary)] hover:bg-[var(--hh-primary)]/10 transition-colors"
                          title="Edit user"
                          >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(user.id)}
                          className="p-1.5 rounded-lg text-[var(--hh-text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete user"
                          >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="hh-card max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--hh-text)]">Create Admin User</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
              <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
                <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Email Address</label>
                  <input
                    {...createForm.register('email')}
                    type="email"
                    className="hh-input w-full"
                    placeholder="admin@example.com"
                  />
                  {createForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-red-400">{createForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Password</label>
                  <input
                    {...createForm.register('password')}
                    type="password"
                    className="hh-input w-full"
                    placeholder="Minimum 6 characters"
                  />
                  {createForm.formState.errors.password && (
                    <p className="mt-1 text-xs text-red-400">{createForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Role</label>
                  <select {...createForm.register('role')} className="hh-input w-full">
                  <option value="admin">Admin (Full Access)</option>
                  <option value="moderator">Moderator (Limited Access)</option>
                  </select>
                </div>
              <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      createForm.reset();
                      setShowCreateModal(false);
                    }}
                  className="hh-btn-secondary flex-1 justify-center"
                  >
                    Cancel
                  </button>
                <button type="submit" className="hh-btn-primary flex-1 justify-center" disabled={createForm.formState.isSubmitting}>
                  {createForm.formState.isSubmitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="hh-card max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--hh-text)]">Edit User</h2>
              <button onClick={() => { updateForm.reset(); setEditingUser(null); }} className="text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

              <form onSubmit={updateForm.handleSubmit(onUpdate)} className="space-y-4">
                <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Email Address</label>
                  <input
                    {...updateForm.register('email')}
                    type="email"
                    className="hh-input w-full"
                  />
                  {updateForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-red-400">{updateForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">
                  New Password <span className="text-[var(--hh-text-tertiary)] font-normal">(optional)</span>
                  </label>
                  <input
                    {...updateForm.register('password')}
                    type="password"
                    className="hh-input w-full"
                  placeholder="Leave blank to keep current"
                  />
                  {updateForm.formState.errors.password && (
                    <p className="mt-1 text-xs text-red-400">{updateForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Role</label>
                  <select {...updateForm.register('role')} className="hh-input w-full">
                  <option value="admin">Admin (Full Access)</option>
                  <option value="moderator">Moderator (Limited Access)</option>
                  </select>
                </div>
              <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateForm.reset();
                      setEditingUser(null);
                    }}
                  className="hh-btn-secondary flex-1 justify-center"
                  >
                    Cancel
                  </button>
                <button type="submit" className="hh-btn-primary flex-1 justify-center" disabled={updateForm.formState.isSubmitting}>
                  {updateForm.formState.isSubmitting ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="hh-card max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-red-500/20">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2 text-[var(--hh-text)]">Delete User?</h2>
            <p className="mb-6 text-[var(--hh-text-secondary)]">
              Are you sure you want to delete this user? This action cannot be undone and will revoke their access immediately.
              </p>
            <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                className="hh-btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onDelete(deleteConfirm)}
                className="flex-1 justify-center px-4 py-2 rounded-xl font-medium transition-all duration-200 active:scale-95 bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                >
                Delete User
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
