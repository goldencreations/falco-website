"use client";

import { useMemo, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import type { AccountantDashboardStats } from "@/lib/accountant-dashboard-metrics";
import type { SessionUser } from "@/lib/auth";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

function buildAssistantReply(prompt: string, stats: AccountantDashboardStats, userName: string): string {
 const q = prompt.toLowerCase();
 if (q.includes("discrep") || q.includes("reconcil") || q.includes("mismatch")) {
 return [
 `Hi ${userName.split(" ")[0] || "there"}, reconciliation for your branch:`,
 `• Matched: ${stats.reconciliation.matched}`,
 `• Manual review: ${stats.reconciliation.manual_review}`,
 `• Unmatched: ${stats.reconciliation.unmatched}`,
 `• Underpaid / overpaid: ${stats.reconciliation.underpaid} / ${stats.reconciliation.overpaid}`,
 `Payments collected (branch): ${formatCurrency(stats.paymentsCollectedTotal)}.`,
 "Open Reconciliation for payment-level detail.",
 ].join("\n");
 }
 if (q.includes("disburse")) {
 return [
 `Disbursements MTD: ${formatCurrency(stats.disbursementsMtdVolume)}.`,
 `${stats.disbursementsCompletedCount} completed, ${stats.disbursementsPendingCount} pending approval.`,
 `Portfolio outstanding: ${formatCurrency(stats.outstandingPortfolio)}.`,
 ].join(" ");
 }
 if (q.includes("collection") || q.includes("arrear")) {
 return [
 `Collections (metrics): ${formatCurrency(stats.collectionsAmount)}.`,
 `Collected today via payments: ${formatCurrency(stats.paymentsCollectedToday)}.`,
 `Collections queue: ${stats.collectionsQueueCount} loans, ${formatCurrency(stats.collectionsQueueOutstanding)} outstanding.`,
 `PAR ${stats.parRate.toFixed(1)}%, NPL ${stats.nplRate.toFixed(1)}%.`,
 ].join(" ");
 }
 if (q.includes("payment") || q.includes("loan")) {
 return [
 `Payments: ${formatCurrency(stats.paymentsCollectedTotal)} collected (${stats.paymentsCompletedCount} completed).`,
 `Active loans: ${stats.activeLoansCount} · Outstanding book: ${formatCurrency(stats.outstandingPortfolio)}.`,
 ].join(" ");
 }
 return [
 stats.insightText,
 `Totals — Payments: ${formatCurrency(stats.paymentsCollectedTotal)}, Collections: ${formatCurrency(stats.collectionsAmount)}, Disbursements MTD: ${formatCurrency(stats.disbursementsMtdVolume)}.`,
 ].join("\n");
}

export function AccountantAiAssistant({
 user,
 stats,
}: {
 user: SessionUser;
 stats: AccountantDashboardStats;
}) {
 const [messages, setMessages] = useState<ChatMessage[]>([
 {
 id: "welcome",
 role: "assistant",
 content: buildAssistantReply("", stats, user.full_name),
 },
 ]);
 const [input, setInput] = useState("");

 const monthlyBars = useMemo(() => {
 const max = Math.max(...stats.monthlyPaymentTotals.map((m) => m.amount), 1);
 return stats.monthlyPaymentTotals.map((m) => ({
 ...m,
 pct: Math.round((m.amount / max) * 100),
 }));
 }, [stats.monthlyPaymentTotals]);

 const send = () => {
 const text = input.trim();
 if (!text) return;
 setMessages((prev) => [
 ...prev,
 { id: `u-${Date.now()}`, role: "user", content: text },
 {
 id: `a-${Date.now()}`,
 role: "assistant",
 content: buildAssistantReply(text, stats, user.full_name),
 },
 ]);
 setInput("");
 };

 return (
 <Card className="flex h-full min-h-[420px] flex-col overflow-hidden border-emerald-200/60 shadow-md">
 <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
 <Sparkles className="h-4 w-4" />
 </div>
 <div>
 <p className="text-sm font-semibold">Finance Assistant</p>
 <p className="text-[11px] text-muted-foreground">Summaries from live branch APIs</p>
 </div>
 </div>

 <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
 {messages.map((msg) => (
 <div
 key={msg.id}
 className={msg.role === "user" ? "flex justify-end gap-2" : "flex justify-start gap-2"}
 >
 {msg.role === "assistant" ? (
 <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
 <Bot className="h-3.5 w-3.5" />
 </div>
 ) : null}
 <div
 className={
 msg.role === "user"
 ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-xs text-primary-foreground"
 : "max-w-[85%] whitespace-pre-line rounded-2xl rounded-tl-sm border border-border/70 bg-muted/40 px-3 py-2 text-xs text-foreground"
 }
 >
 {msg.content}
 </div>
 {msg.role === "user" ? (
 <Avatar className="h-7 w-7">
 <AvatarFallback className="text-[10px]">
 {(user.full_name || "U")
 .split(/\s+/)
 .map((p) => p[0])
 .join("")
 .slice(0, 2)}
 </AvatarFallback>
 </Avatar>
 ) : null}
 </div>
 ))}

 {monthlyBars.length > 0 ? (
 <div className="rounded-xl border border-border/60 bg-card/80 p-3">
 <p className="text-[11px] font-medium text-muted-foreground">Completed payments by month</p>
 <div className="mt-2 space-y-2">
 {monthlyBars.map((row) => (
 <div key={row.month}>
 <div className="flex justify-between text-[11px]">
 <span>{row.month}</span>
 <span className="font-medium tabular-nums">{formatCurrency(row.amount)}</span>
 </div>
 <Progress value={row.pct} className="mt-1 h-1.5" />
 </div>
 ))}
 </div>
 </div>
 ) : null}
 </div>

 <form
 className="flex gap-2 border-t border-border/60 p-3"
 onSubmit={(e) => {
 e.preventDefault();
 send();
 }}
 >
 <Input
 value={input}
 onChange={(e) => setInput(e.target.value)}
 placeholder="Ask about payments, collections, disbursements…"
 className="h-9 text-xs"
 />
 <Button type="submit" size="icon" className="h-9 w-9 shrink-0" aria-label="Send">
 <Send className="h-4 w-4" />
 </Button>
 </form>
 </Card>
 );
}
