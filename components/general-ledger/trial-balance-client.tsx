"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSearch,
  Loader2,
  RefreshCcw,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildTrialBalanceUrl,
  calendarDateToDateKey,
  dateKeyToCalendarDate,
  decimalToMinorUnits,
  defaultTrialBalanceDateRange,
  filterTrialBalanceRows,
  formatTzsFromMinorUnits,
  groupTrialBalanceRows,
  isContraAccount,
  sumTrialBalanceRows,
  type TrialBalanceFilters,
  type TrialBalanceMinorTotals,
  type TrialBalanceRow,
  type TrialBalanceTypeFilter,
} from "@/lib/trial-balance";
import { useTrialBalanceQuery } from "@/lib/use-trial-balance-query";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";

const accountTypeOptions: Array<{ value: TrialBalanceTypeFilter; label: string }> = [
  { value: "all", label: "All account types" },
  { value: "asset", label: "Assets" },
  { value: "liability", label: "Liabilities" },
  { value: "equity", label: "Equity" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
];

export function TrialBalanceClient() {
  const initialDates = useMemo(() => defaultTrialBalanceDateRange(), []);
  const [filters, setFilters] = useState<TrialBalanceFilters>({
    from: "",
    to: "",
    type: "all",
    includeZeroActivity: false,
  });
  const { report, isLoading, error, reload } = useTrialBalanceQuery(filters);
  const { user } = useSessionUser();
  const canExport = user?.role === "super_admin"
    || user?.permissions?.includes("all")
    || user?.permissions?.includes("gl.export");
  useEffect(() => {
    if (report && (!filters.from || !filters.to)) {
      setFilters((current) => ({
        ...current,
        from: current.from || report.from,
        to: current.to || report.to,
      }));
    }
  }, [filters.from, filters.to, report]);
  const displayedFrom = filters.from || report?.from || initialDates.from;
  const displayedTo = filters.to || report?.to || initialDates.to;
  const visibleRows = useMemo(
    () => filterTrialBalanceRows(report?.rows ?? [], filters.type, filters.includeZeroActivity),
    [filters.includeZeroActivity, filters.type, report?.rows],
  );
  const groups = useMemo(() => groupTrialBalanceRows(visibleRows), [visibleRows]);
  const grandTotals = useMemo(() => sumTrialBalanceRows(visibleRows), [visibleRows]);
  const isBalanced = grandTotals.closingDebit === grandTotals.closingCredit;
  const difference = absolute(grandTotals.closingDebit - grandTotals.closingCredit);
  const isFilteredType = filters.type !== "all";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/25">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Trial Balance</h1>
            <p className="truncate text-xs text-muted-foreground">Opening, period, and closing balances across the General Ledger.</p>
          </div>
        </div>
        {canExport ? (
          <Button variant="outline" size="sm" asChild>
            <a href={buildTrialBalanceUrl(filters, "csv")} download>
              <Download className="size-4" />
              <span className="hidden sm:inline">Download CSV</span>
            </a>
          </Button>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Reporting period</CardTitle>
            <CardDescription>Dates use East Africa Time (EAT). Narrow the view without changing posted ledger entries.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_minmax(190px,1fr)_minmax(210px,1fr)_auto] xl:items-end">
            <DatePicker
              id="trial-balance-from"
              label="From"
              value={displayedFrom}
              maximum={displayedTo}
              onChange={(from) => setFilters((current) => ({ ...current, from }))}
            />
            <DatePicker
              id="trial-balance-to"
              label="To"
              value={displayedTo}
              minimum={displayedFrom}
              onChange={(to) => setFilters((current) => ({ ...current, to }))}
            />
            <div className="space-y-2">
              <Label htmlFor="trial-balance-account-type">Account type</Label>
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters((current) => ({ ...current, type: value as TrialBalanceTypeFilter }))}
              >
                <SelectTrigger id="trial-balance-account-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-9 items-center justify-between gap-4 rounded-md border px-3 py-2 xl:min-w-60">
              <div>
                <Label htmlFor="trial-balance-zero-activity" className="text-sm">Show zero activity</Label>
                <p className="text-xs text-muted-foreground">Include unused accounts</p>
              </div>
              <Switch
                id="trial-balance-zero-activity"
                checked={filters.includeZeroActivity}
                onCheckedChange={(includeZeroActivity) => setFilters((current) => ({ ...current, includeZeroActivity }))}
              />
            </div>
          </CardContent>
        </Card>

        {error ? <ErrorState message={error} onRetry={reload} /> : null}

        {!error && isLoading ? <LoadingState /> : null}

        {!error && !isLoading && report ? (
          <>
            <BalanceBanner
              totals={grandTotals}
              isBalanced={isBalanced}
              difference={difference}
              isFilteredType={isFilteredType}
              from={report.from || filters.from}
              to={report.to || filters.to}
            />

            {visibleRows.length === 0 ? (
              <EmptyState includeZeroActivity={filters.includeZeroActivity} />
            ) : (
              <TrialBalanceTable groups={groups} totals={grandTotals} />
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

function DatePicker({
  id,
  label,
  value,
  minimum,
  maximum,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  minimum?: string;
  maximum?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = dateKeyToCalendarDate(value);
  const disabledDates = [
    ...(minimum ? [{ before: dateKeyToCalendarDate(minimum) }] : []),
    ...(maximum ? [{ after: dateKeyToCalendarDate(maximum) }] : []),
  ];

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="w-full justify-start font-normal">
            <CalendarDays className="size-4 text-muted-foreground" />
            {formatDateKey(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (!date) {
                return;
              }
              onChange(calendarDateToDateKey(date));
              setOpen(false);
            }}
            disabled={disabledDates}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function BalanceBanner({
  totals,
  isBalanced,
  difference,
  isFilteredType,
  from,
  to,
}: {
  totals: TrialBalanceMinorTotals;
  isBalanced: boolean;
  difference: bigint;
  isFilteredType: boolean;
  from: string;
  to: string;
}) {
  const healthy = isBalanced && !isFilteredType;

  return (
    <Card className={cn(
      "overflow-hidden",
      healthy && "border-emerald-200 bg-emerald-50/70",
      !isBalanced && !isFilteredType && "border-destructive/30 bg-destructive/5",
    )}>
      <CardContent className="grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-start gap-3">
          {healthy ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          ) : isFilteredType ? (
            <FileSearch className="mt-0.5 size-5 shrink-0 text-primary" />
          ) : (
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          )}
          <div>
            <p className="font-semibold">
              {healthy ? "Trial balance is balanced" : isFilteredType ? "Filtered account view" : "Trial balance is out of balance"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateKey(from)}–{formatDateKey(to)}
              {isFilteredType ? " · Select all account types to run the full balance check." : ` · Difference ${formatTzsFromMinorUnits(difference)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums sm:flex-nowrap">
          <span className="rounded-md border bg-background/80 px-3 py-2">Debit {formatTzsFromMinorUnits(totals.closingDebit)}</span>
          <span className={cn("text-xl", isBalanced ? "text-emerald-700" : "text-destructive")}>{isBalanced ? "=" : "≠"}</span>
          <span className="rounded-md border bg-background/80 px-3 py-2">Credit {formatTzsFromMinorUnits(totals.closingCredit)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TrialBalanceTable({ groups, totals }: { groups: ReturnType<typeof groupTrialBalanceRows>; totals: TrialBalanceMinorTotals }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <Scale className="size-5 text-primary" />
          <CardTitle className="text-base">Account balances</CardTitle>
        </div>
        <CardDescription>Amounts are shown in whole Tanzanian shillings. Calculations retain exact minor units.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1420px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead rowSpan={2} className="sticky left-0 z-10 min-w-28 bg-muted/95 align-bottom">Account Code</TableHead>
                <TableHead rowSpan={2} className="min-w-64 align-bottom">Account Name</TableHead>
                <TableHead rowSpan={2} className="min-w-28 align-bottom">Account Type</TableHead>
                <TableHead colSpan={2} className="border-l text-center">Opening balance</TableHead>
                <TableHead colSpan={2} className="border-l text-center">Period activity</TableHead>
                <TableHead colSpan={2} className="border-l text-center">Closing balance</TableHead>
              </TableRow>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="border-l text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="border-l text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="border-l text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableGroup key={group.type} group={group} />
              ))}
              <TotalRow label="Grand total" totals={totals} emphasis="grand" />
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TableGroup({ group }: { group: ReturnType<typeof groupTrialBalanceRows>[number] }) {
  return (
    <>
      <TableRow className="border-t-2 bg-primary/5 hover:bg-primary/5">
        <TableCell colSpan={9} className="sticky left-0 font-semibold text-primary">{group.label}</TableCell>
      </TableRow>
      {group.rows.map((row) => <AccountRow key={row.account_code} row={row} />)}
      <TotalRow label={`${group.label} subtotal`} totals={group.totals} emphasis="subtotal" />
    </>
  );
}

function AccountRow({ row }: { row: TrialBalanceRow }) {
  return (
    <TableRow>
      <TableCell className="sticky left-0 z-[1] bg-background font-mono text-sm font-semibold">
        {row.account_code}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{row.account_name}</span>
          {isContraAccount(row) ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">Contra</Badge> : null}
        </div>
      </TableCell>
      <TableCell className="capitalize text-muted-foreground">{row.account_type}</TableCell>
      <MoneyCell amount={row.opening_debit} border />
      <MoneyCell amount={row.opening_credit} />
      <MoneyCell amount={row.period_debit} border />
      <MoneyCell amount={row.period_credit} />
      <MoneyCell amount={row.closing_debit} border strong />
      <MoneyCell amount={row.closing_credit} strong />
    </TableRow>
  );
}

function MoneyCell({ amount, border = false, strong = false }: { amount: string; border?: boolean; strong?: boolean }) {
  const minor = decimalToMinorUnits(amount);

  return (
    <TableCell className={cn("text-right tabular-nums", border && "border-l", strong && "font-medium")}>
      {minor === BigInt(0) ? <span className="text-muted-foreground">—</span> : formatTzsFromMinorUnits(minor)}
    </TableCell>
  );
}

function TotalRow({
  label,
  totals,
  emphasis,
}: {
  label: string;
  totals: TrialBalanceMinorTotals;
  emphasis: "subtotal" | "grand";
}) {
  return (
    <TableRow className={cn(
      "font-semibold hover:bg-muted/50",
      emphasis === "subtotal" ? "bg-muted/30" : "border-t-2 border-primary/30 bg-primary/10 text-base hover:bg-primary/10",
    )}>
      <TableCell colSpan={3} className={cn("sticky left-0 z-[1]", emphasis === "subtotal" ? "bg-muted" : "bg-primary/10")}>{label}</TableCell>
      <MinorMoneyCell value={totals.openingDebit} border />
      <MinorMoneyCell value={totals.openingCredit} />
      <MinorMoneyCell value={totals.periodDebit} border />
      <MinorMoneyCell value={totals.periodCredit} />
      <MinorMoneyCell value={totals.closingDebit} border />
      <MinorMoneyCell value={totals.closingCredit} />
    </TableRow>
  );
}

function MinorMoneyCell({ value, border = false }: { value: bigint; border?: boolean }) {
  return <TableCell className={cn("text-right tabular-nums", border && "border-l")}>{formatTzsFromMinorUnits(value)}</TableCell>;
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-7 animate-spin" />
        <p className="text-sm">Preparing the trial balance…</p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-start gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-destructive">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Trial balance could not be loaded</p>
            <p className="mt-1 text-sm">{message}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw className="size-4" />Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ includeZeroActivity }: { includeZeroActivity: boolean }) {
  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
        <FileSearch className="size-9 text-muted-foreground" />
        <p className="mt-4 font-semibold">No accounts match this view</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {includeZeroActivity
            ? "There are no ledger accounts for the selected period and account type."
            : "There is no activity for this period. Turn on “Show zero activity” to include unused accounts."}
        </p>
      </CardContent>
    </Card>
  );
}

function formatDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat("en-TZ", { day: "numeric", month: "short", year: "numeric" })
    .format(dateKeyToCalendarDate(dateKey));
}

function absolute(value: bigint): bigint {
  return value < BigInt(0) ? -value : value;
}
