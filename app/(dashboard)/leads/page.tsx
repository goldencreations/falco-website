"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
 ExternalLink,
 Loader2,
 LocateFixed,
 MapPin,
 Navigation,
 Phone,
 Plus,
 RefreshCcw,
 UserRound,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { extractBranchesList } from "@/lib/branch-adapters";
import { extractCustomersList } from "@/lib/customer-adapters";
import { formatApiResponseError } from "@/lib/falco-api";
import {
 extractLeadsList,
 mapUiLeadCreateToApi,
 type LeadLocationType,
 type LeadStatus,
 type LeadView,
} from "@/lib/lead-adapters";
import { reverseGeocodeNominatim } from "@/lib/nominatim";
import { parseJsonResponse } from "@/lib/parse-json-response";
import type { Branch, Customer } from "@/lib/types";
import { useSessionUser } from "@/lib/use-session-user";

const statusLabel: Record<LeadStatus, string> = {
 new: "New",
 follow_up: "Follow Up",
 contacted: "Contacted",
 converted: "Converted",
};

const locationTypeLabel: Record<LeadLocationType, string> = {
 home: "Home",
 work: "Work",
 sponsor: "Sponsor",
};

const regionCoordinateCenter: Record<string, { lat: number; lng: number }> = {
 "Dar es Salaam": { lat: -6.7924, lng: 39.2083 },
 Arusha: { lat: -3.3869, lng: 36.683 },
 Mwanza: { lat: -2.5164, lng: 32.9175 },
 Dodoma: { lat: -6.163, lng: 35.7516 },
 Morogoro: { lat: -6.8278, lng: 37.6591 },
};

const locationTypeOffset: Record<LeadLocationType, { lat: number; lng: number }> = {
 home: { lat: 0.0035, lng: 0.0035 },
 work: { lat: 0.0085, lng: -0.0045 },
 sponsor: { lat: -0.0065, lng: 0.0055 },
};

function getSeedFromText(value: string): number {
 return value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export default function LeadsPage() {
 const { user } = useSessionUser();
 const scopeBranchId =
 user?.role === "branch_manager" || user?.role === "loan_officer" ? user.branch_id : null;
 const [leads, setLeads] = useState<LeadView[]>([]);
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [branches, setBranches] = useState<Branch[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [selectedLeadId, setSelectedLeadId] = useState<string>("");
 const [showAddLeadForm, setShowAddLeadForm] = useState(false);
 const [isLocating, setIsLocating] = useState(false);
 const needsBranchPicker = user?.role === "super_admin";
 const [formData, setFormData] = useState({
 customerId: "",
 branchId: "",
 fullName: "",
 phoneNumber: "",
 alternatePhone: "",
 locationType: "home" as LeadLocationType,
 locationName: "",
 region: "",
 district: "",
 ward: "",
 latitude: "",
 longitude: "",
 notes: "",
 followUpDate: "",
 status: "new" as LeadStatus,
 });

 const visibleCustomers = scopeBranchId
 ? customers.filter((customer) => customer.branch_id === scopeBranchId)
 : customers;
 const visibleLeads = leads;

 useEffect(() => {
 if (user?.branch_id && !formData.branchId) {
 setFormData((prev) => ({ ...prev, branchId: user.branch_id }));
 }
 }, [user?.branch_id, formData.branchId]);

 const load = useCallback(async () => {
 setLoading(true);
 setError(null);
 try {
 const custParams = new URLSearchParams();
 custParams.set("page_size", "100");
 if (scopeBranchId) custParams.set("branch_id", scopeBranchId);

 const fetches: [Promise<Response>, Promise<Response>, Promise<Response> | null] = [
 fetch("/api/leads?page_size=100", { credentials: "include", cache: "no-store" }),
 fetch(`/api/customers?${custParams.toString()}`, {
 credentials: "include",
 cache: "no-store",
 }),
 user?.role === "super_admin"
 ? fetch("/api/falco/branches", { credentials: "include", cache: "no-store" })
 : null,
 ];

 const [leadsRes, custRes, branchRes] = await Promise.all([
 fetches[0],
 fetches[1],
 fetches[2] ?? Promise.resolve(null),
 ]);

 const { data: leadsJson } = await parseJsonResponse<unknown>(leadsRes);
 if (!leadsRes.ok) {
 if (leadsRes.status === 401) {
 throw new Error("Your session expired. Please sign out and sign in again.");
 }
 throw new Error(formatApiResponseError(leadsJson, "Failed to load leads"));
 }

 const custJson = await custRes.json().catch(() => null);
 if (!custRes.ok) {
 const msg =
 typeof custJson === "object" && custJson && "message" in custJson
 ? String((custJson as { message: unknown }).message)
 : "Failed to load customers";
 throw new Error(msg);
 }

 if (branchRes) {
 const branchJson = await branchRes.json().catch(() => null);
 if (branchRes.ok && branchJson) {
 const branchList = extractBranchesList(branchJson);
 setBranches(branchList);
 setFormData((prev) => ({
 ...prev,
 branchId: prev.branchId || branchList[0]?.id || "",
 }));
 }
 }

 const list = extractLeadsList(leadsJson);
 setLeads(list);
 setCustomers(extractCustomersList(custJson));
 setSelectedLeadId((prev) => prev || list[0]?.id || "");
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to load leads");
 setLeads([]);
 } finally {
 setLoading(false);
 }
 }, [scopeBranchId, user?.role]);

 useEffect(() => {
 void load();
 }, [load]);

 const customerLocationOptions = useMemo(() => {
 const selectedCustomer = visibleCustomers.find((customer) => customer.id === formData.customerId);
 if (!selectedCustomer) return [];

 const center = regionCoordinateCenter[selectedCustomer.region] ?? regionCoordinateCenter["Dar es Salaam"];
 const seed = getSeedFromText(selectedCustomer.customer_number);

 const buildCoords = (type: LeadLocationType) => {
 const offset = locationTypeOffset[type];
 const varianceLat = ((seed % 7) - 3) * 0.0004;
 const varianceLng = ((seed % 11) - 5) * 0.0004;
 return {
 latitude: (center.lat + offset.lat + varianceLat).toFixed(6),
 longitude: (center.lng + offset.lng + varianceLng).toFixed(6),
 };
 };

 return (["home", "work", "sponsor"] as const).map((type) => {
 const coords = buildCoords(type);
 const placeTitle =
 type === "home"
 ? `${selectedCustomer.physical_address}`
 : type === "work"
 ? `${selectedCustomer.district} business area`
 : `${selectedCustomer.ward} sponsor point`;

 return {
 type,
 locationName: `${placeTitle}, ${selectedCustomer.region}`,
 region: selectedCustomer.region,
 district: selectedCustomer.district,
 ward: selectedCustomer.ward,
 ...coords,
 };
 });
 }, [formData.customerId, visibleCustomers]);

 const applyLocationFromType = (type: LeadLocationType) => {
 const selectedLocation = customerLocationOptions.find((option) => option.type === type);
 if (!selectedLocation) return;
 setFormData((prev) => ({
 ...prev,
 locationType: type,
 locationName: selectedLocation.locationName,
 region: selectedLocation.region,
 district: selectedLocation.district,
 ward: selectedLocation.ward,
 latitude: selectedLocation.latitude,
 longitude: selectedLocation.longitude,
 }));
 };

 const handleCaptureLocation = () => {
 if (!navigator.geolocation) {
 setError("Geolocation is not supported in this browser.");
 return;
 }
 setIsLocating(true);
 setError(null);
 navigator.geolocation.getCurrentPosition(
 (position) => {
 const lat = position.coords.latitude;
 const lng = position.coords.longitude;
 const latStr = lat.toFixed(6);
 const lngStr = lng.toFixed(6);

 void (async () => {
 try {
 const place = await reverseGeocodeNominatim(lat, lng);
 setFormData((prev) => ({
 ...prev,
 latitude: latStr,
 longitude: lngStr,
 locationName: place.locationName || prev.locationName,
 district: place.district || prev.district,
 region: place.region || prev.region,
 ward: place.ward || prev.ward,
 }));
 } catch {
 setFormData((prev) => ({
 ...prev,
 latitude: latStr,
 longitude: lngStr,
 }));
 setError(
 "Coordinates captured, but street and district could not be resolved. Enter them manually."
 );
 } finally {
 setIsLocating(false);
 }
 })();
 },
 () => {
 setIsLocating(false);
 setError("Could not get your location. Allow location access in the browser and try again.");
 },
 { enableHighAccuracy: true, timeout: 15000 }
 );
 };

 const handleAddLead = async () => {
 if (!formData.fullName || !formData.phoneNumber || !formData.locationName) return;
 const branchId = formData.branchId.trim() || user?.branch_id?.trim() || "";
 if (needsBranchPicker && !branchId) {
 setError("Select a branch for this lead.");
 return;
 }

 setSaving(true);
 setError(null);
 try {
 const body = mapUiLeadCreateToApi({
 fullName: formData.fullName,
 phoneNumber: formData.phoneNumber,
 alternatePhone: formData.alternatePhone || undefined,
 locationType: formData.locationType,
 locationName: formData.locationName,
 region: formData.region || undefined,
 district: formData.district || undefined,
 ward: formData.ward || undefined,
 latitude: formData.latitude || undefined,
 longitude: formData.longitude || undefined,
 notes: formData.notes,
 followUpDate: formData.followUpDate || undefined,
 status: formData.status,
 });

 const res = await fetch("/api/leads", {
 method: "POST",
 credentials: "include",
 cache: "no-store",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 ...body,
 ...(branchId ? { branch_id: branchId } : {}),
 }),
 });
 const { data } = await parseJsonResponse<unknown>(res);
 if (!res.ok) {
 if (res.status === 401) {
 throw new Error("Your session expired. Please sign out and sign in again, then retry.");
 }
 throw new Error(formatApiResponseError(data, "Failed to save lead"));
 }

 await load();
 setShowAddLeadForm(false);
 setFormData({
 customerId: "",
 branchId: formData.branchId || user?.branch_id || branches[0]?.id || "",
 fullName: "",
 phoneNumber: "",
 alternatePhone: "",
 locationType: "home",
 locationName: "",
 region: "",
 district: "",
 ward: "",
 latitude: "",
 longitude: "",
 notes: "",
 followUpDate: "",
 status: "new",
 });
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to save lead");
 } finally {
 setSaving(false);
 }
 };

 const selectedLead = visibleLeads.find((lead) => lead.id === selectedLeadId);
 const mapLead =
 selectedLead && selectedLead.latitude && selectedLead.longitude
 ? selectedLead
 : visibleLeads.find((lead) => lead.latitude && lead.longitude);

 const openMapDirections = (lead: LeadView) => {
 if (!lead.latitude || !lead.longitude) return;
 window.open(
 `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`,
 "_blank",
 "noopener,noreferrer"
 );
 };

 const openMapView = (lead: LeadView) => {
 if (!lead.latitude || !lead.longitude) return;
 window.open(
 `https://www.google.com/maps/search/?api=1&query=${lead.latitude},${lead.longitude}`,
 "_blank",
 "noopener,noreferrer"
 );
 };

 return (
 <>
 <DashboardHeader
 title="Leads"
 description="Capture potential customers during field visits and follow up later"
 />
 <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-background to-background p-4 sm:p-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
 Lead Routing Hub
 </p>
 <h2 className="mt-1 text-lg font-semibold tracking-tight">
 Capture leads with location-assisted follow-up
 </h2>
 <p className="mt-1 text-sm text-muted-foreground">
 Pick an existing customer, choose location type, and save ready-to-navigate lead points.
 </p>
 </div>
 <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
 <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void load()}>
 <RefreshCcw className="mr-2 h-4 w-4" />
 Refresh
 </Button>
 <Button
 type="button"
 className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
 onClick={() => setShowAddLeadForm((prev) => !prev)}
 >
 <Plus className="mr-2 h-4 w-4" />
 {showAddLeadForm ? "Close Add Lead" : "Add Lead"}
 </Button>
 </div>
 </div>
 </div>

 {error && (
 <Card className="border-destructive/50 bg-destructive/5">
 <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
 </Card>
 )}

 {loading ? (
 <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading leads from server…
 </div>
 ) : (
 <>
 <Card className="overflow-hidden border-emerald-100">
 <CardHeader>
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <CardTitle>Leads for Follow-up</CardTitle>
 <CardDescription>
 Track and update potential customers captured during field work
 </CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4 p-0">
 <div className="grid gap-3 p-4 sm:hidden">
 {visibleLeads.map((lead) => (
 <div
 key={lead.id}
 className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"
 onClick={() => setSelectedLeadId(lead.id)}
 >
 <div className="flex items-start justify-between gap-2">
 <div>
 <p className="font-medium">{lead.fullName}</p>
 <p className="text-xs text-muted-foreground">{lead.locationName}</p>
 </div>
 <Badge variant="outline">{statusLabel[lead.status]}</Badge>
 </div>
 <p className="inline-flex items-center gap-1 text-sm">
 <Phone className="h-3 w-3" />
 {lead.phoneNumber}
 </p>
 <div className="flex flex-wrap gap-2">
 <Button
 size="sm"
 variant="outline"
 className="h-8 border-emerald-300 text-emerald-700"
 disabled={!lead.latitude || !lead.longitude}
 onClick={(event) => {
 event.stopPropagation();
 openMapView(lead);
 }}
 >
 <ExternalLink className="mr-1 h-3.5 w-3.5" />
 View
 </Button>
 <Button
 size="sm"
 className="h-8 bg-emerald-600 hover:bg-emerald-700"
 disabled={!lead.latitude || !lead.longitude}
 onClick={(event) => {
 event.stopPropagation();
 openMapDirections(lead);
 }}
 >
 <Navigation className="mr-1 h-3.5 w-3.5" />
 Start
 </Button>
 </div>
 </div>
 ))}
 </div>

 <div className="hidden overflow-x-auto sm:block">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Name</TableHead>
 <TableHead>Phone</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Location</TableHead>
 <TableHead>Coordinates</TableHead>
 <TableHead>Follow-up</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {visibleLeads.length === 0 ? (
 <TableRow>
 <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
 No leads yet. Add a field lead to get started.
 </TableCell>
 </TableRow>
 ) : (
 visibleLeads.map((lead) => (
 <TableRow
 key={lead.id}
 className="cursor-pointer"
 onClick={() => setSelectedLeadId(lead.id)}
 >
 <TableCell className="font-medium">{lead.fullName}</TableCell>
 <TableCell>
 <div className="flex flex-col gap-1">
 <span className="inline-flex items-center gap-1">
 <Phone className="h-3 w-3" />
 {lead.phoneNumber}
 </span>
 {lead.alternatePhone && (
 <span className="text-xs text-muted-foreground">
 Alt: {lead.alternatePhone}
 </span>
 )}
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="secondary">{locationTypeLabel[lead.locationType]}</Badge>
 </TableCell>
 <TableCell>{lead.locationName}</TableCell>
 <TableCell>
 {lead.latitude && lead.longitude ? (
 <span className="inline-flex items-center gap-1 text-xs">
 <MapPin className="h-3 w-3" />
 {lead.latitude}, {lead.longitude}
 </span>
 ) : (
 <span className="text-xs text-muted-foreground">Not captured</span>
 )}
 </TableCell>
 <TableCell>{lead.followUpDate || "-"}</TableCell>
 <TableCell>
 <Badge variant="outline">{statusLabel[lead.status]}</Badge>
 </TableCell>
 <TableCell className="text-right">
 <div className="inline-flex items-center gap-2">
 <Button
 size="sm"
 variant="outline"
 className="h-8 border-emerald-300 text-emerald-700"
 disabled={!lead.latitude || !lead.longitude}
 onClick={(event) => {
 event.stopPropagation();
 openMapView(lead);
 }}
 >
 <ExternalLink className="mr-1 h-3.5 w-3.5" />
 View
 </Button>
 <Button
 size="sm"
 className="h-8 bg-emerald-600 hover:bg-emerald-700"
 disabled={!lead.latitude || !lead.longitude}
 onClick={(event) => {
 event.stopPropagation();
 openMapDirections(lead);
 }}
 >
 <Navigation className="mr-1 h-3.5 w-3.5" />
 Start
 </Button>
 </div>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </div>
 </CardContent>
 </Card>

 {showAddLeadForm && (
 <Card className="border-emerald-100">
 <CardHeader className="rounded-t-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 text-white">
 <CardTitle>Add New Lead</CardTitle>
 <CardDescription>
 Select customer, location source, and save a navigation-ready lead record
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <FieldGroup>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Field className="sm:col-span-2 lg:col-span-2">
 <FieldLabel>Customer</FieldLabel>
 <Select
 value={formData.customerId}
 onValueChange={(value) => {
 const selectedCustomer = visibleCustomers.find((customer) => customer.id === value);
 setFormData((prev) => ({
 ...prev,
 customerId: value,
 branchId: selectedCustomer?.branch_id ?? prev.branchId,
 fullName: selectedCustomer
 ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
 : prev.fullName,
 phoneNumber: selectedCustomer?.phone_primary ?? prev.phoneNumber,
 alternatePhone: selectedCustomer?.phone_secondary ?? prev.alternatePhone,
 }));
 }}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select existing customer" />
 </SelectTrigger>
 <SelectContent>
 {visibleCustomers.map((customer) => (
 <SelectItem key={customer.id} value={customer.id}>
 {customer.first_name} {customer.last_name} - {customer.customer_number}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </Field>
 {needsBranchPicker && (
 <Field>
 <FieldLabel>Branch</FieldLabel>
 <Select
 value={formData.branchId}
 onValueChange={(value) =>
 setFormData((prev) => ({ ...prev, branchId: value }))
 }
 >
 <SelectTrigger>
 <SelectValue placeholder="Select branch" />
 </SelectTrigger>
 <SelectContent>
 {branches.map((branch) => (
 <SelectItem key={branch.id} value={branch.id}>
 {branch.name}
 {branch.code ? ` (${branch.code})` : ""}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </Field>
 )}
 <Field>
 <FieldLabel>Location Type</FieldLabel>
 <Select
 value={formData.locationType}
 onValueChange={(value: LeadLocationType) => {
 applyLocationFromType(value);
 }}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select location type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="home">Home</SelectItem>
 <SelectItem value="work">Work</SelectItem>
 <SelectItem value="sponsor">Sponsor</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 <Field>
 <FieldLabel>Full Name</FieldLabel>
 <Input
 placeholder="Potential customer name"
 value={formData.fullName}
 onChange={(e) =>
 setFormData((prev) => ({ ...prev, fullName: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Phone Number</FieldLabel>
 <Input
 placeholder="+255 xxx xxx xxx"
 value={formData.phoneNumber}
 onChange={(e) =>
 setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Alternate Number (optional)</FieldLabel>
 <Input
 placeholder="+255 xxx xxx xxx"
 value={formData.alternatePhone}
 onChange={(e) =>
 setFormData((prev) => ({ ...prev, alternatePhone: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Street / Location</FieldLabel>
 <Input
 placeholder="Street, area, or landmark"
 value={formData.locationName}
 onChange={(e) =>
 setFormData((prev) => ({ ...prev, locationName: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Region</FieldLabel>
 <Input
 placeholder="Region"
 value={formData.region}
 onChange={(e) =>
 setFormData((prev) => ({ ...prev, region: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>District</FieldLabel>
 <Input
 placeholder="District"
 value={formData.district}
 onChange={(e) =>
 setFormData((prev) => ({ ...prev, district: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Ward</FieldLabel>
 <Input
 placeholder="Ward"
 value={formData.ward}
 onChange={(e) =>
 setFormData((prev) => ({ ...prev, ward: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Latitude</FieldLabel>
 <Input
 type="number"
 step="any"
 placeholder="-6.7924"
 value={formData.latitude}
 onChange={(e) =>
 setFormData((prev) => ({ ...prev, latitude: e.target.value }))
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
 setFormData((prev) => ({ ...prev, longitude: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Follow-up Date</FieldLabel>
 <Input
 type="date"
 value={formData.followUpDate}
 onChange={(e) =>
 setFormData((prev) => ({ ...prev, followUpDate: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Status</FieldLabel>
 <Select
 value={formData.status}
 onValueChange={(value: LeadStatus) =>
 setFormData((prev) => ({ ...prev, status: value }))
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="new">New</SelectItem>
 <SelectItem value="follow_up">Follow Up</SelectItem>
 <SelectItem value="contacted">Contacted</SelectItem>
 <SelectItem value="converted">Converted</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 </div>
 <Field>
 <FieldLabel>Notes</FieldLabel>
 <Textarea
 rows={3}
 placeholder="Important follow-up details from the field visit"
 value={formData.notes}
 onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
 />
 </Field>
 </FieldGroup>

 <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
 <p className="mb-2 text-xs font-medium text-emerald-800">Quick location autofill</p>
 <div className="flex flex-wrap gap-2">
 {(["home", "work", "sponsor"] as const).map((type) => (
 <Button
 key={type}
 type="button"
 size="sm"
 variant="outline"
 className="border-emerald-300 text-emerald-700"
 disabled={!formData.customerId}
 onClick={() => applyLocationFromType(type)}
 >
 <UserRound className="mr-1 h-3.5 w-3.5" />
 Use {locationTypeLabel[type]}
 </Button>
 ))}
 </div>
 </div>

 <div className="flex flex-wrap gap-2">
 <Button variant="outline" onClick={handleCaptureLocation} disabled={isLocating}>
 <LocateFixed className="mr-2 h-4 w-4" />
 {isLocating ? "Getting location…" : "Use browser location"}
 </Button>
 <Button
 type="button"
 className="bg-emerald-600 hover:bg-emerald-700"
 disabled={saving}
 onClick={() => void handleAddLead()}
 >
 {saving ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Saving…
 </>
 ) : (
 <>
 <Plus className="mr-2 h-4 w-4" />
 Save Lead
 </>
 )}
 </Button>
 </div>

 {formData.latitude && formData.longitude && (
 <div className="overflow-hidden rounded-lg border border-border">
 <div className="border-b border-border bg-muted px-3 py-2 text-sm font-medium">
 New Lead Location Preview ({formData.region || "Unknown region"})
 </div>
 <iframe
 title="New lead location preview"
 src={`https://maps.google.com/maps?q=${formData.latitude},${formData.longitude}&z=15&output=embed`}
 className="h-64 w-full"
 loading="lazy"
 />
 </div>
 )}
 </CardContent>
 </Card>
 )}

 <Card>
 <CardHeader>
 <CardTitle>Leads Map</CardTitle>
 <CardDescription>
 Select a lead to view their captured location on the map
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
 <SelectTrigger className="max-w-md">
 <SelectValue placeholder="Choose lead for map view" />
 </SelectTrigger>
 <SelectContent>
 {visibleLeads.map((lead) => (
 <SelectItem key={lead.id} value={lead.id}>
 {lead.fullName} - {lead.locationName}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 {mapLead ? (
 <div className="overflow-hidden rounded-lg border border-border">
 <div className="border-b border-border bg-muted px-3 py-2 text-sm">
 <span className="font-medium">{mapLead.fullName}</span> |{" "}
 <span className="text-muted-foreground">
 {mapLead.locationName} ({locationTypeLabel[mapLead.locationType]})
 </span>
 </div>
 <iframe
 title="Lead location map"
 src={`https://maps.google.com/maps?q=${mapLead.latitude},${mapLead.longitude}&z=15&output=embed`}
 className="h-72 w-full"
 loading="lazy"
 />
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">
 No lead with coordinates yet. Capture latitude and longitude to display map.
 </p>
 )}
 </CardContent>
 </Card>
 </>
 )}
 </div>
 </main>
 </>
 );
}
