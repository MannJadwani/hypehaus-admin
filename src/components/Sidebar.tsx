"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/signin');
  };

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
    return (
      <Link
        href={href}
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
  );
}


