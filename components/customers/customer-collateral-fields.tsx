"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { CachedMediaPreview } from "@/components/media/cached-media-preview";
import { PHOTO_ACCEPT } from "@/lib/customer-attachments";
import {
  MAX_CUSTOMER_COLLATERAL,
  emptyCustomerCollateralRow,
  type CustomerCollateralFormRow,
} from "@/lib/customer-collateral";

type Props = {
  value: CustomerCollateralFormRow[];
  onChange: (rows: CustomerCollateralFormRow[]) => void;
};

function CollateralImagePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!previewUrl) return null;

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt="Collateral preview"
        className="max-h-48 w-full object-contain bg-muted/20"
      />
      <p className="truncate border-t border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
        {file.name}
      </p>
    </div>
  );
}

function CollateralExistingImagePreview({
  authUrl,
  previewUrl,
}: {
  authUrl: string;
  previewUrl?: string;
}) {
  return (
    <div className="space-y-1 overflow-hidden rounded-md border border-border">
      <CachedMediaPreview
        previewUrl={previewUrl}
        authUrl={authUrl}
        alt="Collateral on file"
        maxHeight="max-h-48"
        imageClassName="object-contain"
      />
      <p className="border-t border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
        Current image on file
      </p>
    </div>
  );
}

export function CustomerCollateralFields({ value, onChange }: Props) {
  const updateRow = (
    index: number,
    key: keyof CustomerCollateralFormRow,
    next: string | File | null
  ) => {
    onChange(value.map((row, i) => (i === index ? { ...row, [key]: next } : row)));
  };

  const addRow = () => {
    if (value.length >= MAX_CUSTOMER_COLLATERAL) return;
    onChange([...value, emptyCustomerCollateralRow()]);
  };

  const removeRow = (index: number) => {
    if (value.length <= 1) {
      onChange([emptyCustomerCollateralRow()]);
      return;
    }
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {value.slice(0, MAX_CUSTOMER_COLLATERAL).map((row, index) => (
        <div key={index} className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Collateral {index + 1}</p>
            {value.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)}>
                <Trash2 className="h-4 w-4" aria-hidden />
                <span className="sr-only">Remove collateral {index + 1}</span>
              </Button>
            ) : null}
          </div>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Collateral type</FieldLabel>
                <Input
                  placeholder="e.g., Motorcycle, TV, land title"
                  value={row.collateralType}
                  onChange={(e) => updateRow(index, "collateralType", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Estimated value (TZS)</FieldLabel>
                <MoneyInput
                  placeholder="e.g., 5,000,000"
                  value={row.estimatedValue}
                  onValueChange={(v) => updateRow(index, "estimatedValue", v)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea
                placeholder="Describe the collateral item..."
                value={row.description}
                onChange={(e) => updateRow(index, "description", e.target.value)}
                rows={2}
              />
            </Field>
            <Field>
              <FieldLabel>Collateral image</FieldLabel>
              <Input
                type="file"
                accept={PHOTO_ACCEPT}
                onChange={(e) => updateRow(index, "image", e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">JPG, JPEG, PNG, or WEBP — max 5MB</p>
              {row.image ? (
                <CollateralImagePreview file={row.image} />
              ) : row.existingImageUrl || row.existingImagePreviewUrl ? (
                <CollateralExistingImagePreview
                  authUrl={row.existingImageUrl ?? row.existingImagePreviewUrl ?? ""}
                  previewUrl={row.existingImagePreviewUrl}
                />
              ) : null}
            </Field>
          </FieldGroup>
        </div>
      ))}

      {value.length < MAX_CUSTOMER_COLLATERAL ? (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          Add another collateral
        </Button>
      ) : null}
    </div>
  );
}
