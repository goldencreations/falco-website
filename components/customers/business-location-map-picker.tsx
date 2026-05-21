"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";

import "leaflet/dist/leaflet.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMapLink } from "@/lib/parse-map-link";
import { cn } from "@/lib/utils";
import { Link2, MapPin } from "lucide-react";

/** Default center: Dar es Salaam, TZ (aligns with Nominatim country filter on the form). */
const DEFAULT_CENTER: LatLngTuple = [-6.7924, 39.2083];
const DEFAULT_ZOOM = 12;

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onPick(lat, lng);
      map.setView(e.latlng, Math.max(map.getZoom(), 15));
    },
  });
  return null;
}

function MapRecenter({ position }: { position: LatLngTuple | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, Math.max(map.getZoom(), 15));
    }
  }, [map, position]);
  return null;
}

const LOCATION_COPY = {
  home: {
    title: "Where the customer lives",
    hint: "Drop a pin on the customer's home. Use this when home and business are at different places. Text address above stays the mailing description.",
    empty: "No home location recorded yet.",
    recorded: "Home location recorded",
  },
  business: {
    title: "Where the customer's business is",
    hint: "Drop a pin on the shop, office, or outlet. Separate from home — use when the business address above is not precise enough for field visits.",
    empty: "No business location recorded yet.",
    recorded: "Business location recorded",
  },
} as const;

const MARKER_COLOR = {
  home: "#059669",
  business: "#d97706",
} as const;

function markerIcon(purpose: keyof typeof LOCATION_COPY) {
  const color = MARKER_COLOR[purpose];
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export type CustomerLocationMapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onPick: (lat: number, lng: number) => void;
  onClear: () => void;
  className?: string;
  purpose?: keyof typeof LOCATION_COPY;
};

export function CustomerLocationMapPicker({
  latitude,
  longitude,
  onPick,
  onClear,
  className,
  purpose = "business",
}: CustomerLocationMapPickerProps) {
  const copy = LOCATION_COPY[purpose];
  const [mapLink, setMapLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const hasPin = latitude != null && longitude != null;
  const markerPosition: LatLngTuple | null = hasPin ? [latitude, longitude] : null;
  const linkFieldId = `map-link-${purpose}`;

  const applyMapLink = () => {
    setLinkSuccess(false);
    const result = parseMapLink(mapLink);
    if (!result.ok) {
      setLinkError(result.message);
      return;
    }
    setLinkError(null);
    setLinkSuccess(true);
    onPick(result.latitude, result.longitude);
  };

  const handleClear = () => {
    setMapLink("");
    setLinkError(null);
    setLinkSuccess(false);
    onClear();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{copy.title}</p>
        <Badge
          variant="secondary"
          className="border border-emerald-200/80 bg-emerald-50/90 text-[10px] font-normal text-emerald-800"
        >
          Optional
        </Badge>
      </div>

      <div className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-3">
        <Label htmlFor={linkFieldId} className="flex items-center gap-1.5 text-xs font-medium">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          Paste map link
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Input
            id={linkFieldId}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="Google Maps, Apple Maps, or lat, lng"
            value={mapLink}
            onChange={(e) => {
              setMapLink(e.target.value);
              if (linkError) setLinkError(null);
              if (linkSuccess) setLinkSuccess(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyMapLink();
              }
            }}
            className="h-9 min-w-0 flex-1 bg-background text-sm"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 shrink-0 sm:px-4"
            disabled={!mapLink.trim()}
            onClick={applyMapLink}
          >
            Use link
          </Button>
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Supports full Google Maps, Apple Maps, and OpenStreetMap URLs, or coordinates like{" "}
          <span className="font-mono">-6.7924, 39.2083</span>. Short share links must be opened and copied
          as the full URL.
        </p>
        {linkError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
          >
            {linkError}
          </p>
        ) : null}
        {linkSuccess && !linkError ? (
          <p className="text-xs text-emerald-800">Coordinates applied from link. Drag the pin to refine if needed.</p>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-md border border-border bg-muted/30 shadow-sm">
        <MapContainer
          key={purpose}
          center={markerPosition ?? DEFAULT_CENTER}
          zoom={hasPin ? 15 : DEFAULT_ZOOM}
          className="z-0 h-[220px] w-full rounded-md [&_.leaflet-control-attribution]:text-[10px]"
          scrollWheelZoom={false}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapRecenter position={markerPosition} />
          <MapClickToPlace onPick={onPick} />
          {markerPosition ? (
            <Marker
              position={markerPosition}
              icon={markerIcon(purpose)}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const p = e.target.getLatLng();
                  onPick(p.lat, p.lng);
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700/80" aria-hidden />
          <p>{copy.hint}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!hasPin}
          onClick={handleClear}
        >
          Clear pin
        </Button>
      </div>
      {hasPin ? (
        <div className="space-y-0.5">
          <p className="text-[11px] font-medium text-emerald-800">{copy.recorded}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{copy.empty}</p>
      )}
    </div>
  );
}

export function BusinessLocationMapPicker(props: Omit<CustomerLocationMapPickerProps, "purpose">) {
  return <CustomerLocationMapPicker {...props} purpose="business" />;
}
