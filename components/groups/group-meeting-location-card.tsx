"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
} from "@/lib/group-meeting-location";
import type { LoanGroup } from "@/lib/types";

type Props = {
  group: Pick<
    LoanGroup,
    "meeting_location" | "village_or_street" | "meeting_latitude" | "meeting_longitude"
  >;
};

export function GroupMeetingLocationCard({ group }: Props) {
  const hasPin = group.meeting_latitude != null && group.meeting_longitude != null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-emerald-700" />
          Meeting location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-medium">{group.meeting_location || "—"}</p>
          <p className="text-muted-foreground">{group.village_or_street || "—"}</p>
        </div>

        {hasPin ? (
          <>
            <p className="font-mono text-[11px] text-muted-foreground">
              {group.meeting_latitude!.toFixed(6)}, {group.meeting_longitude!.toFixed(6)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <a
                  href={googleMapsSearchUrl({
                    latitude: group.meeting_latitude!,
                    longitude: group.meeting_longitude!,
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
                    latitude: group.meeting_latitude!,
                    longitude: group.meeting_longitude!,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get directions
                </a>
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border">
              <iframe
                title="Kikundi meeting location"
                src={googleMapsEmbedUrl({
                  latitude: group.meeting_latitude!,
                  longitude: group.meeting_longitude!,
                })}
                className="h-52 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No map pin saved for this kikundi yet. Edit the group to add a browsable meeting
            location.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
