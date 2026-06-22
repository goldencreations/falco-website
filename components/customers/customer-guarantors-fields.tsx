"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import { CachedMediaPreview } from "@/components/media/cached-media-preview";
import {
  MAX_CUSTOMER_GUARANTORS,
  type CustomerGuarantorFormRow,
} from "@/lib/customer-guarantors";

type Props = {
  value: CustomerGuarantorFormRow[];
  onChange: (rows: CustomerGuarantorFormRow[]) => void;
};

function GuarantorIdFilePreview({ file, label }: { file: File; label: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  if (isImage && previewUrl) {
    return (
      <div className="overflow-hidden rounded-md border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={label}
          className="max-h-48 w-full bg-muted/20 object-contain"
        />
        <p className="truncate border-t border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
          {file.name}
        </p>
      </div>
    );
  }

  return (
    <p className="truncate text-xs text-muted-foreground">
      Selected: {file.name}
    </p>
  );
}

function GuarantorExistingIdPreview({
  authUrl,
  previewUrl,
  label,
}: {
  authUrl: string;
  previewUrl?: string;
  label: string;
}) {
  return (
    <div className="space-y-1 overflow-hidden rounded-md border border-border">
      <CachedMediaPreview
        previewUrl={previewUrl}
        authUrl={authUrl}
        alt={label}
        maxHeight="max-h-48"
        imageClassName="object-contain"
      />
      <p className="border-t border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function CustomerGuarantorsFields({ value, onChange }: Props) {
  const updateRow = (
    index: number,
    key: keyof CustomerGuarantorFormRow,
    next: string | File | null
  ) => {
    onChange(
      value.map((row, i) => (i === index ? { ...row, [key]: next } : row))
    );
  };

  return (
    <div className="space-y-4">
      {value.slice(0, MAX_CUSTOMER_GUARANTORS).map((row, index) => (
        <div key={index} className="rounded-lg border border-border p-4">
          <p className="mb-3 text-sm font-semibold">Guarantor {index + 1}</p>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Full name</FieldLabel>
                <Input
                  placeholder="Guarantor full name"
                  value={row.name}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>National ID</FieldLabel>
                <TzValidatedInput
                  kind="nida"
                  value={row.nationalId}
                  onValueChange={(v) => updateRow(index, "nationalId", v)}
                />
              </Field>
              <Field>
                <FieldLabel>Phone number</FieldLabel>
                <TzValidatedInput
                  kind="phone"
                  value={row.phone}
                  onValueChange={(v) => updateRow(index, "phone", v)}
                />
              </Field>
              <Field>
                <FieldLabel>Relationship</FieldLabel>
                <Select
                  value={row.relationship}
                  onValueChange={(v) => updateRow(index, "relationship", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spouse">Spouse</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="sibling">Sibling</SelectItem>
                    <SelectItem value="relative">Other relative</SelectItem>
                    <SelectItem value="friend">Friend</SelectItem>
                    <SelectItem value="colleague">Colleague</SelectItem>
                    <SelectItem value="business_partner">Business partner</SelectItem>
                    <SelectItem value="other">Other (specify)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {row.relationship === "other" ? (
              <Field>
                <FieldLabel>Specify relationship</FieldLabel>
                <Input
                  placeholder="Enter relationship"
                  value={row.otherRelationship}
                  onChange={(e) => updateRow(index, "otherRelationship", e.target.value)}
                />
              </Field>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Guarantor ID front</FieldLabel>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => updateRow(index, "idFront", e.target.files?.[0] ?? null)}
                />
                {row.idFront ? (
                  <GuarantorIdFilePreview file={row.idFront} label="Guarantor ID front" />
                ) : row.existingIdFrontUrl ? (
                  <GuarantorExistingIdPreview
                    authUrl={row.existingIdFrontUrl}
                    previewUrl={row.existingIdFrontPreviewUrl}
                    label="Current ID front on file"
                  />
                ) : null}
              </Field>
              <Field>
                <FieldLabel>Guarantor ID back</FieldLabel>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => updateRow(index, "idBack", e.target.files?.[0] ?? null)}
                />
                {row.idBack ? (
                  <GuarantorIdFilePreview file={row.idBack} label="Guarantor ID back" />
                ) : row.existingIdBackUrl ? (
                  <GuarantorExistingIdPreview
                    authUrl={row.existingIdBackUrl}
                    previewUrl={row.existingIdBackPreviewUrl}
                    label="Current ID back on file"
                  />
                ) : null}
              </Field>
            </div>
          </FieldGroup>
        </div>
      ))}
    </div>
  );
}
