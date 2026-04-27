"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Percent,
  Calendar,
  Wallet,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  loanProducts,
  loans,
  formatCurrency,
} from "@/lib/mock-data";

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = loanProducts.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <DashboardHeader
        title="Loan Products"
        description="Configure and manage loan products"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Product
            </Button>
          </div>

          {/* Products Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {filteredProducts.map((product) => {
              const productLoans = loans.filter((l) => l.product_id === product.id);
              const activeLoans = productLoans.filter(
                (l) => l.status === "active" || l.status === "in_arrears"
              );
              const totalOutstanding = activeLoans.reduce(
                (sum, l) => sum + l.total_outstanding,
                0
              );

              return (
                <Card key={product.id} className={!product.is_active ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {product.name}
                          {product.is_active ? (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {product.code} | {product.description}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Loan Parameters */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Wallet className="h-3 w-3" />
                          Loan Amount Range
                        </p>
                        <p className="text-sm font-medium">
                          {formatCurrency(product.min_amount)} - {formatCurrency(product.max_amount)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Term Range
                        </p>
                        <p className="text-sm font-medium">
                          {product.min_term_days} - {product.max_term_days} days
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Interest & Fees */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          Interest Rate
                        </p>
                        <p className="text-lg font-bold text-primary">
                          {product.interest_rate}%
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {product.interest_type.replace("_", " ")}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Processing Fee</p>
                        <p className="text-sm font-medium">{product.processing_fee_percent}%</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Insurance Fee</p>
                        <p className="text-sm font-medium">{product.insurance_fee_percent}%</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Eligibility */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Eligible Risk Grades</p>
                      <div className="flex gap-1">
                        {["A", "B", "C", "D", "E"].map((grade) => (
                          <Badge
                            key={grade}
                            variant={product.allowed_risk_grades.includes(grade as "A" | "B" | "C" | "D" | "E") ? "default" : "outline"}
                            className="text-xs"
                          >
                            {grade}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Required Documents */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Required Documents</p>
                      <div className="flex flex-wrap gap-1">
                        {product.required_documents.map((doc) => (
                          <Badge key={doc} variant="secondary" className="text-xs">
                            {doc}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Portfolio Stats */}
                    <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Active Loans</p>
                        <p className="text-lg font-bold">{activeLoans.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className="text-lg font-bold">{formatCurrency(totalOutstanding)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
