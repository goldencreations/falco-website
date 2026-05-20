"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
 Users,
 TrendingUp,
 AlertTriangle,
 ArrowUpRight,
 ArrowDownRight,
 FileText,
 CreditCard,
} from "lucide-react";
import Image from "next/image";
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
import { useTranslations } from "@/lib/i18n/use-translations";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type KpiMetrics = {
 collections_today: number;
 expected_collections_today: number;
 collection_rate: number;
 par_exposure: number;
 npl_ratio: number;
 pending_applications: number;
 total_customers: number;
 disbursements_this_month: number;
};

const KPI_ZERO: KpiMetrics = {
 collections_today: 0,
 expected_collections_today: 0,
 collection_rate: 0,
 par_exposure: 0,
 npl_ratio: 0,
 pending_applications: 0,
 total_customers: 0,
 disbursements_this_month: 0,
};

function mapDashboardMetricsPayload(json: unknown): KpiMetrics {
 if (!json || typeof json !== "object") return KPI_ZERO;
 const root = json as { metrics?: Record<string, unknown> };
 const m = root.metrics;
 if (!m || typeof m !== "object") return KPI_ZERO;
 const portfolio = (m.portfolio as Record<string, unknown>) || {};
 const risk = (m.risk as Record<string, unknown>) || {};
 const applications = (m.applications as Record<string, unknown>) || {};
 const collections = (m.collections as Record<string, unknown>) || {};
 const disbursements = (m.disbursements as Record<string, unknown>) || {};

 const colAmount = Number(collections.amount ?? 0);
 const colRate = Number(collections.collection_rate ?? 0);
 const parAmount = Number(risk.par_amount ?? 0);
 const nplRate = Number(risk.npl_rate ?? 0);
 const pending =
 Number(applications.submitted ?? 0) + Number(applications.under_review ?? 0);
 const customers = Number(portfolio.loan_count ?? 0);
 const disb = Number(disbursements.amount ?? 0);

 return {
 collections_today: colAmount,
 expected_collections_today: 0,
 collection_rate: colRate,
 par_exposure: parAmount,
 npl_ratio: nplRate,
 pending_applications: pending,
 total_customers: customers,
 disbursements_this_month: disb,
 };
}

type Period = "today" | "week" | "all";

export function KPICards({ metricsJson }: { metricsJson?: unknown }) {
  const { t } = useTranslations();
  const [metrics, setMetrics] = useState<KpiMetrics>(() =>
    metricsJson !== undefined ? mapDashboardMetricsPayload(metricsJson) : KPI_ZERO
  );

  useEffect(() => {
    if (metricsJson !== undefined) {
      setMetrics(mapDashboardMetricsPayload(metricsJson));
      return;
    }
    let cancelled = false;
    void fetch("/api/falco/dashboard/metrics")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setMetrics(mapDashboardMetricsPayload(json));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [metricsJson]);

 const kpiData = useMemo(
 () => [
 {
 title: t("kpi.cashCollectedToday"),
 value: formatCurrencyCompact(metrics.collections_today),
 rawAmount: metrics.collections_today,
 change: `${metrics.collection_rate}%`,
 changeType: "positive" as const,
 icon: CreditCard,
 description: t("kpi.ofExpected", {
 amount: formatCurrencyCompact(metrics.expected_collections_today),
 }),
 colorClass: "bg-kpi-collections",
 iconBgClass: "bg-kpi-collections/15",
 iconClass: "text-kpi-collections",
 illustration: "/illustrations/Investment data-bro.png",
 slideTint:
 "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-card to-emerald-950/[0.04] ",
 },
 {
 title: t("kpi.atRiskPar"),
 value: formatCurrencyCompact(metrics.par_exposure),
 rawAmount: metrics.par_exposure,
 change: t("kpi.nplSuffix", { pct: metrics.npl_ratio }),
 changeType: "negative" as const,
 icon: AlertTriangle,
 description: t("kpi.nonPerformingVsBook"),
 colorClass: "bg-kpi-risk",
 iconBgClass: "bg-kpi-risk/15",
 iconClass: "text-kpi-risk",
 illustration: "/illustrations/Warning-rafiki.png",
 slideTint:
 "border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] via-card to-amber-950/[0.05] ",
 },
 {
 title: t("kpi.applicationsPipeline"),
 value: metrics.pending_applications.toString(),
 rawAmount: null,
 change: "—",
 changeType: "neutral" as const,
 icon: FileText,
 description: t("kpi.awaitingDecision"),
 colorClass: "bg-kpi-applications",
 iconBgClass: "bg-kpi-applications/15",
 iconClass: "text-kpi-applications",
 illustration: "/illustrations/Documents-bro.png",
 slideTint:
 "border-violet-500/25 bg-gradient-to-br from-violet-500/[0.07] via-card to-violet-950/[0.05] ",
 },
 {
 title: t("kpi.registeredCustomers"),
 value: metrics.total_customers.toString(),
 rawAmount: null,
 change: "—",
 changeType: "positive" as const,
 icon: Users,
 description: t("kpi.activeRelationships"),
 colorClass: "bg-kpi-customers",
 iconBgClass: "bg-kpi-customers/15",
 iconClass: "text-kpi-customers",
 illustration: "/illustrations/Team spirit-bro.png",
 slideTint:
 "border-sky-500/25 bg-gradient-to-br from-sky-500/[0.07] via-card to-sky-950/[0.05] ",
 },
 {
 title: t("kpi.disbursementsMtd"),
 value: formatCurrencyCompact(metrics.disbursements_this_month),
 rawAmount: metrics.disbursements_this_month,
 change: "—",
 changeType: "positive" as const,
 icon: TrendingUp,
 description: t("kpi.vsPriorMonth"),
 colorClass: "bg-kpi-disbursements",
 iconBgClass: "bg-kpi-disbursements/15",
 iconClass: "text-kpi-disbursements",
 illustration: "/illustrations/Investment data-amico.png",
 slideTint:
 "border-teal-500/25 bg-gradient-to-br from-teal-500/[0.07] via-card to-teal-950/[0.05] ",
 },
 ],
 [metrics, t]
 );

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
 period === "today" ? t("common.today") : period === "week" ? t("common.week") : t("common.all");

 const scrollRef = useRef<HTMLDivElement>(null);
 const [scrollProgress, setScrollProgress] = useState(0);

 const onDesktopScroll = useCallback(() => {
 const el = scrollRef.current;
 if (!el) return;
 const max = el.scrollWidth - el.clientWidth;
 setScrollProgress(max > 0 ? el.scrollLeft / max : 0);
 }, []);

 useEffect(() => {
 const el = scrollRef.current;
 if (!el) return;
 onDesktopScroll();
 el.addEventListener("scroll", onDesktopScroll, { passive: true });
 const ro = new ResizeObserver(onDesktopScroll);
 ro.observe(el);
 return () => {
 el.removeEventListener("scroll", onDesktopScroll);
 ro.disconnect();
 };
 }, [onDesktopScroll]);

 return (
 <>
 {/* Mobile: single smart widget — carousel + glance strip */}
 <Card className="overflow-hidden border-emerald-950/15 bg-card shadow-md ring-1 ring-emerald-950/10 md:hidden">
 <div className="relative bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 px-4 py-3.5 text-primary-foreground">
 <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_55%)]" />
 <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/95">
 {t("kpi.keyIndicators")}
 </p>
 <p className="mt-0.5 text-sm font-medium text-emerald-50/90">
 {t("kpi.portfolioPulse", { period: periodLabel })}
 </p>
 </div>
 <div className="flex gap-1.5 rounded-full bg-black/20 p-1 ring-1 ring-white/10">
 {(
 [
 { id: "today" as const, label: t("common.today") },
 { id: "week" as const, label: t("common.week") },
 { id: "all" as const, label: t("common.all") },
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
 "relative mx-0.5 overflow-hidden rounded-2xl border p-4 shadow-sm ring-1 ring-black/[0.03] ",
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
 <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600 ">
 <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
 {kpi.change}
 </span>
 ) : kpi.changeType === "negative" ? (
 <span className="inline-flex items-center gap-0.5 font-semibold text-destructive">
 <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
 {kpi.change}
 </span>
 ) : (
 <span className="inline-flex items-center gap-0.5 font-semibold text-sky-600 ">
 <TrendingUp className="h-3.5 w-3.5 shrink-0" />
 {kpi.change}
 </span>
 )}
 <span className="text-muted-foreground">{kpi.description}</span>
 </div>
 </div>
 <div
 className={cn(
 "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-black/[0.04] ",
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
 className="left-1 top-[42%] z-10 size-9 border-border/60 bg-background/95 shadow-md backdrop-blur-sm "
 />
 <CarouselNext
 variant="secondary"
 className="right-1 top-[42%] z-10 size-9 border-border/60 bg-background/95 shadow-md backdrop-blur-sm "
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
 ? "w-7 bg-emerald-600 "
 : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40"
 )}
 onClick={() => carouselApi?.scrollTo(i)}
 />
 ))}
 </div>

 <div className="border-t border-border/60 bg-gradient-to-b from-muted/40 to-muted/20 px-2 py-3 ">
 <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
 {t("kpi.atAGlance")}
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
 ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30 "
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

 {/* Desktop / tablet: horizontally scrollable row */}
 <div className="hidden md:block">
 <div
 ref={scrollRef}
 className="flex gap-4 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
 >
 {kpiData.map((kpi) => (
 <Card
 key={kpi.title}
 className={cn(
 "relative w-[min(360px,80vw)] shrink-0 overflow-hidden border border-border/50 shadow-sm",
 "bg-gradient-to-br from-card via-card to-muted/40",
 " "
 )}
 >
 <div className={cn("absolute left-0 right-0 top-0 h-[3px]", kpi.colorClass)} />
 <CardContent className="relative pt-6 pb-4">
 <div className="min-w-0 space-y-1">
 <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.14em] text-muted-foreground">
 {kpi.title}
 </p>
 {kpi.rawAmount !== null && kpi.rawAmount >= 1_000_000 ? (
 <Tooltip>
 <TooltipTrigger asChild>
 <p className="mt-1 w-fit cursor-default break-words text-2xl font-bold tabular-nums leading-tight tracking-tight text-foreground">
 {kpi.value}
 </p>
 </TooltipTrigger>
 <TooltipContent side="top">
 {formatCurrency(kpi.rawAmount)}
 </TooltipContent>
 </Tooltip>
 ) : (
 <p className="mt-1 break-words text-2xl font-bold tabular-nums leading-tight tracking-tight text-foreground">
 {kpi.value}
 </p>
 )}
 </div>
 <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 border-t border-border/40 pt-3 text-xs leading-snug ">
 {kpi.changeType === "positive" ? (
 <span className="flex shrink-0 items-center gap-0.5 font-semibold text-emerald-600 ">
 <ArrowUpRight className="h-3 w-3" />
 {kpi.change}
 </span>
 ) : kpi.changeType === "negative" ? (
 <span className="flex shrink-0 items-center gap-0.5 font-semibold text-destructive">
 <ArrowDownRight className="h-3 w-3" />
 {kpi.change}
 </span>
 ) : (
 <span className="flex shrink-0 items-center gap-0.5 font-semibold text-sky-600 ">
 <TrendingUp className="h-3 w-3" />
 {kpi.change}
 </span>
 )}
 <span className="min-w-0 text-muted-foreground">{kpi.description}</span>
 </div>
 <Image
 src={kpi.illustration}
 alt=""
 width={160}
 height={160}
 className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 object-contain opacity-20"
 aria-hidden
 />
 </CardContent>
 </Card>
 ))}
 </div>

 {/* Scroll progress indicator */}
 <div className="mt-2 h-1 w-full rounded-full bg-border/50">
 <div
 className="h-full rounded-full bg-emerald-500/60 transition-[width] duration-75"
 style={{ width: `${Math.round(scrollProgress * 100)}%` }}
 />
 </div>
 </div>
 </>
 );
}
