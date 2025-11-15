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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--hh-text-secondary)]">Loading admin users...</div>
      </div>
    );
  }

  // Only admins can access this page
  if (currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Unauthorized: Admin access required</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--hh-text)]">Admin Users</h1>
          <button onClick={() => setShowCreateModal(true)} className="hh-btn-primary">
            Create Admin User
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
            {error}
          </div>
        )}

        <div className="hh-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[rgba(255,255,255,0.02)] border-b border-[var(--hh-border)]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--hh-text-secondary)]">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--hh-text-secondary)]">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--hh-text-secondary)]">Created</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-[var(--hh-text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[var(--hh-text-secondary)]">
                      No admin users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-[var(--hh-border)] hover:bg-[rgba(255,255,255,0.02)]">
                      <td className="px-4 py-3 text-[var(--hh-text)]">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-500/20 text-purple-300' 
                            : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--hh-text-secondary)] text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(user)}
                            className="hh-btn-secondary text-xs px-3 py-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(user.id)}
                            className="hh-btn-secondary text-xs px-3 py-1 text-red-400 hover:text-red-300"
                          >
                            Delete
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="hh-card max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4 text-[var(--hh-text)]">Create Admin User</h2>
              <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--hh-text-secondary)]">Email</label>
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
                  <label className="block text-sm font-medium mb-1 text-[var(--hh-text-secondary)]">Password</label>
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
                  <label className="block text-sm font-medium mb-1 text-[var(--hh-text-secondary)]">Role</label>
                  <select {...createForm.register('role')} className="hh-input w-full">
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      createForm.reset();
                      setShowCreateModal(false);
                    }}
                    className="hh-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="hh-btn-primary" disabled={createForm.formState.isSubmitting}>
                    {createForm.formState.isSubmitting ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="hh-card max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4 text-[var(--hh-text)]">Edit Admin User</h2>
              <form onSubmit={updateForm.handleSubmit(onUpdate)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--hh-text-secondary)]">Email</label>
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
                  <label className="block text-sm font-medium mb-1 text-[var(--hh-text-secondary)]">
                    New Password (leave blank to keep current)
                  </label>
                  <input
                    {...updateForm.register('password')}
                    type="password"
                    className="hh-input w-full"
                    placeholder="Minimum 6 characters"
                  />
                  {updateForm.formState.errors.password && (
                    <p className="mt-1 text-xs text-red-400">{updateForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--hh-text-secondary)]">Role</label>
                  <select {...updateForm.register('role')} className="hh-input w-full">
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      updateForm.reset();
                      setEditingUser(null);
                    }}
                    className="hh-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="hh-btn-primary" disabled={updateForm.formState.isSubmitting}>
                    {updateForm.formState.isSubmitting ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="hh-card max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4 text-[var(--hh-text)]">Delete Admin User</h2>
              <p className="mb-4 text-[var(--hh-text-secondary)]">
                Are you sure you want to delete this admin user? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="hh-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onDelete(deleteConfirm)}
                  className="hh-btn-secondary text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

