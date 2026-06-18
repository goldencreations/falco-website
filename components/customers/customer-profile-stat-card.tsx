import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatTone = "cyan" | "emerald" | "amber" | "violet" | "teal";

const toneStyles: Record<
  StatTone,
  {
    ring: string;
    surface: string;
    icon: string;
    label: string;
    value: string;
  }
> = {
  cyan: {
    ring: "from-slate-200/90 via-cyan-300/70 to-cyan-600",
    surface: "bg-gradient-to-br from-cyan-500/[0.09] via-card to-cyan-950/[0.04]",
    icon: "bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-500/20",
    label: "text-cyan-800/70",
    value: "text-cyan-950",
  },
  emerald: {
    ring: "from-slate-200/90 via-emerald-300/70 to-emerald-600",
    surface: "bg-gradient-to-br from-emerald-500/[0.09] via-card to-emerald-950/[0.04]",
    icon: "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/20",
    label: "text-emerald-800/70",
    value: "text-emerald-950",
  },
  amber: {
    ring: "from-slate-200/90 via-amber-300/70 to-amber-600",
    surface: "bg-gradient-to-br from-amber-500/[0.1] via-card to-amber-950/[0.05]",
    icon: "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/20",
    label: "text-amber-800/70",
    value: "text-amber-950",
  },
  violet: {
    ring: "from-slate-200/90 via-violet-300/70 to-violet-600",
    surface: "bg-gradient-to-br from-violet-500/[0.09] via-card to-violet-950/[0.04]",
    icon: "bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/20",
    label: "text-violet-800/70",
    value: "text-violet-950",
  },
  teal: {
    ring: "from-slate-200/90 via-teal-300/70 to-[#573d3d]",
    surface: "bg-gradient-to-br from-teal-500/[0.08] via-card to-[#573d3d]/[0.06]",
    icon: "bg-teal-500/15 text-teal-700 ring-1 ring-teal-500/20",
    label: "text-teal-800/70",
    value: "text-teal-950",
  },
};

type Props = {
  title: string;
  value: string;
  hint: ReactNode;
  icon: LucideIcon;
  tone: StatTone;
};

export function CustomerProfileStatCard({ title, value, hint, icon: Icon, tone }: Props) {
  const styles = toneStyles[tone];

  return (
    <div className={cn("rounded-xl bg-gradient-to-r p-px shadow-sm", styles.ring)}>
      <Card className={cn("gap-0 rounded-[11px] border-0 py-0 shadow-none", styles.surface)}>
        <CardContent className="flex min-w-0 items-start gap-3 p-3.5 sm:p-4">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              styles.icon
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.14em]",
                styles.label
              )}
            >
              {title}
            </p>
            <p className={cn("truncate text-base font-bold tabular-nums sm:text-lg", styles.value)}>
              {value}
            </p>
            <div className="text-xs text-muted-foreground">{hint}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
