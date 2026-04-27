"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { agingReport, formatCurrency } from "@/lib/mock-data";

const COLORS = {
  current: "hsl(var(--chart-2))",
  especially_mentioned: "hsl(var(--chart-3))",
  substandard: "hsl(var(--chart-5))",
  doubtful: "hsl(var(--chart-4))",
  loss: "hsl(var(--foreground))",
};

const LABELS = {
  current: "Current",
  especially_mentioned: "Watch (1-30)",
  substandard: "Substandard (31-90)",
  doubtful: "Doubtful (91-180)",
  loss: "Loss (>180)",
};

export function AgingChart() {
  const data = agingReport
    .filter((item) => item.outstanding_amount > 0)
    .map((item) => ({
      name: LABELS[item.classification],
      value: item.outstanding_amount,
      percentage: item.percentage,
      classification: item.classification,
      loanCount: item.loan_count,
    }));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Portfolio Aging</CardTitle>
        <CardDescription>BOT classification breakdown by outstanding balance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={2}
                stroke="hsl(var(--card))"
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.classification}
                    fill={COLORS[entry.classification as keyof typeof COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                formatter={(value) => (
                  <span className="text-xs text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 space-y-2">
          {agingReport.map((item) => (
            <div
              key={item.classification}
              className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-3 w-3 rounded-full ring-2 ring-background"
                  style={{
                    backgroundColor:
                      COLORS[item.classification as keyof typeof COLORS],
                  }}
                />
                <span className="text-muted-foreground font-medium">
                  {LABELS[item.classification as keyof typeof LABELS]}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {item.loan_count} loans
                </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(item.outstanding_amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
