"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Upload,
  Send,
  Plus,
  Trash2,
  MapPin,
  LocateFixed,
} from "lucide-react";
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

  const [collaterals, setCollaterals] = useState([
    { type: "", description: "", value: "", image: null as File | null },
  ]);

  const [guarantors, setGuarantors] = useState([
    {
      name: "",
      phone: "",
      nationalId: "",
      relationship: "",
      otherRelationship: "",
      idFront: null as File | null,
      idBack: null as File | null,
    },
  ]);

  const [references, setReferences] = useState([
    { name: "", relationship: "", phone: "", address: "" },
  ]);

  const [generalAttachments, setGeneralAttachments] = useState<FileList | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [formData, setFormData] = useState({
    amount: "",
    term: "",
    purpose: "",
    latitude: "",
    longitude: "",
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

  const updateCollateral = (
    index: number,
    key: "type" | "description" | "value" | "image",
    value: string | File | null
  ) => {
    setCollaterals((prev) =>
      prev.map((collateral, i) =>
        i === index ? { ...collateral, [key]: value } : collateral
      )
    );
  };

  const updateGuarantor = (
    index: number,
    key:
      | "name"
      | "phone"
      | "nationalId"
      | "relationship"
      | "otherRelationship"
      | "idFront"
      | "idBack",
    value: string | File | null
  ) => {
    setGuarantors((prev) =>
      prev.map((guarantor, i) => (i === index ? { ...guarantor, [key]: value } : guarantor))
    );
  };

  const updateReference = (
    index: number,
    key: "name" | "relationship" | "phone" | "address",
    value: string
  ) => {
    setReferences((prev) =>
      prev.map((reference, i) => (i === index ? { ...reference, [key]: value } : reference))
    );
  };

  const setBrowserLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = (isDraft: boolean) => {
    // In production, this would call an API
    console.log("Submitting application:", {
      customerId: selectedCustomer?.id,
      productId: selectedProduct?.id,
      ...formData,
      collaterals: collaterals.map((c) => ({
        ...c,
        image: c.image?.name ?? null,
      })),
      guarantors: guarantors.map((g) => ({
        ...g,
        relationship: g.relationship === "other" ? g.otherRelationship : g.relationship,
        idFront: g.idFront?.name ?? null,
        idBack: g.idBack?.name ?? null,
      })),
      references,
      generalAttachments: generalAttachments ? Array.from(generalAttachments).map((f) => f.name) : [],
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
                  <CardDescription>Add one or more collaterals and images</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {collaterals.map((collateral, index) => (
                    <div key={index} className="rounded-lg border border-border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Collateral {index + 1}</p>
                        {collaterals.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setCollaterals((prev) => prev.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FieldGroup>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field>
                            <FieldLabel>Collateral Type</FieldLabel>
                            <Input
                              placeholder="e.g., Motorcycle, TV, Land title"
                              value={collateral.type}
                              onChange={(e) => updateCollateral(index, "type", e.target.value)}
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Estimated Value (TZS)</FieldLabel>
                            <Input
                              type="number"
                              placeholder="e.g., 5000000"
                              value={collateral.value}
                              onChange={(e) => updateCollateral(index, "value", e.target.value)}
                            />
                          </Field>
                        </div>
                        <Field>
                          <FieldLabel>Description</FieldLabel>
                          <Textarea
                            placeholder="Describe the collateral..."
                            value={collateral.description}
                            onChange={(e) =>
                              updateCollateral(index, "description", e.target.value)
                            }
                            rows={2}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Collateral Image Attachment</FieldLabel>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateCollateral(index, "image", e.target.files?.[0] ?? null)
                            }
                          />
                          {collateral.image && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Attached: {collateral.image.name}
                            </p>
                          )}
                        </Field>
                      </FieldGroup>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setCollaterals((prev) => [
                        ...prev,
                        { type: "", description: "", value: "", image: null },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Collateral
                  </Button>
                </CardContent>
              </Card>

              {/* Guarantor */}
              <Card>
                <CardHeader>
                  <CardTitle>Guarantor Information</CardTitle>
                  <CardDescription>Add one or more guarantors and ID attachments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {guarantors.map((guarantor, index) => (
                    <div key={index} className="rounded-lg border border-border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Guarantor {index + 1}</p>
                        {guarantors.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setGuarantors((prev) => prev.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FieldGroup>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field>
                            <FieldLabel>Full Name</FieldLabel>
                            <Input
                              placeholder="Guarantor's full name"
                              value={guarantor.name}
                              onChange={(e) => updateGuarantor(index, "name", e.target.value)}
                            />
                          </Field>
                          <Field>
                            <FieldLabel>National ID</FieldLabel>
                            <Input
                              placeholder="National ID number"
                              value={guarantor.nationalId}
                              onChange={(e) =>
                                updateGuarantor(index, "nationalId", e.target.value)
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Phone Number</FieldLabel>
                            <Input
                              placeholder="+255 xxx xxx xxx"
                              value={guarantor.phone}
                              onChange={(e) => updateGuarantor(index, "phone", e.target.value)}
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Relationship</FieldLabel>
                            <Select
                              value={guarantor.relationship}
                              onValueChange={(value) =>
                                updateGuarantor(index, "relationship", value)
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
                                <SelectItem value="other">Other (Specify)</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                        {guarantor.relationship === "other" && (
                          <Field>
                            <FieldLabel>Specify Relationship</FieldLabel>
                            <Input
                              placeholder="Enter custom relationship"
                              value={guarantor.otherRelationship}
                              onChange={(e) =>
                                updateGuarantor(index, "otherRelationship", e.target.value)
                              }
                            />
                          </Field>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field>
                            <FieldLabel>Guarantor ID Front</FieldLabel>
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) =>
                                updateGuarantor(index, "idFront", e.target.files?.[0] ?? null)
                              }
                            />
                            {guarantor.idFront && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Attached: {guarantor.idFront.name}
                              </p>
                            )}
                          </Field>
                          <Field>
                            <FieldLabel>Guarantor ID Back</FieldLabel>
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) =>
                                updateGuarantor(index, "idBack", e.target.files?.[0] ?? null)
                              }
                            />
                            {guarantor.idBack && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Attached: {guarantor.idBack.name}
                              </p>
                            )}
                          </Field>
                        </div>
                      </FieldGroup>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setGuarantors((prev) => [
                        ...prev,
                        {
                          name: "",
                          phone: "",
                          nationalId: "",
                          relationship: "",
                          otherRelationship: "",
                          idFront: null,
                          idBack: null,
                        },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Guarantor
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reference Information</CardTitle>
                  <CardDescription>
                    Add friends or family contacts reachable if customer is unavailable
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {references.map((reference, index) => (
                    <div key={index} className="rounded-lg border border-border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Reference {index + 1}</p>
                        {references.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setReferences((prev) => prev.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel>Full Name</FieldLabel>
                          <Input
                            placeholder="Reference full name"
                            value={reference.name}
                            onChange={(e) => updateReference(index, "name", e.target.value)}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Relationship</FieldLabel>
                          <Input
                            placeholder="e.g., Friend, Cousin, Neighbor"
                            value={reference.relationship}
                            onChange={(e) =>
                              updateReference(index, "relationship", e.target.value)
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Phone Number</FieldLabel>
                          <Input
                            placeholder="+255 xxx xxx xxx"
                            value={reference.phone}
                            onChange={(e) => updateReference(index, "phone", e.target.value)}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Address / Location</FieldLabel>
                          <Input
                            placeholder="Where this reference can be found"
                            value={reference.address}
                            onChange={(e) => updateReference(index, "address", e.target.value)}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setReferences((prev) => [
                        ...prev,
                        { name: "", relationship: "", phone: "", address: "" },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Reference
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Customer Location</CardTitle>
                  <CardDescription>
                    Capture latitude and longitude and preview customer location on map
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Latitude</FieldLabel>
                      <Input
                        type="number"
                        step="any"
                        placeholder="-6.7924"
                        value={formData.latitude}
                        onChange={(e) =>
                          setFormData({ ...formData, latitude: e.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Longitude</FieldLabel>
                      <Input
                        type="number"
                        step="any"
                        placeholder="39.2083"
                        value={formData.longitude}
                        onChange={(e) =>
                          setFormData({ ...formData, longitude: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={setBrowserLocation}
                    disabled={isLocating}
                  >
                    <LocateFixed className="mr-2 h-4 w-4" />
                    {isLocating ? "Getting browser location..." : "Use Browser Location"}
                  </Button>
                  {formData.latitude && formData.longitude && (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2 text-sm">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>
                          {formData.latitude}, {formData.longitude}
                        </span>
                      </div>
                      <iframe
                        title="Customer location map"
                        src={`https://maps.google.com/maps?q=${formData.latitude},${formData.longitude}&z=15&output=embed`}
                        className="h-64 w-full"
                        loading="lazy"
                      />
                    </div>
                  )}
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
                    <Input
                      type="file"
                      multiple
                      className="mt-4 max-w-xs"
                      onChange={(e) => setGeneralAttachments(e.target.files)}
                    />
                  </div>
                  {generalAttachments && generalAttachments.length > 0 && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      {Array.from(generalAttachments).map((file) => (
                        <p key={file.name}>- {file.name}</p>
                      ))}
                    </div>
                  )}
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

            {/* Sidebar - Application Actions */}
            <div className="space-y-6">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Application Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loanDetails && (
                    <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                      Product-based estimate from selected product:{" "}
                      {formatCurrency(loanDetails.totalRepayment)} total repayment.
                    </div>
                  )}

                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/loan-calculator">Open Standalone Loan Calculator</Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/credit-analysis">Go to Credit Analysis</Link>
                  </Button>

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
