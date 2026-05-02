"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Save, UserPlus, Users } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { branches, currentUser, users } from "@/lib/mock-data";

type CustomerStatus =
  | "pending_registration_fee"
  | "active"
  | "suspended"
  | "blacklisted"
  | "inactive";

type RiskLevel = "low" | "medium" | "high" | "critical";

type CustomerCreateForm = {
  full_name: string;
  phone: string;
  alt_phone: string;
  email: string;
  physical_address: string;
  street: string;
  ward: string;
  district: string;
  region: string;
  national_id: string;
  id_type: string;
  occupation: string;
  employer_name: string;
  employer_address: string;
  employer_phone: string;
  employment_start_date: string;
  monthly_income: string;
  business_name: string;
  business_type: string;
  business_address: string;
  business_registration_no: string;
  years_in_business: string;
  cheque_number: string;
  payment_reference: string;
  registration_fee_paid: boolean;
  registration_fee_amount: string;
  registration_fee_paid_at: string;
  status: CustomerStatus;
  risk_level: RiskLevel;
  risk_score: string;
  notes: string;
  branch_id: string;
  loan_officer_id: string;
  created_by: string;
};

type PlaceSuggestion = {
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    municipality?: string;
  };
};

const STATUS_OPTIONS: Array<{ value: CustomerStatus; label: string }> = [
  { value: "pending_registration_fee", label: "Pending Registration Fee" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "inactive", label: "Inactive" },
];

const RISK_LEVEL_OPTIONS: Array<{ value: RiskLevel; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const ID_TYPE_OPTIONS = ["NIDA", "Passport", "Driving License", "Voter ID"];

const defaultForm: CustomerCreateForm = {
  full_name: "",
  phone: "",
  alt_phone: "",
  email: "",
  physical_address: "",
  street: "",
  ward: "",
  district: "",
  region: "",
  national_id: "",
  id_type: "NIDA",
  occupation: "",
  employer_name: "",
  employer_address: "",
  employer_phone: "",
  employment_start_date: "",
  monthly_income: "",
  business_name: "",
  business_type: "",
  business_address: "",
  business_registration_no: "",
  years_in_business: "",
  cheque_number: "",
  payment_reference: "",
  registration_fee_paid: false,
  registration_fee_amount: "",
  registration_fee_paid_at: "",
  status: "pending_registration_fee",
  risk_level: "low",
  risk_score: "0",
  notes: "",
  branch_id: "",
  loan_officer_id: "",
  created_by: currentUser.id,
};

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState<CustomerCreateForm>(defaultForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [streetSuggestions, setStreetSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingPlaceSuggestions, setLoadingPlaceSuggestions] = useState(false);
  const [loadingStreetSuggestions, setLoadingStreetSuggestions] = useState(false);
  const [activePlaceSuggestionIndex, setActivePlaceSuggestionIndex] = useState(-1);
  const [activeStreetSuggestionIndex, setActiveStreetSuggestionIndex] = useState(-1);

  const branchOptions = useMemo(() => branches.filter((branch) => branch.is_active), []);
  const loanOfficerOptions = useMemo(
    () =>
      users.filter(
        (user) =>
          user.role === "loan_officer" &&
          user.is_active &&
          (!form.branch_id || user.branch_id === form.branch_id)
      ),
    [form.branch_id]
  );

  const selectedBranch = branchOptions.find((branch) => branch.id === form.branch_id);

  const updateField = <K extends keyof CustomerCreateForm>(key: K, value: CustomerCreateForm[K]) => {
    setForm((prev) => {
      if (key === "branch_id") {
        return { ...prev, branch_id: value as string, loan_officer_id: "" };
      }
      return { ...prev, [key]: value };
    });
  };

  const searchLocation = async (query: string) => {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      countrycodes: "tz",
      limit: "5",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as PlaceSuggestion[];
  };

  useEffect(() => {
    const value = form.physical_address.trim();
    if (value.length < 3) {
      setPlaceSuggestions([]);
      setActivePlaceSuggestionIndex(-1);
      setLoadingPlaceSuggestions(false);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoadingPlaceSuggestions(true);
      try {
        const results = await searchLocation(value);
        setPlaceSuggestions(results);
        setActivePlaceSuggestionIndex(results.length > 0 ? 0 : -1);
      } catch {
        setPlaceSuggestions([]);
        setActivePlaceSuggestionIndex(-1);
      } finally {
        setLoadingPlaceSuggestions(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [form.physical_address]);

  useEffect(() => {
    const value = form.street.trim();
    if (value.length < 2) {
      setStreetSuggestions([]);
      setActiveStreetSuggestionIndex(-1);
      setLoadingStreetSuggestions(false);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoadingStreetSuggestions(true);
      const context = [form.district, form.region, "Tanzania"].filter(Boolean).join(", ");
      try {
        const results = await searchLocation(`${value}, ${context}`);
        setStreetSuggestions(results);
        setActiveStreetSuggestionIndex(results.length > 0 ? 0 : -1);
      } catch {
        setStreetSuggestions([]);
        setActiveStreetSuggestionIndex(-1);
      } finally {
        setLoadingStreetSuggestions(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [form.street, form.district, form.region]);

  const applySuggestionToForm = (suggestion: PlaceSuggestion, options?: { physicalOnly?: boolean }) => {
    const address = suggestion.address;
    const road = address?.road ?? "";
    const ward = address?.suburb ?? address?.neighbourhood ?? "";
    const district = address?.city_district ?? address?.county ?? "";
    const region = address?.state ?? address?.city ?? address?.town ?? address?.municipality ?? address?.village ?? "";

    setForm((prev) => ({
      ...prev,
      physical_address: suggestion.display_name || prev.physical_address,
      street: options?.physicalOnly ? prev.street : road || prev.street,
      ward: ward || prev.ward,
      district: district || prev.district,
      region: region || prev.region,
    }));
  };

  const handlePhysicalAddressKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (placeSuggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActivePlaceSuggestionIndex((prev) => (prev + 1) % placeSuggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActivePlaceSuggestionIndex((prev) => (prev <= 0 ? placeSuggestions.length - 1 : prev - 1));
      return;
    }
    if (event.key === "Enter" && activePlaceSuggestionIndex >= 0) {
      event.preventDefault();
      applySuggestionToForm(placeSuggestions[activePlaceSuggestionIndex], { physicalOnly: true });
      setPlaceSuggestions([]);
      setActivePlaceSuggestionIndex(-1);
      return;
    }
    if (event.key === "Escape") {
      setPlaceSuggestions([]);
      setActivePlaceSuggestionIndex(-1);
    }
  };

  const handleStreetKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (streetSuggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveStreetSuggestionIndex((prev) => (prev + 1) % streetSuggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveStreetSuggestionIndex((prev) => (prev <= 0 ? streetSuggestions.length - 1 : prev - 1));
      return;
    }
    if (event.key === "Enter" && activeStreetSuggestionIndex >= 0) {
      event.preventDefault();
      applySuggestionToForm(streetSuggestions[activeStreetSuggestionIndex]);
      setStreetSuggestions([]);
      setActiveStreetSuggestionIndex(-1);
      return;
    }
    if (event.key === "Escape") {
      setStreetSuggestions([]);
      setActiveStreetSuggestionIndex(-1);
    }
  };

  const validate = () => {
    if (!form.full_name.trim()) return "Full name is required.";
    if (!form.phone.trim()) return "Primary phone number is required.";
    if (!form.physical_address.trim()) return "Physical address is required.";
    if (!form.national_id.trim()) return "National ID is required.";
    if (!form.payment_reference.trim()) return "Payment reference is required.";
    if (!form.branch_id) return "Please select a branch.";
    if (!form.loan_officer_id) return "Please assign a loan officer.";
    return "";
  };

  const buildPayload = () => ({
    full_name: form.full_name.trim(),
    phone: form.phone.trim(),
    alt_phone: form.alt_phone.trim() || null,
    email: form.email.trim() || null,
    physical_address: form.physical_address.trim(),
    street: form.street.trim() || null,
    ward: form.ward.trim() || null,
    district: form.district.trim() || null,
    region: form.region.trim() || null,
    national_id: form.national_id.trim(),
    id_type: form.id_type,
    occupation: form.occupation.trim() || null,
    employer_name: form.employer_name.trim() || null,
    employer_address: form.employer_address.trim() || null,
    employer_phone: form.employer_phone.trim() || null,
    employment_start_date: form.employment_start_date || null,
    monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
    business_name: form.business_name.trim() || null,
    business_type: form.business_type.trim() || null,
    business_address: form.business_address.trim() || null,
    business_registration_no: form.business_registration_no.trim() || null,
    years_in_business: form.years_in_business ? Number(form.years_in_business) : null,
    cheque_number: form.cheque_number.trim() || null,
    payment_reference: form.payment_reference.trim(),
    registration_fee_paid: form.registration_fee_paid,
    registration_fee_amount: form.registration_fee_amount ? Number(form.registration_fee_amount) : null,
    registration_fee_paid_at: form.registration_fee_paid_at || null,
    status: form.status,
    risk_level: form.risk_level,
    risk_score: Number(form.risk_score || 0),
    notes: form.notes.trim() || null,
    loan_officer_id: form.loan_officer_id,
    branch_id: form.branch_id,
    created_by: form.created_by,
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    const payload = buildPayload();
    const customerEndpoint = process.env.NEXT_PUBLIC_CUSTOMERS_API_URL || "/api/customers";

    setSubmitting(true);
    try {
      const response = await fetch(customerEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Customer create failed with status ${response.status}`);
      }

      router.push("/customers");
    } catch (submitError) {
      console.error("create customer request", payload, submitError);
      setError(
        "Unable to submit to backend now. Form payload is backend-ready and logged in console for integration checks."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DashboardHeader
        title="Create Customer"
        description="Capture complete customer details aligned with the customers database table."
      />
      <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-4 pb-10 lg:p-6 lg:pb-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-800">Customer Onboarding Workspace</p>
              <p className="text-xs text-muted-foreground">
                Smart assignment enabled: selecting a branch automatically filters available loan officers.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/customers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Customers
              </Link>
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Assignment & System Controls</CardTitle>
                    <CardDescription>
                      Required system linkage fields for backend processing and workflow ownership.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="branch">Branch</Label>
                        <Select value={form.branch_id} onValueChange={(value) => updateField("branch_id", value)}>
                          <SelectTrigger id="branch">
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branchOptions.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name} ({branch.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loan-officer">Loan Officer</Label>
                        <Select
                          value={form.loan_officer_id}
                          onValueChange={(value) => updateField("loan_officer_id", value)}
                          disabled={!form.branch_id}
                        >
                          <SelectTrigger id="loan-officer">
                            <SelectValue
                              placeholder={form.branch_id ? "Select loan officer" : "Select branch first"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {loanOfficerOptions.map((officer) => (
                              <SelectItem key={officer.id} value={officer.id}>
                                {officer.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={form.status} onValueChange={(value) => updateField("status", value as CustomerStatus)}>
                          <SelectTrigger id="status">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment-reference">Payment Reference</Label>
                        <Input
                          id="payment-reference"
                          value={form.payment_reference}
                          onChange={(event) => updateField("payment_reference", event.target.value)}
                          placeholder="e.g., REF-FFS-2026-00012"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Personal & Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="full-name">Full Name</Label>
                        <Input
                          id="full-name"
                          value={form.full_name}
                          onChange={(event) => updateField("full_name", event.target.value)}
                          placeholder="Customer full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Primary Phone</Label>
                        <Input
                          id="phone"
                          value={form.phone}
                          onChange={(event) => updateField("phone", event.target.value)}
                          placeholder="+255 xxx xxx xxx"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="alt-phone">Alternative Phone</Label>
                        <Input
                          id="alt-phone"
                          value={form.alt_phone}
                          onChange={(event) => updateField("alt_phone", event.target.value)}
                          placeholder="+255 xxx xxx xxx"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(event) => updateField("email", event.target.value)}
                          placeholder="name@email.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="id-type">ID Type</Label>
                        <Select value={form.id_type} onValueChange={(value) => updateField("id_type", value)}>
                          <SelectTrigger id="id-type">
                            <SelectValue placeholder="Choose ID type" />
                          </SelectTrigger>
                          <SelectContent>
                            {ID_TYPE_OPTIONS.map((idType) => (
                              <SelectItem key={idType} value={idType}>
                                {idType}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="national-id">National ID / Identifier</Label>
                        <Input
                          id="national-id"
                          value={form.national_id}
                          onChange={(event) => updateField("national_id", event.target.value)}
                          placeholder="Unique national identification"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Address Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="physical-address">Physical Address</Label>
                      <div className="relative">
                        <Textarea
                          id="physical-address"
                          value={form.physical_address}
                          onChange={(event) => updateField("physical_address", event.target.value)}
                          onKeyDown={handlePhysicalAddressKeyDown}
                          rows={3}
                          placeholder="Type area/place, e.g. Dar, and select suggestion"
                        />
                        {form.physical_address.trim().length >= 3 ? (
                          <div className="mt-2 rounded-md border bg-background shadow-sm">
                            {loadingPlaceSuggestions ? (
                              <p className="px-3 py-2 text-xs text-muted-foreground">Searching places...</p>
                            ) : placeSuggestions.length > 0 ? (
                              placeSuggestions.map((suggestion) => (
                                <button
                                  key={suggestion.display_name}
                                  type="button"
                                  onClick={() => {
                                    applySuggestionToForm(suggestion, { physicalOnly: true });
                                    setPlaceSuggestions([]);
                                    setActivePlaceSuggestionIndex(-1);
                                  }}
                                  className={`block w-full border-b px-3 py-2 text-left text-xs last:border-b-0 ${
                                    placeSuggestions[activePlaceSuggestionIndex]?.display_name === suggestion.display_name
                                      ? "bg-emerald-100"
                                      : "hover:bg-emerald-50"
                                  }`}
                                >
                                  {suggestion.display_name}
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-2 text-xs text-muted-foreground">No matching places found.</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="street">Street</Label>
                        <div className="relative">
                          <Input
                            id="street"
                            value={form.street}
                            onChange={(event) => updateField("street", event.target.value)}
                            onKeyDown={handleStreetKeyDown}
                            placeholder={form.region ? `Street in ${form.region}` : "Type street"}
                          />
                          {form.street.trim().length >= 2 ? (
                            <div className="mt-2 rounded-md border bg-background shadow-sm">
                              {loadingStreetSuggestions ? (
                                <p className="px-3 py-2 text-xs text-muted-foreground">Searching streets...</p>
                              ) : streetSuggestions.length > 0 ? (
                                streetSuggestions.map((suggestion) => (
                                  <button
                                    key={`street-${suggestion.display_name}`}
                                    type="button"
                                    onClick={() => {
                                      applySuggestionToForm(suggestion);
                                      setStreetSuggestions([]);
                                      setActiveStreetSuggestionIndex(-1);
                                    }}
                                    className={`block w-full border-b px-3 py-2 text-left text-xs last:border-b-0 ${
                                      streetSuggestions[activeStreetSuggestionIndex]?.display_name === suggestion.display_name
                                        ? "bg-emerald-100"
                                        : "hover:bg-emerald-50"
                                    }`}
                                  >
                                    {suggestion.display_name}
                                  </button>
                                ))
                              ) : (
                                <p className="px-3 py-2 text-xs text-muted-foreground">No matching streets found.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ward">Ward</Label>
                        <Input id="ward" value={form.ward} onChange={(event) => updateField("ward", event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="district">District</Label>
                        <Input
                          id="district"
                          value={form.district}
                          onChange={(event) => updateField("district", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="region">Region</Label>
                        <Input id="region" value={form.region} onChange={(event) => updateField("region", event.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Employment & Business Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="occupation">Occupation</Label>
                        <Input
                          id="occupation"
                          value={form.occupation}
                          onChange={(event) => updateField("occupation", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="monthly-income">Monthly Income</Label>
                        <Input
                          id="monthly-income"
                          type="number"
                          min="0"
                          value={form.monthly_income}
                          onChange={(event) => updateField("monthly_income", event.target.value)}
                          placeholder="TZS amount"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employer-name">Employer Name</Label>
                        <Input
                          id="employer-name"
                          value={form.employer_name}
                          onChange={(event) => updateField("employer_name", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employer-phone">Employer Phone</Label>
                        <Input
                          id="employer-phone"
                          value={form.employer_phone}
                          onChange={(event) => updateField("employer_phone", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="employer-address">Employer Address</Label>
                        <Textarea
                          id="employer-address"
                          value={form.employer_address}
                          onChange={(event) => updateField("employer_address", event.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employment-start-date">Employment Start Date</Label>
                        <Input
                          id="employment-start-date"
                          type="date"
                          value={form.employment_start_date}
                          onChange={(event) => updateField("employment_start_date", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cheque-number">Cheque Number (Govt Employees)</Label>
                        <Input
                          id="cheque-number"
                          value={form.cheque_number}
                          onChange={(event) => updateField("cheque_number", event.target.value)}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="business-name">Business Name</Label>
                        <Input
                          id="business-name"
                          value={form.business_name}
                          onChange={(event) => updateField("business_name", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="business-type">Business Type</Label>
                        <Input
                          id="business-type"
                          value={form.business_type}
                          onChange={(event) => updateField("business_type", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="business-registration-no">Business Registration No</Label>
                        <Input
                          id="business-registration-no"
                          value={form.business_registration_no}
                          onChange={(event) => updateField("business_registration_no", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="years-in-business">Years in Business</Label>
                        <Input
                          id="years-in-business"
                          type="number"
                          min="0"
                          value={form.years_in_business}
                          onChange={(event) => updateField("years_in_business", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="business-address">Business Address</Label>
                        <Textarea
                          id="business-address"
                          value={form.business_address}
                          onChange={(event) => updateField("business_address", event.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Risk & Registration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="risk-level">Risk Level</Label>
                        <Select
                          value={form.risk_level}
                          onValueChange={(value) => updateField("risk_level", value as RiskLevel)}
                        >
                          <SelectTrigger id="risk-level">
                            <SelectValue placeholder="Select risk level" />
                          </SelectTrigger>
                          <SelectContent>
                            {RISK_LEVEL_OPTIONS.map((riskLevel) => (
                              <SelectItem key={riskLevel.value} value={riskLevel.value}>
                                {riskLevel.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="risk-score">Risk Score</Label>
                        <Input
                          id="risk-score"
                          type="number"
                          min="0"
                          value={form.risk_score}
                          onChange={(event) => updateField("risk_score", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="registration-fee-amount">Registration Fee Amount</Label>
                        <Input
                          id="registration-fee-amount"
                          type="number"
                          min="0"
                          value={form.registration_fee_amount}
                          onChange={(event) => updateField("registration_fee_amount", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="registration-fee-paid-at">Registration Fee Paid At</Label>
                        <Input
                          id="registration-fee-paid-at"
                          type="datetime-local"
                          value={form.registration_fee_paid_at}
                          onChange={(event) => updateField("registration_fee_paid_at", event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-border p-3">
                      <Checkbox
                        id="registration-fee-paid"
                        checked={form.registration_fee_paid}
                        onCheckedChange={(checked) => updateField("registration_fee_paid", checked === true)}
                      />
                      <Label htmlFor="registration-fee-paid" className="cursor-pointer">
                        Registration fee paid
                      </Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={form.notes}
                        onChange={(event) => updateField("notes", event.target.value)}
                        rows={3}
                        placeholder="Any notes for analysts, operations, or collections teams."
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="sticky top-6">
                  <CardHeader>
                    <CardTitle>Submit Summary</CardTitle>
                    <CardDescription>Backend-ready submission for `POST /api/customers` (or custom endpoint).</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                      <p className="font-semibold text-emerald-900">Branch Context</p>
                      <p className="text-xs text-emerald-800">
                        {selectedBranch
                          ? `${selectedBranch.name} (${selectedBranch.code})`
                          : "No branch selected yet"}
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          Branches
                        </span>
                        <Badge variant="secondary">{branchOptions.length}</Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          Loan officers (filtered)
                        </span>
                        <Badge variant="secondary">{loanOfficerOptions.length}</Badge>
                      </div>
                    </div>

                    {error ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {error}
                      </p>
                    ) : null}

                    <Separator />

                    <Button className="w-full" type="submit" disabled={submitting}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {submitting ? "Submitting..." : "Create Customer"}
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={() => setForm(defaultForm)}>
                      <Save className="mr-2 h-4 w-4" />
                      Reset Form
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
