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
    <div className="min-h-screen">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-semibold text-[var(--hh-text)]">Hypehaus Admin</h1>
        <p className="text-sm text-[var(--hh-text-secondary)] mt-1">Manage events, ticket tiers, and images.</p>
      </div>

      {!isAuthed ? (
        <div className="hh-card p-4 md:p-6">
          <h2 className="mb-2 text-lg font-medium text-[var(--hh-text)]">You're not signed in</h2>
          <p className="mb-4 text-sm text-[var(--hh-text-secondary)]">Sign in to access the admin panel.</p>
          <Link href="/signin" className="inline-flex items-center hh-btn-primary px-4 py-2 text-sm">Sign In</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/events" className="hh-card p-4 md:p-6 hover:bg-[var(--hh-bg-elevated)] transition-colors">
            <div className="text-[var(--hh-text)] font-medium mb-1">Manage Events</div>
            <div className="text-sm text-[var(--hh-text-secondary)]">View, publish, edit, and delete events.</div>
          </Link>
          <Link href="/events/new" className="hh-card p-4 md:p-6 hover:bg-[var(--hh-bg-elevated)] transition-colors">
            <div className="text-[var(--hh-text)] font-medium mb-1">Create Event</div>
            <div className="text-sm text-[var(--hh-text-secondary)]">Add a new event with schedule, venue, and pricing.</div>
          </Link>
          <Link href="/scan" className="hh-card p-4 md:p-6 hover:bg-[var(--hh-bg-elevated)] transition-colors">
            <div className="text-[var(--hh-text)] font-medium mb-1">Scan Tickets</div>
            <div className="text-sm text-[var(--hh-text-secondary)]">Scan and verify attendee tickets at events.</div>
          </Link>
          <div className="hh-card p-4 md:p-6">
            <div className="text-[var(--hh-text)] font-medium mb-1">Ticket Tiers & Images</div>
            <div className="text-sm text-[var(--hh-text-secondary)]">Manage tiers and images within each event's edit page.</div>
          </div>
        </div>
      )}
    </div>
  );
}
