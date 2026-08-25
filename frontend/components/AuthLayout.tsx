export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-col justify-between bg-ink px-12 py-12 text-paper lg:flex lg:w-1/2">
        <span className="font-display text-xl italic">Maintain</span>
        <div>
          <p className="font-display text-display-md text-paper">
            Every complaint,
            <br />
            traced end to end.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/60">
            A record of upkeep for your building — who raised it, what
            changed, and when it was resolved. Nothing silently edited,
            nothing lost.
          </p>
        </div>
        <p className="text-xs text-paper/40">Built for residential societies.</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-16 lg:w-1/2">
        <div className="w-full max-w-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-clay">{eyebrow}</p>
          <h1 className="mt-2 font-display text-display-sm text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-ink-soft">{footer}</div>
        </div>
      </div>
    </div>
  );
}
