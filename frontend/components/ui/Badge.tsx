type Tone = "neutral" | "clay" | "moss" | "amber" | "rose";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-hairline/60 text-ink-soft",
  clay: "bg-clay-soft text-clay-dark",
  moss: "bg-moss-soft text-moss",
  amber: "bg-amber-soft text-amber",
  rose: "bg-rose-soft text-rose",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "Open":
      return "amber";
    case "InProgress":
      return "clay";
    case "Resolved":
      return "moss";
    case "Reopened":
      return "rose";
    default:
      return "neutral";
  }
}

export function priorityTone(priority: string): Tone {
  switch (priority) {
    case "High":
      return "rose";
    case "Medium":
      return "amber";
    default:
      return "neutral";
  }
}
