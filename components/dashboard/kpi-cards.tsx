"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { dashboardMetrics, formatCurrency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/** Activity-oriented labels — avoids duplicating “total portfolio” from the hero strip. */
const kpiData = [
  {
    title: "Cash collected today",
    value: formatCurrency(dashboardMetrics.collections_today),
    change: `${dashboardMetrics.collection_rate}%`,
    changeType: "positive" as const,
    icon: CreditCard,
    description: `of ${formatCurrency(dashboardMetrics.expected_collections_today)} expected`,
    colorClass: "bg-kpi-collections",
    iconBgClass: "bg-kpi-collections/15",
    iconClass: "text-kpi-collections",
    slideTint:
      "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-card to-emerald-950/[0.04] dark:from-emerald-500/10 dark:to-emerald-950/30",
  },
  {
    title: "At-risk exposure (PAR)",
    value: formatCurrency(dashboardMetrics.par_over_90 + dashboardMetrics.par_31_90),
    change: `${dashboardMetrics.npl_ratio}% NPL`,
    changeType: "negative" as const,
    icon: AlertTriangle,
    description: "non-performing vs book",
    colorClass: "bg-kpi-risk",
    iconBgClass: "bg-kpi-risk/15",
    iconClass: "text-kpi-risk",
    slideTint:
      "border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] via-card to-amber-950/[0.05] dark:from-amber-500/10 dark:to-amber-950/25",
  },
  {
    title: "Applications in pipeline",
    value: dashboardMetrics.pending_applications.toString(),
    change: "2 new",
    changeType: "neutral" as const,
    icon: FileText,
    description: "awaiting decision",
    colorClass: "bg-kpi-applications",
    iconBgClass: "bg-kpi-applications/15",
    iconClass: "text-kpi-applications",
    slideTint:
      "border-violet-500/25 bg-gradient-to-br from-violet-500/[0.07] via-card to-violet-950/[0.05] dark:from-violet-500/10 dark:to-violet-950/25",
  },
  {
    title: "Registered customers",
    value: dashboardMetrics.total_customers.toString(),
    change: "+3",
    changeType: "positive" as const,
    icon: Users,
    description: "active relationships",
    colorClass: "bg-kpi-customers",
    iconBgClass: "bg-kpi-customers/15",
    iconClass: "text-kpi-customers",
    slideTint:
      "border-sky-500/25 bg-gradient-to-br from-sky-500/[0.07] via-card to-sky-950/[0.05] dark:from-sky-500/10 dark:to-sky-950/25",
  },
  {
    title: "Disbursements (MTD)",
    value: formatCurrency(dashboardMetrics.disbursements_this_month),
    change: "+8.2%",
    changeType: "positive" as const,
    icon: TrendingUp,
    description: "vs prior month",
    colorClass: "bg-kpi-disbursements",
    iconBgClass: "bg-kpi-disbursements/15",
    iconClass: "text-kpi-disbursements",
    slideTint:
      "border-teal-500/25 bg-gradient-to-br from-teal-500/[0.07] via-card to-teal-950/[0.05] dark:from-teal-500/10 dark:to-teal-950/25",
  },
];

type Period = "today" | "week" | "all";

export function KPICards() {
  const [period, setPeriod] = useState<Period>("today");
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeSlide, setActiveSlide] = useState(0);

  const onCarouselSelect = useCallback((api: CarouselApi) => {
    setActiveSlide(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!carouselApi) return;
    onCarouselSelect(carouselApi);
    carouselApi.on("reInit", onCarouselSelect);
    carouselApi.on("select", onCarouselSelect);
    return () => {
      carouselApi.off("select", onCarouselSelect);
    };
  }, [carouselApi, onCarouselSelect]);

  const periodLabel =
    period === "today" ? "Today" : period === "week" ? "This week" : "All time";

  return (
    <>
      {/* Mobile: single smart widget — carousel + glance strip */}
      <Card className="overflow-hidden border-emerald-950/15 bg-card shadow-md ring-1 ring-emerald-950/10 dark:border-emerald-900/30 dark:ring-emerald-900/20 md:hidden">
        <div className="relative bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 px-4 py-3.5 text-primary-foreground">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_55%)]" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/95">
                Key indicators
              </p>
              <p className="mt-0.5 text-sm font-medium text-emerald-50/90">
                Portfolio pulse · {periodLabel}
              </p>
            </div>
            <div className="flex gap-1.5 rounded-full bg-black/20 p-1 ring-1 ring-white/10">
              {(
                [
                  { id: "today" as const, label: "Today" },
                  { id: "week" as const, label: "Week" },
                  { id: "all" as const, label: "All" },
                ] as const
              ).map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 flex-1 rounded-full px-3 text-xs font-semibold text-emerald-100/90 hover:bg-white/10 hover:text-white sm:flex-none",
                    period === id && "bg-white/20 text-white shadow-sm"
                  )}
                  onClick={() => setPeriod(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <CardContent className="space-y-0 p-0">
          <div className="relative px-1 pb-1 pt-3">
            <Carousel
              setApi={setCarouselApi}
              opts={{ align: "center", loop: true }}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {kpiData.map((kpi) => {
                  const isAlert = kpi.changeType === "negative";
                  return (
                    <CarouselItem key={kpi.title} className="basis-full pl-2 md:pl-4">
                      <div
                        className={cn(
                          "relative mx-0.5 overflow-hidden rounded-2xl border p-4 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]",
                          kpi.slideTint
                        )}
                      >
                        <div
                          className={cn(
                            "absolute left-0 top-0 h-full w-1 rounded-l-2xl",
                            kpi.colorClass
                          )}
                        />
                        <div className="flex items-start justify-between gap-3 pl-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              {kpi.title}
                            </p>
                            <p
                              className={cn(
                                "break-words text-2xl font-bold tabular-nums leading-none tracking-tight sm:text-3xl",
                                isAlert ? "text-destructive" : "text-foreground"
                              )}
                            >
                              {kpi.value}
                            </p>
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-2 text-xs">
                              {kpi.changeType === "positive" ? (
                                <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                                  {kpi.change}
                                </span>
                              ) : kpi.changeType === "negative" ? (
                                <span className="inline-flex items-center gap-0.5 font-semibold text-destructive">
                                  <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                                  {kpi.change}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 font-semibold text-sky-600 dark:text-sky-400">
                                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                                  {kpi.change}
                                </span>
                              )}
                              <span className="text-muted-foreground">{kpi.description}</span>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-black/[0.04] dark:ring-white/[0.08]",
                              kpi.iconBgClass
                            )}
                          >
                            <kpi.icon className={cn("h-6 w-6", kpi.iconClass)} aria-hidden />
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              <CarouselPrevious
                variant="secondary"
                className="left-1 top-[42%] z-10 size-9 border-border/60 bg-background/95 shadow-md backdrop-blur-sm dark:bg-background/90"
              />
              <CarouselNext
                variant="secondary"
                className="right-1 top-[42%] z-10 size-9 border-border/60 bg-background/95 shadow-md backdrop-blur-sm dark:bg-background/90"
              />
            </Carousel>
          </div>

          <div className="flex justify-center gap-1.5 px-4 pb-2">
            {kpiData.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show metric ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === activeSlide
                    ? "w-7 bg-emerald-600 dark:bg-emerald-500"
                    : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40"
                )}
                onClick={() => carouselApi?.scrollTo(i)}
              />
            ))}
          </div>

          <div className="border-t border-border/60 bg-gradient-to-b from-muted/40 to-muted/20 px-2 py-3 dark:from-muted/25 dark:to-muted/10">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              At a glance — tap to focus
            </p>
            <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
              {kpiData.map((kpi, i) => (
                <button
                  key={kpi.title}
                  type="button"
                  onClick={() => carouselApi?.scrollTo(i)}
                  className={cn(
                    "flex min-w-[5.75rem] shrink-0 flex-col rounded-xl border px-2.5 py-2 text-left shadow-sm transition-all",
                    i === activeSlide
                      ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30 dark:bg-emerald-500/15"
                      : "border-border/70 bg-card/80 hover:border-border hover:bg-muted/50"
                  )}
                >
                  <span className="line-clamp-2 text-[9px] font-medium leading-tight text-muted-foreground">
                    {kpi.title}
                  </span>
                  <span
                    className={cn(
                      "mt-1 truncate text-sm font-bold tabular-nums leading-none",
                      kpi.changeType === "negative" ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {kpi.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop / tablet: richer cards — no flat white */}
      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpiData.map((kpi) => (
          <Card
            key={kpi.title}
            className={cn(
              "group relative overflow-hidden border border-border/50 shadow-sm transition-all duration-200",
              "bg-gradient-to-br from-card via-card to-muted/40",
              "hover:-translate-y-0.5 hover:border-emerald-900/15 hover:shadow-lg dark:from-card dark:via-card dark:to-emerald-950/25 dark:hover:border-emerald-800/30"
            )}
          >
            <div className={cn("absolute left-0 right-0 top-0 h-[3px]", kpi.colorClass)} />
            <div
              className={cn(
                "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12] blur-2xl transition-opacity group-hover:opacity-[0.2]",
                kpi.colorClass
              )}
            />
            <CardContent className="relative pt-6 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.14em] text-muted-foreground">
                    {kpi.title}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-[clamp(1.125rem,calc(4.5cqw+0.45rem),1.875rem)] font-bold tabular-nums leading-none tracking-tight text-foreground">
                    {kpi.value}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-black/[0.05] dark:ring-white/[0.08]",
                    kpi.iconBgClass
                  )}
                >
                  <kpi.icon className={cn("h-5 w-5", kpi.iconClass)} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 border-t border-border/40 pt-3 text-xs leading-snug dark:border-border/30">
                {kpi.changeType === "positive" ? (
                  <span className="flex shrink-0 items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="h-3 w-3" />
                    {kpi.change}
                  </span>
                ) : kpi.changeType === "negative" ? (
                  <span className="flex shrink-0 items-center gap-0.5 font-semibold text-destructive">
                    <ArrowDownRight className="h-3 w-3" />
                    {kpi.change}
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-0.5 font-semibold text-sky-600 dark:text-sky-400">
                    <TrendingUp className="h-3 w-3" />
                    {kpi.change}
                  </span>
                )}
                <span className="min-w-0 text-muted-foreground">{kpi.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
