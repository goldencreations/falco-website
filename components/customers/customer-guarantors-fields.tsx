"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_CUSTOMER_GUARANTORS,
  type CustomerGuarantorFormRow,
} from "@/lib/customer-guarantors";

type Props = {
  value: CustomerGuarantorFormRow[];
  onChange: (rows: CustomerGuarantorFormRow[]) => void;
};

function FileField({
  label,
  accept,
  file,
  onChange,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{file.name}</p>
      ) : null}
    </Field>
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
    next: string | File | null | File[]
  ) => {
    onChange(value.map((row, i) => (i === index ? { ...row, [key]: next } : row)));
  };

  const addAttachments = (index: number, files: FileList | null) => {
    if (!files?.length) return;
    onChange(
      value.map((row, i) =>
        i === index ? { ...row, attachments: [...row.attachments, ...Array.from(files)] } : row
      )
    );
  };

  const removeAttachment = (rowIndex: number, fileIndex: number) => {
    onChange(
      value.map((row, i) =>
        i === rowIndex
          ? { ...row, attachments: row.attachments.filter((_, j) => j !== fileIndex) }
          : row
      )
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
            <Field>
              <FieldLabel>Address</FieldLabel>
              <Textarea
                placeholder="Guarantor physical address"
                value={row.address}
                onChange={(e) => updateRow(index, "address", e.target.value)}
                rows={2}
              />
            </Field>

            <Separator />
            <p className="text-sm font-medium">Guarantor collateral</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Collateral type</FieldLabel>
                <Input
                  placeholder="e.g., Motorcycle, land title"
                  value={row.collateralType}
                  onChange={(e) => updateRow(index, "collateralType", e.target.value)}
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
                <FieldLabel>Estimated value (TZS)</FieldLabel>
                <MoneyInput
                  placeholder="e.g., 5,000,000"
                  value={row.collateralEstimatedValue}
                  onValueChange={(v) => updateRow(index, "collateralEstimatedValue", v)}
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
            <Field>
              <FieldLabel>Collateral description</FieldLabel>
              <Textarea
                placeholder="Describe the collateral offered by this guarantor"
                value={row.collateralDescription}
                onChange={(e) => updateRow(index, "collateralDescription", e.target.value)}
                rows={2}
              />
            </Field>

            <Separator />
            <p className="text-sm font-medium">Identity documents</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FileField
                label="Guarantor ID front"
                accept="image/*,.pdf"
                file={row.idFront}
                onChange={(file) => updateRow(index, "idFront", file)}
              />
              <FileField
                label="Guarantor ID back"
                accept="image/*,.pdf"
                file={row.idBack}
                onChange={(file) => updateRow(index, "idBack", file)}
              />
            </div>

            <Separator />
            <p className="text-sm font-medium">Photos & supporting documents</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FileField
                label="Guarantor photo"
                accept="image/*"
                file={row.photo}
                onChange={(file) => updateRow(index, "photo", file)}
              />
              <FileField
                label="Photo with customer"
                accept="image/*"
                file={row.photoWithCustomer}
                onChange={(file) => updateRow(index, "photoWithCustomer", file)}
              />
              <FileField
                label="Ward letter"
                accept="image/*,.pdf"
                file={row.wardLetter}
                onChange={(file) => updateRow(index, "wardLetter", file)}
              />
            </div>

            <Field>
              <FieldLabel>Additional attachments</FieldLabel>
              <Input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => addAttachments(index, e.target.files)}
              />
              {row.attachments.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {row.attachments.map((file, fileIndex) => (
                    <li
                      key={`${file.name}-${fileIndex}`}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs"
                    >
                      <span className="truncate text-muted-foreground">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removeAttachment(index, fileIndex)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Field>
          </FieldGroup>
        </div>
      ))}
    </div>
  );
}
