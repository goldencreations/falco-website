"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Calculator, Upload, Send } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  customers,
  loanProducts,
  formatCurrency,
} from "@/lib/mock-data";
import type { Customer, LoanProduct } from "@/lib/types";

export default function NewApplicationPage() {
  const router = useRouter();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [formData, setFormData] = useState({
    amount: "",
    term: "",
    purpose: "",
    collateralType: "",
    collateralDescription: "",
    collateralValue: "",
    guarantorName: "",
    guarantorPhone: "",
    guarantorId: "",
    guarantorRelationship: "",
  });

  const filteredCustomers = customers.filter(
    (c) =>
      c.is_active &&
      !c.is_blacklisted &&
      (c.first_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.last_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.customer_number.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  const eligibleProducts = selectedCustomer
    ? loanProducts.filter(
        (p) =>
          p.is_active &&
          p.allowed_risk_grades.includes(selectedCustomer.risk_grade) &&
          (!p.min_credit_score ||
            (selectedCustomer.credit_score &&
              selectedCustomer.credit_score >= p.min_credit_score))
      )
    : [];

  // Calculate loan details
  const amount = parseFloat(formData.amount) || 0;
  const termDays = parseInt(formData.term) || 0;

  const calculateLoanDetails = () => {
    if (!selectedProduct || !amount || !termDays) return null;

    const processingFee = amount * (selectedProduct.processing_fee_percent / 100);
    const insuranceFee = amount * (selectedProduct.insurance_fee_percent / 100);
    const totalFees = processingFee + insuranceFee;

    let interest = 0;
    if (selectedProduct.interest_type === "flat") {
      interest = amount * (selectedProduct.interest_rate / 100) * (termDays / 365);
    } else {
      // Simplified reducing balance calculation
      const monthlyRate = selectedProduct.interest_rate / 100 / 12;
      const months = termDays / 30;
      interest = amount * monthlyRate * months * 0.6; // Approximation
    }

    const totalRepayment = amount + interest + totalFees;
    const installmentCount = Math.ceil(termDays / 30);
    const installmentAmount = totalRepayment / installmentCount;

    return {
      processingFee,
      insuranceFee,
      totalFees,
      interest,
      totalRepayment,
      installmentCount,
      installmentAmount,
    };
  };

  const loanDetails = calculateLoanDetails();

  const handleSubmit = (isDraft: boolean) => {
    // In production, this would call an API
    console.log("Submitting application:", {
      customerId: selectedCustomer?.id,
      productId: selectedProduct?.id,
      ...formData,
      isDraft,
    });
    router.push("/applications");
  };

  return (
    <>
      <DashboardHeader
        title="New Loan Application"
        description="Create a new loan application for a customer"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/applications">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Applications
            </Link>
          </Button>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Form */}
            <div className="space-y-6 lg:col-span-2">
              {/* Customer Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                  <CardDescription>
                    Search and select an existing customer
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedCustomer ? (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or customer number..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {customerSearch && (
                        <div className="max-h-48 space-y-2 overflow-auto">
                          {filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setCustomerSearch("");
                              }}
                              className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
                            >
                              <div>
                                <p className="font-medium">
                                  {customer.first_name} {customer.last_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {customer.customer_number} | {customer.phone_primary}
                                </p>
                              </div>
                              <Badge
                                variant={
                                  customer.risk_grade === "A"
                                    ? "default"
                                    : customer.risk_grade === "B"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                Grade {customer.risk_grade}
                              </Badge>
                            </button>
                          ))}
                          {filteredCustomers.length === 0 && (
                            <p className="py-4 text-center text-muted-foreground">
                              No customers found
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-start justify-between rounded-lg border border-border bg-muted/50 p-4">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {selectedCustomer.first_name} {selectedCustomer.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedCustomer.customer_number}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedCustomer.phone_primary}
                        </p>
                        <div className="flex gap-2 pt-1">
                          <Badge variant="secondary">
                            {selectedCustomer.customer_type}
                          </Badge>
                          <Badge
                            variant={
                              selectedCustomer.risk_grade === "A"
                                ? "default"
                                : selectedCustomer.risk_grade === "B"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            Grade {selectedCustomer.risk_grade}
                          </Badge>
                          {selectedCustomer.credit_score && (
                            <Badge variant="outline">
                              Score: {selectedCustomer.credit_score}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCustomer(null)}
                      >
                        Change
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Loan Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Loan Details</CardTitle>
                  <CardDescription>
                    Select product and enter loan amount
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Loan Product</FieldLabel>
                      <Select
                        value={selectedProduct?.id || ""}
                        onValueChange={(value) =>
                          setSelectedProduct(
                            loanProducts.find((p) => p.id === value) || null
                          )
                        }
                        disabled={!selectedCustomer}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              <div className="flex items-center gap-2">
                                <span>{product.name}</span>
                                <span className="text-muted-foreground">
                                  ({product.interest_rate}% {product.interest_type})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedProduct && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(selectedProduct.min_amount)} - {formatCurrency(selectedProduct.max_amount)} |{" "}
                          {selectedProduct.min_term_days} - {selectedProduct.max_term_days} days
                        </p>
                      )}
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>Requested Amount (TZS)</FieldLabel>
                        <Input
                          type="number"
                          placeholder="e.g., 1000000"
                          value={formData.amount}
                          onChange={(e) =>
                            setFormData({ ...formData, amount: e.target.value })
                          }
                          disabled={!selectedProduct}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Term (Days)</FieldLabel>
                        <Input
                          type="number"
                          placeholder="e.g., 30"
                          value={formData.term}
                          onChange={(e) =>
                            setFormData({ ...formData, term: e.target.value })
                          }
                          disabled={!selectedProduct}
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel>Purpose of Loan</FieldLabel>
                      <Textarea
                        placeholder="Describe the purpose of this loan..."
                        value={formData.purpose}
                        onChange={(e) =>
                          setFormData({ ...formData, purpose: e.target.value })
                        }
                        rows={3}
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              {/* Collateral */}
              <Card>
                <CardHeader>
                  <CardTitle>Collateral Information</CardTitle>
                  <CardDescription>Optional security for the loan</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>Collateral Type</FieldLabel>
                        <Select
                          value={formData.collateralType}
                          onValueChange={(value) =>
                            setFormData({ ...formData, collateralType: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vehicle">Vehicle</SelectItem>
                            <SelectItem value="property">Property/Land</SelectItem>
                            <SelectItem value="equipment">Equipment/Machinery</SelectItem>
                            <SelectItem value="inventory">Inventory/Stock</SelectItem>
                            <SelectItem value="savings">Savings/Deposit</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Estimated Value (TZS)</FieldLabel>
                        <Input
                          type="number"
                          placeholder="e.g., 5000000"
                          value={formData.collateralValue}
                          onChange={(e) =>
                            setFormData({ ...formData, collateralValue: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel>Description</FieldLabel>
                      <Textarea
                        placeholder="Describe the collateral..."
                        value={formData.collateralDescription}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            collateralDescription: e.target.value,
                          })
                        }
                        rows={2}
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              {/* Guarantor */}
              <Card>
                <CardHeader>
                  <CardTitle>Guarantor Information</CardTitle>
                  <CardDescription>Person who guarantees the loan</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>Full Name</FieldLabel>
                        <Input
                          placeholder="Guarantor's full name"
                          value={formData.guarantorName}
                          onChange={(e) =>
                            setFormData({ ...formData, guarantorName: e.target.value })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>National ID</FieldLabel>
                        <Input
                          placeholder="National ID number"
                          value={formData.guarantorId}
                          onChange={(e) =>
                            setFormData({ ...formData, guarantorId: e.target.value })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Phone Number</FieldLabel>
                        <Input
                          placeholder="+255 xxx xxx xxx"
                          value={formData.guarantorPhone}
                          onChange={(e) =>
                            setFormData({ ...formData, guarantorPhone: e.target.value })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Relationship</FieldLabel>
                        <Select
                          value={formData.guarantorRelationship}
                          onValueChange={(value) =>
                            setFormData({ ...formData, guarantorRelationship: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="sibling">Sibling</SelectItem>
                            <SelectItem value="relative">Other Relative</SelectItem>
                            <SelectItem value="friend">Friend</SelectItem>
                            <SelectItem value="colleague">Colleague</SelectItem>
                            <SelectItem value="business_partner">Business Partner</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </FieldGroup>
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader>
                  <CardTitle>Required Documents</CardTitle>
                  <CardDescription>
                    Upload supporting documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center">
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Drag and drop files here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse
                    </p>
                    <Button variant="outline" size="sm" className="mt-4">
                      Select Files
                    </Button>
                  </div>
                  {selectedProduct && (
                    <div className="mt-4">
                      <p className="text-sm font-medium">Required:</p>
                      <ul className="mt-1 text-sm text-muted-foreground">
                        {selectedProduct.required_documents.map((doc) => (
                          <li key={doc}>- {doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Loan Calculator */}
            <div className="space-y-6">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Loan Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loanDetails ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Principal</span>
                          <span className="font-medium">{formatCurrency(amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Interest</span>
                          <span className="font-medium">
                            {formatCurrency(loanDetails.interest)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Processing Fee</span>
                          <span className="font-medium">
                            {formatCurrency(loanDetails.processingFee)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Insurance Fee</span>
                          <span className="font-medium">
                            {formatCurrency(loanDetails.insuranceFee)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="font-medium">Total Repayment</span>
                          <span className="font-bold text-primary">
                            {formatCurrency(loanDetails.totalRepayment)}
                          </span>
                        </div>
                        <Separator />
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-sm text-muted-foreground">
                            Monthly Installment
                          </p>
                          <p className="text-xl font-bold">
                            {formatCurrency(loanDetails.installmentAmount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {loanDetails.installmentCount} installments
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Select a product and enter amount to see calculation
                    </p>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => handleSubmit(false)}
                      disabled={!selectedCustomer || !selectedProduct || !amount}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Submit Application
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSubmit(true)}
                      disabled={!selectedCustomer}
                    >
                      Save as Draft
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
