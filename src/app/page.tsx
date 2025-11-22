import Link from "next/link";
import { cookies } from "next/headers";
import { verifyAdminJWT } from "@/lib/jwt";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  let isAuthed = false;
  if (token) {
    try {
      verifyAdminJWT(token);
      isAuthed = true;
    } catch {}
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--hh-text)] tracking-tight">Dashboard</h1>
        <p className="text-[var(--hh-text-secondary)] mt-2">Welcome to HypeHaus Admin. Manage your events and community.</p>
      </div>

      {!isAuthed ? (
        <div className="hh-card max-w-md mx-auto p-8 text-center">
          <div className="w-16 h-16 bg-[var(--hh-bg-elevated)] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[var(--hh-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--hh-text)] mb-2">Sign in Required</h2>
          <p className="text-[var(--hh-text-secondary)] mb-8">You need to be signed in to access the administrative tools.</p>
          <Link href="/signin" className="hh-btn-primary w-full flex justify-center py-2.5">
            Sign In to Continue
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/events" className="hh-card p-6 hover:border-[var(--hh-primary)]/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all group">
            <div className="w-12 h-12 bg-[var(--hh-primary)]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[var(--hh-primary)] group-hover:text-white transition-colors text-[var(--hh-primary)]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--hh-text)] mb-2">Manage Events</h3>
            <p className="text-sm text-[var(--hh-text-secondary)]">View, edit, and publish events. Manage details, tickets, and more.</p>
          </Link>

          <Link href="/events/new" className="hh-card p-6 hover:border-[var(--hh-primary)]/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all group">
            <div className="w-12 h-12 bg-[var(--hh-primary)]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[var(--hh-primary)] group-hover:text-white transition-colors text-[var(--hh-primary)]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--hh-text)] mb-2">Create Event</h3>
            <p className="text-sm text-[var(--hh-text-secondary)]">Launch a new event. Set up schedule, venue, and ticket tiers.</p>
          </Link>

          <Link href="/scan" className="hh-card p-6 hover:border-[var(--hh-primary)]/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all group">
            <div className="w-12 h-12 bg-[var(--hh-primary)]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[var(--hh-primary)] group-hover:text-white transition-colors text-[var(--hh-primary)]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4h-4v-4H8m1-4h4m-4-4h4m-1 4h-2m2 4h-2m2 4h-2" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--hh-text)] mb-2">Scan Tickets</h3>
            <p className="text-sm text-[var(--hh-text-secondary)]">Check in attendees by scanning their QR codes at the venue.</p>
          </Link>

          <div className="hh-card p-6 opacity-60">
            <div className="w-12 h-12 bg-[var(--hh-bg-elevated)] rounded-xl flex items-center justify-center mb-4 text-[var(--hh-text-tertiary)]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--hh-text)] mb-2">Analytics</h3>
            <p className="text-sm text-[var(--hh-text-secondary)]">Coming soon. View sales performance and attendee insights.</p>
          </div>
        </div>
      )}
    </div>
  );
}
