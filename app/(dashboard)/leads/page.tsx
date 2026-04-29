"use client";

import { useState } from "react";
import { LocateFixed, MapPin, Phone, Plus } from "lucide-react";
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

type LeadStatus = "new" | "follow_up" | "contacted" | "converted";

interface Lead {
  id: string;
  fullName: string;
  phoneNumber: string;
  alternatePhone?: string;
  locationName: string;
  latitude?: string;
  longitude?: string;
  notes: string;
  followUpDate?: string;
  status: LeadStatus;
  createdAt: string;
}

const initialLeads: Lead[] = [
  {
    id: "lead-001",
    fullName: "Mariam Charles",
    phoneNumber: "+255 742 100 101",
    locationName: "Mbezi Mwisho",
    latitude: "-6.709132",
    longitude: "39.130426",
    notes: "Owns a small grocery kiosk, interested in stock financing.",
    followUpDate: "2026-05-02",
    status: "follow_up",
    createdAt: "2026-04-26",
  },
];

const statusLabel: Record<LeadStatus, string> = {
  new: "New",
  follow_up: "Follow Up",
  contacted: "Contacted",
  converted: "Converted",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeads[0]?.id || "");
  const [showAddLeadForm, setShowAddLeadForm] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    alternatePhone: "",
    locationName: "",
    latitude: "",
    longitude: "",
    notes: "",
    followUpDate: "",
    status: "new" as LeadStatus,
  });

  const handleCaptureLocation = () => {
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

  const handleAddLead = () => {
    if (!formData.fullName || !formData.phoneNumber || !formData.locationName) return;

    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      fullName: formData.fullName,
      phoneNumber: formData.phoneNumber,
      alternatePhone: formData.alternatePhone || undefined,
      locationName: formData.locationName,
      latitude: formData.latitude || undefined,
      longitude: formData.longitude || undefined,
      notes: formData.notes,
      followUpDate: formData.followUpDate || undefined,
      status: formData.status,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setLeads((prev) => [newLead, ...prev]);
    setSelectedLeadId(newLead.id);
    setShowAddLeadForm(false);
    setFormData({
      fullName: "",
      phoneNumber: "",
      alternatePhone: "",
      locationName: "",
      latitude: "",
      longitude: "",
      notes: "",
      followUpDate: "",
      status: "new",
    });
  };

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId);
  const mapLead =
    selectedLead && selectedLead.latitude && selectedLead.longitude
      ? selectedLead
      : leads.find((lead) => lead.latitude && lead.longitude);

  return (
    <>
      <DashboardHeader
        title="Leads"
        description="Capture potential customers during field visits and follow up later"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Leads for Follow-up</CardTitle>
                  <CardDescription>
                    Track and update potential customers captured during field work
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddLeadForm((prev) => !prev)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {showAddLeadForm ? "Close" : "Add Lead"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
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
                      <TableCell className="max-w-[280px] truncate">{lead.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {showAddLeadForm && (
            <Card>
              <CardHeader>
                <CardTitle>Add New Lead</CardTitle>
                <CardDescription>
                  Record name, number, location, and notes from field work
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      <FieldLabel>Location Name</FieldLabel>
                      <Input
                        placeholder="Area/Street/Market"
                        value={formData.locationName}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, locationName: e.target.value }))
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

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleCaptureLocation} disabled={isLocating}>
                    <LocateFixed className="mr-2 h-4 w-4" />
                    {isLocating ? "Capturing Location..." : "Use Current Location"}
                  </Button>
                  <Button onClick={handleAddLead}>
                    <Plus className="mr-2 h-4 w-4" />
                    Save Lead
                  </Button>
                </div>

                {formData.latitude && formData.longitude && (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="border-b border-border bg-muted px-3 py-2 text-sm font-medium">
                      New Lead Location Preview
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
                  {leads.map((lead) => (
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
                    <span className="text-muted-foreground">{mapLead.locationName}</span>
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
        </div>
      </main>
    </>
  );
}
