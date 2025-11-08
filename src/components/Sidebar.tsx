"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/signin');
  };

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
    return (
      <Link
        href={href}
        onClick={() => setMobileMenuOpen(false)}
        className={`block rounded-md px-3 py-2 text-sm transition-colors ${
          active
            ? 'bg-[rgba(255,255,255,0.06)] text-[var(--hh-text)]'
            : 'text-[var(--hh-text-secondary)] hover:text-[var(--hh-text)] hover:bg-[rgba(255,255,255,0.04)]'
        }`}
      >
        {label}
      </Link>
    );
  };

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
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <aside
        className={`md:hidden fixed top-14 left-0 right-0 z-50 border-b border-[var(--hh-border)] bg-[var(--hh-bg-elevated)] transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <nav className="px-3 py-4 space-y-1">
          <NavLink href="/" label="Dashboard" />
          <NavLink href="/events" label="Events" />
          <NavLink href="/events/new" label="Create Event" />
          <NavLink href="/scan" label="Scan Tickets" />
        </nav>
        <div className="p-3 border-t border-[var(--hh-border)]">
          <button onClick={logout} className="w-full hh-btn-secondary text-sm">
            Logout
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="h-screen sticky top-0 w-60 border-r border-[var(--hh-border)] bg-[var(--hh-bg-elevated)]/60 backdrop-blur supports-[backdrop-filter]:bg-[var(--hh-bg-elevated)] hidden md:flex md:flex-col">
        <div className="px-4 h-14 flex items-center font-semibold">Hypehaus Admin</div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          <NavLink href="/" label="Dashboard" />
          <NavLink href="/events" label="Events" />
          <NavLink href="/events/new" label="Create Event" />
          <NavLink href="/scan" label="Scan Tickets" />
        </nav>
        <div className="p-3 border-t border-[var(--hh-border)]">
          <button onClick={logout} className="w-full hh-btn-secondary text-sm">Logout</button>
        </div>
      </aside>
    </>
  );
}


