"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const SavedLocationMap = dynamic(
  () => import("./business-location-map-picker").then((module) => module.SavedLocationMap),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full rounded-md" /> },
);

type CustomerLocationPinProps = {
  purpose: "home" | "business";
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
  onClear: () => void;
};

export function CustomerLocationPin({ purpose, latitude, longitude, onPick, onClear }: CustomerLocationPinProps) {
  const labelId = useId();
  const title = purpose === "home" ? "Home location" : "Business location";
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPin = latitude != null && longitude != null;

  function pinLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("This browser cannot capture your location. Open Falco in a browser that supports location access.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setIsLocating(false);
        onPick(coords.latitude, coords.longitude);
      },
      ({ code }) => {
        setIsLocating(false);
        setError(code === 1
          ? "Allow location access for Falco in your browser settings, then try again."
          : "Your current location could not be found. Check that location services are on and try again.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function resetLocation() {
    setError(null);
    onClear();
  }

  return (
    <div role="group" aria-labelledby={labelId} className="space-y-2">
      <p id={labelId} className="text-sm font-medium">{title}</p>
      {hasPin ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <MapPin aria-hidden />
              View Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{latitude.toFixed(6)}, {longitude.toFixed(6)}</DialogDescription>
            </DialogHeader>
            <SavedLocationMap purpose={purpose} latitude={latitude} longitude={longitude} />
          </DialogContent>
        </Dialog>
      ) : (
        <>
          <Button type="button" variant="outline" size="sm" disabled={isLocating} onClick={pinLocation}>
            {isLocating ? <Loader2 className="animate-spin" aria-hidden /> : <MapPin aria-hidden />}
            {isLocating ? "Pinning location…" : "Pin Location"}
          </Button>
          <p className="text-xs text-muted-foreground">Pin your current position while at the customer’s {purpose}.</p>
        </>
      )}
      <div>
        <Button type="button" variant="ghost" size="sm" disabled={!hasPin || isLocating} onClick={resetLocation}>
          <RotateCcw aria-hidden />
          Reset Location
        </Button>
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
