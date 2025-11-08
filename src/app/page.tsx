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
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Hypehaus Admin</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Manage events, ticket tiers, and images.</p>
        </div>

        {!isAuthed ? (
          <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">You're not signed in</h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">Sign in to access the admin panel.</p>
            <Link href="/signin" className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-black">Sign In</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link href="/events" className="rounded-lg border bg-white p-6 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
              <div className="text-zinc-900 dark:text-zinc-100 font-medium">Manage Events</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">View, publish, edit, and delete events.</div>
            </Link>
            <Link href="/events/new" className="rounded-lg border bg-white p-6 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
              <div className="text-zinc-900 dark:text-zinc-100 font-medium">Create Event</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Add a new event with schedule, venue, and pricing.</div>
            </Link>
            <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-zinc-900 dark:text-zinc-100 font-medium">Ticket Tiers & Images</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Manage tiers and images within each event’s edit page.</div>
            </div>
        </div>
        )}
      </main>
    </div>
  );
}
