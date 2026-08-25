import Link from "next/link";
import { Button } from "@/components/ui/Button";

const FEATURES = [
  {
    title: "Every complaint, traced end to end",
    body: "File a complaint with a photo, watch it move through Open → In Progress → Resolved. Every change is a new history row — nothing is silently edited or lost.",
  },
  {
    title: "Nothing slips through overdue",
    body: "Each society sets its own overdue threshold. A background sweep flags anything left too long, and overdue items sort to the top of the admin queue automatically.",
  },
  {
    title: "Notices that actually reach people",
    body: "Post a notice, mark it important, and every resident in your society gets emailed — no manual follow-up, no forgotten flat.",
  },
  {
    title: "Built for one building or many",
    body: "Every account is scoped to its own society from the ground up. Residents see their own complaints; admins see their whole building, never anyone else's.",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between px-6 py-6 lg:px-16">
        <span className="font-display text-xl italic text-ink">Maintain</span>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="primary" size="sm">
              Register
            </Button>
          </Link>
        </nav>
      </header>

      <main>
        <section className="px-6 pb-16 pt-10 lg:px-16 lg:pb-24 lg:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-clay">
              Phase 0 · Multi-society MVP
            </p>
            <h1 className="mt-3 font-display text-display-md text-ink lg:text-display-lg">
              A record of upkeep for your building.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
              Who raised it, what changed, and when it was resolved. Maintain gives every
              resident and admin one shared, honest timeline for complaints and notices —
              nothing silently edited, nothing lost.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link href="/register">
                <Button variant="primary">Register</Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary">Sign in</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-hairline bg-paper-raised px-6 py-16 lg:px-16">
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="panel p-6">
                <h2 className="font-display text-lg text-ink">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="px-6 py-8 text-center text-xs text-ink-faint lg:px-16">
        Maintain · Phase 0 · Built to scale from a handful of societies to millions.
      </footer>
    </div>
  );
}
