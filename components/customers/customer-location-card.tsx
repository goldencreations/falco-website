"use client";

import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  customerBusinessAddressQuery,
  customerHasLocationData,
  customerHomeAddressQuery,
  customerLocationDirectionsUrl,
  customerLocationEmbedUrl,
  customerLocationSearchUrl,
  type CustomerGeoPin,
} from "@/lib/customer-location";
import type { Customer } from "@/lib/types";

type LocationBlockProps = {
  title: string;
  address?: string;
  pin: CustomerGeoPin | null;
  addressQuery: string;
};

function LocationBlock({ title, address, pin, addressQuery }: LocationBlockProps) {
  const embedUrl = customerLocationEmbedUrl(pin, addressQuery);
  const searchUrl = customerLocationSearchUrl(pin, addressQuery);
  const directionsUrl = customerLocationDirectionsUrl(pin, addressQuery);
  const approximate = !pin && Boolean(addressQuery.trim());

  if (!embedUrl || !searchUrl || !directionsUrl) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-3 py-3 md:flex-row md:items-start md:justify-between sm:px-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {address ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{address}</p>
          ) : null}
          {pin ? (
            <p className="font-mono text-[10px] text-muted-foreground">
              {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
            </p>
          ) : approximate ? (
            <p className="text-[10px] text-amber-800">Approximate — from registered address</p>
          ) : null}
        </div>
        <div className="grid w-full shrink-0 grid-cols-1 gap-1.5 min-[380px]:grid-cols-2 md:w-auto">
          <Button type="button" variant="outline" size="sm" className="h-8 justify-center text-xs" asChild>
            <a href={searchUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" />
              Open map
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 justify-center text-xs" asChild>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="mr-1 h-3 w-3" />
              Directions
            </a>
          </Button>
        </div>
      </div>
      <div className="aspect-[4/3] w-full sm:aspect-[16/10] xl:aspect-[2/1]">
        <iframe
          title={`${title} map`}
          src={embedUrl}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

function LocationEmptyBlock({
  title,
  businessName,
}: {
  title: string;
  businessName?: string;
}) {
  return (
    <div className="flex min-h-[220px] flex-col justify-center rounded-xl border border-border bg-card px-4 py-6 text-center shadow-sm sm:min-h-[260px]">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {businessName ? (
        <p className="mt-1 text-xs text-muted-foreground">{businessName}</p>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        No business address or GPS pin on file yet. Edit the customer profile to add a business
        address or drop a map pin.
      </p>
    </div>
  );
}

type Props = {
  customer: Pick<
    Customer,
    | "customer_type"
    | "physical_address"
    | "business_address"
    | "business_name"
    | "ward"
    | "district"
    | "region"
    | "home_latitude"
    | "home_longitude"
    | "business_latitude"
    | "business_longitude"
  >;
};

export function CustomerLocationCard({ customer }: Props) {
  const hasHomePin =
    customer.home_latitude != null && customer.home_longitude != null;
  const hasBusinessPin =
    customer.business_latitude != null && customer.business_longitude != null;

  const homeAddress = customerHomeAddressQuery(customer);
  const businessAddress = customerBusinessAddressQuery(customer);
  const homeDisplay = [customer.physical_address, customer.ward, customer.district, customer.region]
    .filter(Boolean)
    .join(", ");
  const businessDisplay = customer.business_address?.trim() || undefined;
  const businessName = customer.business_name?.trim() || undefined;

  const showHome = hasHomePin || Boolean(homeAddress.trim());
  const hasBusinessMapData =
    hasBusinessPin || Boolean(customer.business_address?.trim());
  const hasBusinessProfile =
    Boolean(businessName) ||
    customer.customer_type === "business" ||
    hasBusinessMapData;
  const showBusiness = hasBusinessProfile || showHome;
  const locationCount = [showHome, showBusiness].filter(Boolean).length;
  const hasAny = customerHasLocationData(customer);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold sm:text-base">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Customer location
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Registered home and business pins for field visits and navigation.
        </p>
      </div>

      {!hasAny ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No address or GPS location on file. Edit the customer profile to add a map pin.
        </p>
      ) : (
        <div
          className={cn(
            "grid w-full gap-4",
            locationCount > 1 ? "xl:grid-cols-2" : "max-w-3xl"
          )}
        >
          {showHome ? (
            <LocationBlock
              title="Home / residence"
              address={homeDisplay}
              pin={
                hasHomePin
                  ? {
                      latitude: customer.home_latitude!,
                      longitude: customer.home_longitude!,
                    }
                  : null
              }
              addressQuery={homeAddress}
            />
          ) : null}
          {showBusiness ? (
            hasBusinessMapData ? (
              <LocationBlock
                title="Business premises"
                address={businessDisplay}
                pin={
                  hasBusinessPin
                    ? {
                        latitude: customer.business_latitude!,
                        longitude: customer.business_longitude!,
                      }
                    : null
                }
                addressQuery={businessAddress}
              />
            ) : (
              <LocationEmptyBlock title="Business premises" businessName={businessName} />
            )
          ) : null}
        </div>
      )}
    </section>
  );
}
