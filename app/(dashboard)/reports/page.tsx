"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  Calendar,
  TrendingUp,
  AlertTriangle,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  loans,
  loanProducts,
  branches,
  agingReport,
  dashboardMetrics,
  formatCurrency,
} from "@/lib/mock-data";
import type { RiskClassification } from "@/lib/types";

// Mock data for reports
const monthlyData = [
  { month: "Aug", periodStart: "2023-08-01", disbursements: 45000000, collections: 38000000, newLoans: 28, closedLoans: 15 },
  { month: "Sep", periodStart: "2023-09-01", disbursements: 52000000, collections: 44000000, newLoans: 35, closedLoans: 22 },
  { month: "Oct", periodStart: "2023-10-01", disbursements: 48000000, collections: 46000000, newLoans: 32, closedLoans: 28 },
  { month: "Nov", periodStart: "2023-11-01", disbursements: 55000000, collections: 51000000, newLoans: 40, closedLoans: 32 },
  { month: "Dec", periodStart: "2023-12-01", disbursements: 42000000, collections: 48000000, newLoans: 25, closedLoans: 30 },
  { month: "Jan", periodStart: "2024-01-01", disbursements: 15866000, collections: 12500000, newLoans: 6, closedLoans: 4 },
];

const productPerformance = loanProducts.map((product) => {
  const productLoans = loans.filter((l) => l.product_id === product.id);
  const outstanding = productLoans.reduce((sum, l) => sum + l.total_outstanding, 0);
  const par = productLoans.filter((l) => l.days_in_arrears > 30).reduce((sum, l) => sum + l.total_outstanding, 0);
  return {
    name: product.name,
    code: product.code,
    loanCount: productLoans.length,
    outstanding,
    par,
    parRate: outstanding > 0 ? (par / outstanding) * 100 : 0,
  };
});

const branchPerformance = branches.map((branch) => {
  const branchLoans = loans.filter((l) => l.branch_id === branch.id);
  const outstanding = branchLoans.reduce((sum, l) => sum + l.total_outstanding, 0);
  const collected = branchLoans.reduce((sum, l) => sum + l.total_paid, 0);
  const disbursed = branchLoans.reduce((sum, l) => sum + l.principal_amount, 0);
  return {
    name: branch.name,
    code: branch.code,
    loanCount: branchLoans.length,
    outstanding,
    collected,
    disbursed,
    collectionRate: disbursed > 0 ? (collected / disbursed) * 100 : 0,
  };
});

const riskConfig: Record<RiskClassification, { label: string; color: string }> = {
  current: { label: "Current", color: "#22c55e" },
  especially_mentioned: { label: "Watch (1-30d)", color: "#eab308" },
  substandard: { label: "Substandard (31-90d)", color: "#f97316" },
  doubtful: { label: "Doubtful (91-180d)", color: "#ef4444" },
  loss: { label: "Loss (>180d)", color: "#1f2937" },
};

const provisionRates: Record<RiskClassification, number> = {
  current: 0,
  especially_mentioned: 5,
  substandard: 20,
  doubtful: 50,
  loss: 100,
};

function formatYAxis(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
}

export default function ReportsPage() {
  const [period, setPeriod] = useState("6m");
  const [startDate, setStartDate] = useState("2023-08-01");
  const [endDate, setEndDate] = useState("2024-01-31");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [exportScope, setExportScope] = useState<"all" | "portfolio" | "aging" | "products" | "branches">("all");

  const periodToRange = (selectedPeriod: string) => {
    const latestMonth = new Date("2024-01-31T00:00:00Z");
    const monthsBack = selectedPeriod === "1m" ? 1 : selectedPeriod === "3m" ? 3 : selectedPeriod === "6m" ? 6 : 12;
    const rangeStart = new Date(latestMonth);
    rangeStart.setUTCMonth(rangeStart.getUTCMonth() - (monthsBack - 1));
    rangeStart.setUTCDate(1);
    const toInputDate = (date: Date) => date.toISOString().slice(0, 10);
    setStartDate(toInputDate(rangeStart));
    setEndDate(toInputDate(latestMonth));
  };

  const filteredMonthlyData = monthlyData.filter((row) => {
    const rowDate = new Date(row.periodStart);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return rowDate >= start && rowDate <= end;
  });

  const handleExport = () => {
    const payload = {
      timeframe: { startDate, endDate },
      scope: exportScope,
      portfolio: exportScope === "all" || exportScope === "portfolio" ? filteredMonthlyData : [],
      aging: exportScope === "all" || exportScope === "aging" ? agingReport : [],
      products: exportScope === "all" || exportScope === "products" ? productPerformance : [],
      branches: exportScope === "all" || exportScope === "branches" ? branchPerformance : [],
    };

    const fileBase = `reports_${startDate}_to_${endDate}_${exportScope}`;
    if (exportFormat === "json") {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const csvRows: string[] = [];
    csvRows.push("section,metric_1,metric_2,metric_3,metric_4,metric_5");
    filteredMonthlyData.forEach((row) => {
      if (exportScope === "all" || exportScope === "portfolio") {
        csvRows.push(
          `portfolio_${row.month},${row.disbursements},${row.collections},${row.newLoans},${row.closedLoans},${row.periodStart}`
        );
      }
    });
    if (exportScope === "all" || exportScope === "aging") {
      agingReport.forEach((row) => {
        csvRows.push(
          `aging_${row.classification},${row.loan_count},${row.outstanding_amount},${row.provision_amount},${row.percentage},-`
        );
      });
    }
    if (exportScope === "all" || exportScope === "products") {
      productPerformance.forEach((row) => {
        csvRows.push(
          `product_${row.code},${row.loanCount},${row.outstanding},${row.par},${row.parRate.toFixed(2)},${row.name}`
        );
      });
    }
    if (exportScope === "all" || exportScope === "branches") {
      branchPerformance.forEach((row) => {
        csvRows.push(
          `branch_${row.code},${row.loanCount},${row.disbursed},${row.collected},${row.collectionRate.toFixed(2)},${row.outstanding}`
        );
      });
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPortfolio = loans.reduce((sum, l) => sum + l.total_outstanding, 0);
  const totalPAR = loans
    .filter((l) => l.days_in_arrears > 30)
    .reduce((sum, l) => sum + l.total_outstanding, 0);
  const parRatio = (totalPAR / totalPortfolio) * 100;

  const totalProvision = agingReport.reduce((sum, a) => sum + a.provision_amount, 0);

  return (
    <>
      <DashboardHeader
        title="Reports"
        description="Portfolio analysis and regulatory reports"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-36">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">Last Month</SelectItem>
                  <SelectItem value="3m">Last 3 Months</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => periodToRange(period)}>
                Apply Period to Dates
              </Button>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={exportScope} onValueChange={(value) => setExportScope(value as typeof exportScope)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Export Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reports</SelectItem>
                  <SelectItem value="portfolio">Portfolio</SelectItem>
                  <SelectItem value="aging">Aging</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="branches">Branches</SelectItem>
                </SelectContent>
              </Select>
              <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as "csv" | "json")}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export Reports
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalPortfolio)}</div>
                <div className="flex items-center gap-1 text-sm">
                  <ArrowUpRight className="h-4 w-4 text-accent" />
                  <span className="text-accent">+12.5%</span>
                  <span className="text-muted-foreground">vs last month</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Portfolio at Risk ({">"}30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(totalPAR)}</div>
                <div className="flex items-center gap-1 text-sm">
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">{parRatio.toFixed(1)}%</span>
                  <span className="text-muted-foreground">PAR ratio</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  NPL Ratio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardMetrics.npl_ratio}%</div>
                <p className="text-sm text-muted-foreground">Non-performing loans</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Required Provision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{formatCurrency(totalProvision)}</div>
                <p className="text-sm text-muted-foreground">Per BOT guidelines</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="portfolio" className="space-y-4">
            <TabsList>
              <TabsTrigger value="portfolio" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Portfolio
              </TabsTrigger>
              <TabsTrigger value="aging" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Aging Analysis
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-2">
                <PieChart className="h-4 w-4" />
                Products
              </TabsTrigger>
              <TabsTrigger value="branches" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Branches
              </TabsTrigger>
            </TabsList>

            {/* Portfolio Tab */}
            <TabsContent value="portfolio" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Disbursements vs Collections</CardTitle>
                    <CardDescription>Monthly comparison</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredMonthlyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={formatYAxis} />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                            }}
                          />
                          <Legend />
                          <Bar dataKey="disbursements" name="Disbursements" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="collections" name="Collections" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Growth</CardTitle>
                    <CardDescription>Outstanding balance trend</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={filteredMonthlyData}>
                          <defs>
                            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={formatYAxis} />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="disbursements"
                            name="Portfolio"
                            stroke="hsl(var(--primary))"
                            fill="url(#portfolioGrad)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Loan Activity Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Disbursements</TableHead>
                        <TableHead className="text-right">Collections</TableHead>
                        <TableHead className="text-right">New Loans</TableHead>
                        <TableHead className="text-right">Closed Loans</TableHead>
                        <TableHead className="text-right">Net Growth</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMonthlyData.map((month) => (
                        <TableRow key={month.month}>
                          <TableCell className="font-medium">{month.month}</TableCell>
                          <TableCell className="text-right">{formatCurrency(month.disbursements)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(month.collections)}</TableCell>
                          <TableCell className="text-right">{month.newLoans}</TableCell>
                          <TableCell className="text-right">{month.closedLoans}</TableCell>
                          <TableCell className="text-right">
                            <span className={month.newLoans - month.closedLoans >= 0 ? "text-accent" : "text-destructive"}>
                              {month.newLoans - month.closedLoans >= 0 ? "+" : ""}
                              {month.newLoans - month.closedLoans}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aging Analysis Tab */}
            <TabsContent value="aging" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Aging (BOT Classification)</CardTitle>
                    <CardDescription>Based on Bank of Tanzania guidelines</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={agingReport.filter((a) => a.outstanding_amount > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="outstanding_amount"
                            nameKey="classification"
                          >
                            {agingReport.map((entry) => (
                              <Cell
                                key={entry.classification}
                                fill={riskConfig[entry.classification].color}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                            }}
                          />
                          <Legend
                            formatter={(value) => riskConfig[value as RiskClassification]?.label || value}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Provision Requirements</CardTitle>
                    <CardDescription>Based on classification and BOT rates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Classification</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead className="text-center">Rate</TableHead>
                          <TableHead className="text-right">Provision</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agingReport.map((item) => (
                          <TableRow key={item.classification}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: riskConfig[item.classification].color }}
                                />
                                {riskConfig[item.classification].label}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.outstanding_amount)}</TableCell>
                            <TableCell className="text-center">{provisionRates[item.classification]}%</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(item.provision_amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(agingReport.reduce((s, a) => s + a.outstanding_amount, 0))}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right text-warning">
                            {formatCurrency(agingReport.reduce((s, a) => s + a.provision_amount, 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products">
              <Card>
                <CardHeader>
                  <CardTitle>Product Performance</CardTitle>
                  <CardDescription>Portfolio breakdown by loan product</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Active Loans</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">PAR ({">"}30d)</TableHead>
                        <TableHead className="text-right">PAR Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productPerformance.map((product) => (
                        <TableRow key={product.code}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground">{product.code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{product.loanCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.outstanding)}</TableCell>
                          <TableCell className="text-right text-destructive">{formatCurrency(product.par)}</TableCell>
                          <TableCell className="text-right">
                            <span className={product.parRate > 10 ? "text-destructive" : product.parRate > 5 ? "text-warning" : "text-accent"}>
                              {product.parRate.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Branches Tab */}
            <TabsContent value="branches">
              <Card>
                <CardHeader>
                  <CardTitle>Branch Performance</CardTitle>
                  <CardDescription>Portfolio breakdown by branch</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-center">Active Loans</TableHead>
                        <TableHead className="text-right">Disbursed</TableHead>
                        <TableHead className="text-right">Collected</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Collection Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchPerformance.map((branch) => (
                        <TableRow key={branch.code}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{branch.name}</p>
                              <p className="text-sm text-muted-foreground">{branch.code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{branch.loanCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(branch.disbursed)}</TableCell>
                          <TableCell className="text-right text-accent">{formatCurrency(branch.collected)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(branch.outstanding)}</TableCell>
                          <TableCell className="text-right">
                            <span className={branch.collectionRate > 80 ? "text-accent" : branch.collectionRate > 60 ? "text-warning" : "text-destructive"}>
                              {branch.collectionRate.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
