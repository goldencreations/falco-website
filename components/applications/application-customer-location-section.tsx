"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, LocateFixed, MapPin, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildApplicationLocationSources,
  defaultApplicationLocationSource,
  type ApplicationLocationSource,
} from "@/lib/application-location-sources";
import { extractLeadsList } from "@/lib/lead-adapters";
import { leadMapDirectionsUrl, leadMapEmbedUrl } from "@/lib/lead-map";
import type { Customer } from "@/lib/types";

type LocationValue = {
  latitude: string;
  longitude: string;
  locationLabel: string;
};

type Props = {
  customer: Customer | null;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

export function ApplicationCustomerLocationSection({ customer, value, onChange }: Props) {
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState("");
  const [leadRows, setLeadRows] = useState<ReturnType<typeof extractLeadsList>>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState("");

  const loadLeadsForCustomer = useCallback(async (cust: Customer) => {
    setLeadsLoading(true);
    setLeadsError("");
    try {
      const queries = [cust.phone_primary, cust.phone_secondary, cust.customer_number]
        .map((q) => q?.trim())
        .filter((q): q is string => Boolean(q));
      const uniqueQueries = [...new Set(queries)];

      const batches = await Promise.all(
        uniqueQueries.map(async (q) => {
          const res = await fetch(
            `/api/leads?q=${encodeURIComponent(q)}&page_size=100`,
            { credentials: "include", cache: "no-store" }
          );
          const json = (await res.json().catch(() => ({}))) as { message?: string };
          if (!res.ok) {
            throw new Error(
              typeof json.message === "string" ? json.message : `Could not load leads (${res.status})`
            );
          }
          return extractLeadsList(json);
        })
      );

      const byId = new Map<string, (typeof batches)[number][number]>();
      for (const batch of batches) {
        for (const lead of batch) byId.set(lead.id, lead);
      }
      setLeadRows([...byId.values()]);
    } catch (e) {
      setLeadRows([]);
      setLeadsError(e instanceof Error ? e.message : "Could not load leads");
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!customer?.id) {
      setLeadRows([]);
      setLeadsError("");
      setSelectedSourceId("");
      return;
    }
    void loadLeadsForCustomer(customer);
  }, [customer, loadLeadsForCustomer]);

  const locationSources = useMemo(
    () => (customer ? buildApplicationLocationSources(customer, leadRows) : []),
    [customer, leadRows]
  );

  const applySource = useCallback(
    (source: ApplicationLocationSource) => {
      setSelectedSourceId(source.id);
      onChange({
        latitude: source.latitude,
        longitude: source.longitude,
        locationLabel: `${source.label}: ${source.subtitle}`,
      });
    },
    [onChange]
  );

  useEffect(() => {
    if (!customer || value.latitude || value.longitude) return;
    const defaultSource = defaultApplicationLocationSource(locationSources);
    if (!defaultSource) return;
    applySource(defaultSource);
  }, [customer, locationSources, value.latitude, value.longitude, applySource]);

  const setBrowserLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedSourceId("browser");
        onChange({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          locationLabel: "Current browser location",
        });
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const mapPreviewLead = useMemo(() => {
    if (!value.latitude || !value.longitude) return null;
    return {
      latitude: value.latitude,
      longitude: value.longitude,
      locationName: value.locationLabel,
      region: "",
      district: "",
      ward: "",
    };
  }, [value.latitude, value.longitude, value.locationLabel]);

  const embedUrl = mapPreviewLead ? leadMapEmbedUrl(mapPreviewLead) : null;
  const directionsUrl = mapPreviewLead ? leadMapDirectionsUrl(mapPreviewLead) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Location</CardTitle>
        <CardDescription>
          Use a lead location captured for this customer, their registered profile pin, or GPS.
          Saved on the application per{" "}
          <a
            href="https://falcobackend.habitek.co.tz/api/docs#"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            POST /loan-applications
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!customer ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
            Select a customer first to load lead locations and profile pins.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <FieldLabel>Use location from lead or customer profile</FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={selectedSourceId || undefined}
                  onValueChange={(id) => {
                    const source = locationSources.find((s) => s.id === id);
                    if (source) applySource(source);
                  }}
                  disabled={leadsLoading || locationSources.length === 0}
                >
                  <SelectTrigger className="w-full sm:flex-1">
                    <SelectValue
                      placeholder={
                        leadsLoading
                          ? "Loading lead locations…"
                          : locationSources.length
                            ? "Choose saved location"
                            : "No lead or profile locations found"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {locationSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.label} — {source.subtitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={!customer || leadsLoading}
                  onClick={() => customer && void loadLeadsForCustomer(customer)}
                >
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh leads
                </Button>
              </div>
              {leadsError ? (
                <p className="text-xs text-destructive">{leadsError}</p>
              ) : locationSources.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {locationSources.filter((s) => s.kind === "lead").length} lead location(s) and{" "}
                  {locationSources.filter((s) => s.kind !== "lead").length} profile pin(s) available.
                </p>
              ) : !leadsLoading ? (
                <p className="text-xs text-muted-foreground">
                  No GPS lead locations for this customer. Add leads with coordinates or set pins on
                  the customer profile.
                </p>
              ) : null}
            </div>

            {value.locationLabel ? (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Selected:</span> {value.locationLabel}
              </p>
            ) : null}
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Latitude</FieldLabel>
            <Input
              type="number"
              step="any"
              placeholder="-6.7924"
              value={value.latitude}
              onChange={(e) => {
                setSelectedSourceId("manual");
                onChange({ ...value, latitude: e.target.value });
              }}
            />
          </Field>
          <Field>
            <FieldLabel>Longitude</FieldLabel>
            <Input
              type="number"
              step="any"
              placeholder="39.2083"
              value={value.longitude}
              onChange={(e) => {
                setSelectedSourceId("manual");
                onChange({ ...value, longitude: e.target.value });
              }}
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
          {isLocating ? "Getting browser location…" : "Use browser location"}
        </Button>

        {value.latitude && value.longitude && embedUrl ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-mono text-xs">
                  {value.latitude}, {value.longitude}
                </span>
              </div>
              {directionsUrl ? (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Get directions
                </a>
              ) : null}
            </div>
            <iframe
              title="Customer location map"
              src={embedUrl}
              className="aspect-[16/10] w-full sm:aspect-[2/1]"
              loading="lazy"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
