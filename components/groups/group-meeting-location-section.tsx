"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink, Link2, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
} from "@/lib/group-meeting-location";
import { parseMapLink } from "@/lib/parse-map-link";
import { reverseGeocodeNominatim } from "@/lib/nominatim";
import { searchPlacesInTanzania, type PlaceSuggestion } from "@/lib/nominatim-search";

const CustomerLocationMapPicker = dynamic(
  () =>
    import("@/components/customers/business-location-map-picker").then(
      (mod) => mod.CustomerLocationMapPicker
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[220px] w-full rounded-md border border-border" />,
  }
);

export type GroupMeetingLocationValue = {
  meeting_location: string;
  village_or_street: string;
  meeting_latitude: number | null;
  meeting_longitude: number | null;
};

type Props = {
  value: GroupMeetingLocationValue;
  onChange: (patch: Partial<GroupMeetingLocationValue>) => void;
  locationSearchContext?: string;
};

export function GroupMeetingLocationSection({
  value,
  onChange,
  locationSearchContext = "Tanzania",
}: Props) {
  const [browseQuery, setBrowseQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [mapLinkInput, setMapLinkInput] = useState("");
  const [mapLinkError, setMapLinkError] = useState("");
  const [resolvingPin, setResolvingPin] = useState(false);

  const hasPin = value.meeting_latitude != null && value.meeting_longitude != null;

  useEffect(() => {
    const q = browseQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const results = await searchPlacesInTanzania(q, {
          context: locationSearchContext,
          limit: 6,
        });
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [browseQuery, locationSearchContext]);

  const applySuggestion = (suggestion: PlaceSuggestion) => {
    const lat = Number(suggestion.lat);
    const lng = Number(suggestion.lon);
    const address = suggestion.address;
    const village =
      address?.road?.trim() ||
      address?.suburb?.trim() ||
      address?.neighbourhood?.trim() ||
      suggestion.display_name.split(",")[0]?.trim() ||
      value.village_or_street;

    onChange({
      meeting_location: suggestion.display_name,
      village_or_street: village,
      meeting_latitude: Number.isFinite(lat) ? lat : null,
      meeting_longitude: Number.isFinite(lng) ? lng : null,
    });
    setBrowseQuery("");
    setSuggestions([]);
  };

  const applyCoordinates = async (lat: number, lng: number) => {
    onChange({
      meeting_latitude: lat,
      meeting_longitude: lng,
    });
    setResolvingPin(true);
    try {
      const place = await reverseGeocodeNominatim(lat, lng);
      onChange({
        meeting_latitude: lat,
        meeting_longitude: lng,
        meeting_location: place.displayName || value.meeting_location,
        village_or_street: place.locationName || place.ward || value.village_or_street,
      });
    } catch {
      /* keep coordinates even if reverse geocode fails */
    } finally {
      setResolvingPin(false);
    }
  };

  const handleMapLinkPaste = () => {
    setMapLinkError("");
    const parsed = parseMapLink(mapLinkInput);
    if (!parsed.ok) {
      setMapLinkError(parsed.message);
      return;
    }
    void applyCoordinates(parsed.latitude, parsed.longitude);
    setMapLinkInput("");
  };

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="space-y-2">
        <Label htmlFor="meeting-location-browse">Browse meeting location</Label>
        <p className="text-xs text-muted-foreground">
          Search a place in Tanzania, drop a pin on the map, or paste a Google Maps link. The
          location is saved and can be opened in Google Maps for follow-up visits.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="meeting-location-browse"
            value={browseQuery}
            onChange={(e) => setBrowseQuery(e.target.value)}
            placeholder="Search ward, street, landmark, or hall…"
            className="pl-9"
          />
        </div>
        {loadingSuggestions ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching locations…
          </p>
        ) : null}
        {suggestions.length > 0 ? (
          <ul className="max-h-44 overflow-y-auto rounded-md border bg-background text-sm shadow-sm">
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.lat}-${suggestion.lon}-${suggestion.display_name}`}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/60"
                  onClick={() => applySuggestion(suggestion)}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                  <span>{suggestion.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Meeting location *</Label>
        <Input
          value={value.meeting_location}
          onChange={(e) => onChange({ meeting_location: e.target.value })}
          placeholder="Community hall, ward office, market area…"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Village / street *</Label>
        <Input
          value={value.village_or_street}
          onChange={(e) => onChange({ village_or_street: e.target.value })}
          placeholder="Street, village, or neighbourhood"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-map-link">Paste Google Maps link (optional)</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="group-map-link"
            value={mapLinkInput}
            onChange={(e) => {
              setMapLinkInput(e.target.value);
              setMapLinkError("");
            }}
            placeholder="https://maps.google.com/… or coordinates"
          />
          <Button type="button" variant="outline" onClick={handleMapLinkPaste}>
            <Link2 className="mr-2 h-4 w-4" />
            Use link
          </Button>
        </div>
        {mapLinkError ? <p className="text-xs text-destructive">{mapLinkError}</p> : null}
      </div>

      <CustomerLocationMapPicker
        purpose="meeting"
        latitude={value.meeting_latitude}
        longitude={value.meeting_longitude}
        onPick={(lat, lng) => void applyCoordinates(lat, lng)}
        onClear={() =>
          onChange({
            meeting_latitude: null,
            meeting_longitude: null,
          })
        }
      />

      {resolvingPin ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Resolving address from map pin…
        </p>
      ) : null}

      {hasPin ? (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Saved meeting point</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <a
                  href={googleMapsSearchUrl({
                    latitude: value.meeting_latitude!,
                    longitude: value.meeting_longitude!,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open in Google Maps
                </a>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a
                  href={googleMapsDirectionsUrl({
                    latitude: value.meeting_latitude!,
                    longitude: value.meeting_longitude!,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get directions
                </a>
              </Button>
            </div>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            {value.meeting_latitude!.toFixed(6)}, {value.meeting_longitude!.toFixed(6)}
          </p>
          <div className="overflow-hidden rounded-md border">
            <iframe
              title="Meeting location map preview"
              src={googleMapsEmbedUrl({
                latitude: value.meeting_latitude!,
                longitude: value.meeting_longitude!,
              })}
              className="h-48 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
