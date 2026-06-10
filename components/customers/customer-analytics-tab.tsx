"use client";

import {
  Activity,
  CheckCircle2,
  FileText,
  PieChart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerPortfolioData } from "@/lib/customer-portfolio-detail";
import { formatCurrency } from "@/lib/formatters";
import type { LoanListRow } from "@/lib/loan-adapters";
import type { Customer, Payment } from "@/lib/types";

const CHART_COLORS = ["#0d9488", "#0891b2", "#6366f1", "#f59e0b", "#ef4444"];

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

type Props = {
  paymentTrend: CustomerPortfolioData["paymentTrend"];
  creditHistory: CustomerPortfolioData["creditHistory"];
  balanceSnapshot: CustomerPortfolioData["balanceSnapshot"];
  loanDistribution: CustomerPortfolioData["loanDistribution"];
  customerLoans: LoanListRow[];
  customerPayments: Payment[];
  applicationCount: number;
  activeLoans: LoanListRow[];
  completedLoans: LoanListRow[];
  onTimePayments: number;
  customer: Customer;
  risk: { label: string; color: string; bgColor: string };
  portfolioLoading?: boolean;
};

export function CustomerAnalyticsTab({
  paymentTrend,
  creditHistory,
  balanceSnapshot,
  loanDistribution,
  customerLoans,
  customerPayments,
  applicationCount,
  activeLoans,
  completedLoans,
  onTimePayments,
  customer,
  risk,
  portfolioLoading,
}: Props) {
  if (portfolioLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex h-[340px] items-center justify-center text-sm text-muted-foreground">
              Loading charts…
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Payment Trend (Last 8 Months)
            </CardTitle>
            <CardDescription>Expected vs actual payments over time</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentTrend.length === 0 || customerPayments.length === 0 ? (
              <ChartEmpty message="Payment trend appears when this customer has recorded payments." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={paymentTrend}>
                  <defs>
                    <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="expected"
                    name="Expected"
                    stroke="#0d9488"
                    strokeWidth={2}
                    fill="url(#colorExpected)"
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke="#0891b2"
                    strokeWidth={2}
                    fill="url(#colorActual)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-violet-600" />
              Credit Score History
            </CardTitle>
            <CardDescription>Score progression over time</CardDescription>
          </CardHeader>
          <CardContent>
            {creditHistory.length === 0 ? (
              <ChartEmpty message="Credit score history is shown when a credit score is on file." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={creditHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis domain={[300, 850]} tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name="Credit Score"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      dot={{ fill: "#8b5cf6", r: 4 }}
                      activeDot={{ r: 6, fill: "#7c3aed" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-xs text-muted-foreground">Poor (300-579)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-xs text-muted-foreground">Fair (580-669)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-muted-foreground">Good (670-850)</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5 text-amber-600" />
              Repaid vs Outstanding
            </CardTitle>
            <CardDescription>Live balances from the customer&apos;s loan book</CardDescription>
          </CardHeader>
          <CardContent>
            {customerLoans.length === 0 ? (
              <ChartEmpty message="No loans on record for this customer yet." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={balanceSnapshot} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="paid" name="Total repaid" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-5 w-5 text-cyan-600" />
              Loan Distribution by Product
            </CardTitle>
            <CardDescription>Breakdown of loans by product type</CardDescription>
          </CardHeader>
          <CardContent>
            {loanDistribution.length === 0 ? (
              <ChartEmpty message="Loan mix by product appears when the customer has disbursed loans." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <RechartsPie>
                  <Pie
                    data={loanDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: "#6b7280" }}
                  >
                    {loanDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </RechartsPie>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Payment Performance
            </CardTitle>
            <CardDescription>On-time payment rate by month</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentTrend.length === 0 || customerPayments.length === 0 ? (
              <ChartEmpty message="Payment completion rate by month requires payment history." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={paymentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                  <Bar dataKey="onTime" name="Completed share" radius={[4, 4, 0, 0]}>
                    {paymentTrend.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.onTime >= 90 ? "#10b981" : entry.onTime >= 70 ? "#f59e0b" : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Customer Summary Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Loan History
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Loans Taken</span>
                  <span className="font-semibold">{customerLoans.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Loans</span>
                  <span className="font-semibold text-cyan-600">{activeLoans.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed Loans</span>
                  <span className="font-semibold text-emerald-600">{completedLoans.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Defaulted Loans</span>
                  <span className="font-semibold text-red-600">
                    {customerLoans.filter((l) => l.status === "defaulted").length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Payment Behavior
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Payments Made</span>
                  <span className="font-semibold">{customerPayments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">On-Time Payments</span>
                  <span className="font-semibold text-emerald-600">{onTimePayments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Late Payments</span>
                  <span className="font-semibold text-amber-600">
                    {customerPayments.length - onTimePayments}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Applications</span>
                  <span className="font-semibold">{applicationCount}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Risk Assessment
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Risk Grade</span>
                  <Badge className={`${risk.bgColor} ${risk.color} border-0`}>{customer.risk_grade}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit Score</span>
                  <span className="font-semibold">{customer.credit_score || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Income Verified</span>
                  <span
                    className={
                      customer.income_verified
                        ? "text-emerald-600 font-semibold"
                        : "text-amber-600 font-semibold"
                    }
                  >
                    {customer.income_verified ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Relationship Age</span>
                  <span className="font-semibold">
                    {Math.floor(
                      (Date.now() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
                    )}{" "}
                    months
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
