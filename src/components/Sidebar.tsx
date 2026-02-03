"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ role: 'admin' | 'moderator' | 'vendor' | 'vendor_moderator'; email?: string } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  // Update body class for layout transition when collapsed
  useEffect(() => {
    const main = document.querySelector('main');
    if (main) {
        if (isCollapsed) {
            main.classList.add('lg:pl-20');
            main.classList.remove('lg:pl-64');
      } else {
            main.classList.remove('lg:pl-20');
            main.classList.add('lg:pl-64');
        }
    }
  }, [isCollapsed]);

  useEffect(() => {
    setIsCollapsed(false);
  }, [pathname]);

  const logout = async () => {
    setMobileMenuOpen(false);
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/signin');
  };

  const NavLink = ({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) => {
    const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
    return (
      <Link
        href={href}
        onClick={() => setMobileMenuOpen(false)}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative overflow-hidden ${
          active
            ? 'bg-[var(--hh-primary)]/10 text-[var(--hh-primary)] shadow-[inset_3px_0_0_0_var(--hh-primary)]'
            : 'text-[var(--hh-text-secondary)] hover:text-[var(--hh-text)] hover:bg-[var(--hh-bg-elevated)]'
        } ${isCollapsed ? 'justify-center px-2' : ''}`}
        title={isCollapsed ? label : undefined}
      >
        <span className={`shrink-0 transition-colors duration-200 ${active ? 'text-[var(--hh-primary)]' : 'text-[var(--hh-text-tertiary)] group-hover:text-[var(--hh-text-secondary)]'}`}>
          {icon}
        </span>
        {!isCollapsed && (
            <span className="truncate">{label}</span>
        )}
        {isCollapsed && active && (
            <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-[var(--hh-primary)]"></span>
        )}
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

  const IconChevronLeft = (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  );

  const IconChevronRight = (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );

  const NavContent = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      <NavLink href="/" label="Dashboard" icon={IconHome} />
      <NavLink href="/events" label="Events" icon={IconCalendar} />
      {(currentUser?.role === 'admin' || currentUser?.role === 'vendor') && (
        <NavLink href="/events/new" label="Create Event" icon={IconPlus} />
      )}
      <NavLink href="/scan" label="Scan Tickets" icon={IconQr} />
      {currentUser?.role === 'admin' && (
        <NavLink href="/admin-users" label="Admin Users" icon={IconUsers} />
      )}
    </nav>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 border-b border-[var(--hh-border)] bg-[var(--hh-bg)]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--hh-primary)] to-[var(--hh-primary-dark)] flex items-center justify-center text-white font-bold text-lg shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              H
            </div>
            <div className="font-bold text-lg tracking-tight text-[var(--hh-text)]">HypeHaus</div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl hover:bg-[var(--hh-bg-elevated)] text-[var(--hh-text-secondary)] transition-colors"
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
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-[var(--hh-border)] bg-[var(--hh-bg-card)] shadow-2xl transition-transform duration-300 ease-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          <div className="px-6 h-16 flex items-center border-b border-[var(--hh-border)]">
             <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--hh-primary)] to-[var(--hh-primary-dark)] flex items-center justify-center text-white font-bold text-lg">
                H
              </div>
              <div className="font-bold text-lg tracking-tight text-[var(--hh-text)]">HypeHaus</div>
            </div>
          </div>
          <NavContent />
          <div className="p-4 border-t border-[var(--hh-border)] mt-auto">
             <div className="flex items-center gap-3 px-2 mb-4">
                <div className="w-9 h-9 rounded-full bg-[var(--hh-bg-elevated)] flex items-center justify-center text-xs font-bold text-[var(--hh-text-secondary)] border border-[var(--hh-border)]">
                  {currentUser?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium text-[var(--hh-text)] truncate">{currentUser?.email || 'User'}</span>
                  <span className="text-xs text-[var(--hh-text-tertiary)] capitalize">{currentUser?.role || 'Loading...'}</span>
                </div>
            </div>
            <button onClick={logout} className="w-full hh-btn-secondary text-sm flex items-center justify-center gap-2 py-2.5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20">
              {IconLogout}
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside 
        className={`hidden lg:flex lg:flex-col fixed inset-y-0 left-0 z-20 border-r border-[var(--hh-border)] bg-[var(--hh-bg-card)] transition-all duration-300 ease-in-out ${
            isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Desktop Header */}
        <div className={`px-4 h-16 flex items-center border-b border-[var(--hh-border)] relative ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--hh-primary)] to-[var(--hh-primary-dark)] flex items-center justify-center text-white font-bold text-lg shadow-[0_0_15px_rgba(139,92,246,0.3)] shrink-0">
              H
            </div>
            <div className={`font-bold text-lg tracking-tight text-[var(--hh-text)] transition-opacity duration-200 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
                HypeHaus
            </div>
          </div>
          
          {/* Collapse Toggle Button */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[var(--hh-bg-elevated)] border border-[var(--hh-border)] rounded-full flex items-center justify-center text-[var(--hh-text-secondary)] hover:text-[var(--hh-text)] hover:border-[var(--hh-primary)] transition-colors shadow-sm z-30"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? IconChevronRight : IconChevronLeft}
          </button>
        </div>

        <NavContent />
        
        {/* Desktop Footer */}
        <div className="p-3 border-t border-[var(--hh-border)] mt-auto space-y-1">
          <div className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-all ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-[var(--hh-bg-elevated)] flex items-center justify-center text-xs font-bold text-[var(--hh-text-secondary)] border border-[var(--hh-border)] shrink-0" title={currentUser?.email}>
              {currentUser?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium text-[var(--hh-text)] truncate w-32" title={currentUser?.email}>{currentUser?.email?.split('@')[0] || 'User'}</span>
                <span className="text-xs text-[var(--hh-text-tertiary)] capitalize">{currentUser?.role || 'Loading...'}</span>
                </div>
            )}
          </div>
          
          <button 
            onClick={logout} 
            className={`w-full hh-btn-secondary text-sm flex items-center gap-2 py-2 hover:border-red-500/30 hover:text-red-400 transition-colors ${isCollapsed ? 'justify-center px-2' : 'px-3'}`}
            title="Sign out"
          >
            {IconLogout}
            {!isCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
