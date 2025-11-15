"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ role: 'admin' | 'moderator' } | null>(null);

  // Load current user role
  useEffect(() => {
    fetch('/api/admin/me')
      .then(res => res.json())
      .then(data => {
        if (data.admin) {
          setCurrentUser(data.admin);
        }
      })
      .catch(() => {});
  }, []);

  // Keep main content padding in sync with actual sidebar width on desktop
  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null;
    const apply = () => {
      if (!mq || !mq.matches) {
        document.body.style.setProperty('--sidebar-w', '0px');
      } else {
        document.body.style.setProperty('--sidebar-w', collapsed ? '4rem' : '15rem');
      }
    };
    apply();
    mq?.addEventListener('change', apply);
    return () => mq?.removeEventListener('change', apply);
  }, [collapsed]);

  const logout = async () => {
    setMobileMenuOpen(false);
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/signin');
  };

  const NavLink = ({ href, label, icon, collapsed = false }: { href: string; label: string; icon: React.ReactNode; collapsed?: boolean }) => {
    const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
    return (
      <Link
        href={href}
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
          active
            ? 'bg-[rgba(255,255,255,0.06)] text-[var(--hh-text)]'
            : 'text-[var(--hh-text-secondary)] hover:text-[var(--hh-text)] hover:bg-[rgba(255,255,255,0.04)]'
        }`}
      >
        <span className="shrink-0">{icon}</span>
        <span className={`${collapsed ? 'hidden' : 'block'}`}>{label}</span>
      </Link>
    );
  };

  const IconHome = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M9 22V12h6v10" />
    </svg>
  );

  const IconCalendar = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  const IconPlus = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );

  const IconQr = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h7v7H3z" />
      <path d="M14 3h7v7h-7z" />
      <path d="M14 14h7v7h-7z" />
      <path d="M3 14h7v7H3z" />
      <path d="M7 7h0" />
      <path d="M17 17h0" />
    </svg>
  );

  const IconUsers = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  const IconLogout = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 border-b border-[var(--hh-border)] bg-[var(--hh-bg-elevated)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--hh-bg-elevated)]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="font-semibold">Hypehaus Admin</div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md hover:bg-[rgba(255,255,255,0.04)]"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 max-w-[80vw] border-r border-[var(--hh-border)] bg-[var(--hh-bg-elevated)] transition-transform duration-200 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          <div className="px-4 h-14 flex items-center font-semibold border-b border-[var(--hh-border)]">Menu</div>
          <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
            <NavLink href="/" label="Dashboard" icon={IconHome} />
            <NavLink href="/events" label="Events" icon={IconCalendar} />
            {currentUser?.role === 'admin' && (
              <NavLink href="/events/new" label="Create Event" icon={IconPlus} />
            )}
            <NavLink href="/scan" label="Scan Tickets" icon={IconQr} />
            {currentUser?.role === 'admin' && (
              <NavLink href="/admin-users" label="Admin Users" icon={IconUsers} />
            )}
          </nav>
          <div className="p-3 border-t border-[var(--hh-border)]">
            <button onClick={logout} className="w-full hh-btn-secondary text-sm flex items-center justify-center gap-2">
              {IconLogout}
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex lg:flex-col fixed inset-y-0 left-0 border-r border-[var(--hh-border)] bg-[var(--hh-bg-elevated)]/60 backdrop-blur supports-[backdrop-filter]:bg-[var(--hh-bg-elevated)] ${collapsed ? 'lg:w-16' : 'lg:w-60'} w-0`}>
        <div className="px-3 h-14 flex items-center justify-between font-semibold">
          <div className={`${collapsed ? 'hidden' : 'block'}`}>Hypehaus Admin</div>
          <button onClick={() => setCollapsed(!collapsed)} className="p-2 rounded-md hover:bg-[rgba(255,255,255,0.06)]" aria-label="Toggle collapse">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? (<polyline points="9 18 15 12 9 6" />) : (<polyline points="15 18 9 12 15 6" />)}
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-2 py-2 space-y-1">
          <NavLink href="/" label="Dashboard" icon={IconHome} collapsed={collapsed} />
          <NavLink href="/events" label="Events" icon={IconCalendar} collapsed={collapsed} />
          {currentUser?.role === 'admin' && (
            <NavLink href="/events/new" label="Create Event" icon={IconPlus} collapsed={collapsed} />
          )}
          <NavLink href="/scan" label="Scan Tickets" icon={IconQr} collapsed={collapsed} />
          {currentUser?.role === 'admin' && (
            <NavLink href="/admin-users" label="Admin Users" icon={IconUsers} collapsed={collapsed} />
          )}
        </nav>
        <div className="p-3 border-t border-[var(--hh-border)]">
          <button onClick={logout} className="w-full hh-btn-secondary text-sm flex items-center justify-center gap-2">
            {IconLogout}
            <span className={`${collapsed ? 'hidden' : 'inline'}`}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}


