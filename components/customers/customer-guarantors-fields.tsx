"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { MoneyInput } from "@/components/forms/money-input";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formControlErrorClass, formControlErrorProps } from "@/components/forms/form-field-message";
import { cn } from "@/lib/utils";

import {
  MAX_CUSTOMER_GUARANTORS,
  type CustomerGuarantorFormRow,
} from "@/lib/customer-guarantors";

type Props = {
  value: CustomerGuarantorFormRow[];
  onChange: (rows: CustomerGuarantorFormRow[]) => void;
  fieldErrors?: Record<string, string>;
};

function rowFieldError(
  fieldErrors: Record<string, string> | undefined,
  index: number,
  field: string
) {
  return fieldErrors?.[`guarantors.${index}.${field}`];
}

function FileField({
  label,
  accept,
  file,
  error,
  fieldKey,
  onChange,
}: {
  label: string;
  accept: string;
  file: File | null;
  error?: string;
  fieldKey?: string;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = Boolean(file && (/^image\//i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)));

  useEffect(() => {
    if (!file || !isImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <Field data-invalid={Boolean(error)} data-form-field={fieldKey}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef}
          type="file"
          accept={accept}
          className={cn("min-w-0 flex-1", formControlErrorClass(Boolean(error)))}
          {...formControlErrorProps(error)}
          onChange={(e) => {
            onChange(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        {file ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {file ? (
        <div className="mt-2 overflow-hidden rounded-md border bg-background">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`${label} preview`} className="max-h-44 w-full object-contain bg-muted/20" />
          ) : null}
          <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-2 py-1">
            <p className="truncate text-xs text-muted-foreground">{file.name}</p>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onChange(null)}>
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Remove {label}</span>
            </Button>
          </div>
        </div>
      ) : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function CustomerGuarantorsFields({ value, onChange, fieldErrors }: Props) {
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
        <div
          key={index}
          className="rounded-lg border border-border p-4"
          data-form-field={`guarantors.${index}`}
        >
          <p className="mb-3 text-sm font-semibold">Guarantor {index + 1}</p>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "name"))}
                data-form-field={`guarantors.${index}.name`}
              >
                <FieldLabel>Full name</FieldLabel>
                <Input
                  placeholder="Guarantor full name"
                  value={row.name}
                  className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "name")))}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "name"))}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "name")}</FieldError>
              </Field>
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "nationalId"))}
                data-form-field={`guarantors.${index}.nationalId`}
              >
                <FieldLabel>National ID</FieldLabel>
                <TzValidatedInput
                  kind="nida"
                  value={row.nationalId}
                  aria-invalid={Boolean(rowFieldError(fieldErrors, index, "nationalId"))}
                  className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "nationalId")))}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "nationalId"))}
                  onValueChange={(v) => updateRow(index, "nationalId", v)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "nationalId")}</FieldError>
              </Field>
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "phone"))}
                data-form-field={`guarantors.${index}.phone`}
              >
                <FieldLabel>Phone number</FieldLabel>
                <TzValidatedInput
                  kind="phone"
                  value={row.phone}
                  className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "phone")))}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "phone"))}
                  onValueChange={(v) => updateRow(index, "phone", v)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "phone")}</FieldError>
              </Field>
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "relationship"))}
                data-form-field={`guarantors.${index}.relationship`}
              >
                <FieldLabel>Relationship</FieldLabel>
                <Select
                  value={row.relationship}
                  onValueChange={(v) => updateRow(index, "relationship", v)}
                >
                  <SelectTrigger
                    className={formControlErrorClass(
                      Boolean(rowFieldError(fieldErrors, index, "relationship"))
                    )}
                    {...formControlErrorProps(rowFieldError(fieldErrors, index, "relationship"))}
                  >
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
                <FieldError>{rowFieldError(fieldErrors, index, "relationship")}</FieldError>
              </Field>
            </div>
            {row.relationship === "other" ? (
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "otherRelationship"))}
                data-form-field={`guarantors.${index}.otherRelationship`}
              >
                <FieldLabel>Specify relationship</FieldLabel>
                <Input
                  placeholder="Enter relationship"
                  value={row.otherRelationship}
                  className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "otherRelationship")))}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "otherRelationship"))}
                  onChange={(e) => updateRow(index, "otherRelationship", e.target.value)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "otherRelationship")}</FieldError>
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
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "collateralType"))}
                data-form-field={`guarantors.${index}.collateralType`}
              >
                <FieldLabel>Collateral type</FieldLabel>
                <Input
                  placeholder="e.g., Motorcycle, land title"
                  value={row.collateralType}
                  className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "collateralType")))}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "collateralType"))}
                  onChange={(e) => updateRow(index, "collateralType", e.target.value)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "collateralType")}</FieldError>
              </Field>
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "collateralEstimatedValue"))}
                data-form-field={`guarantors.${index}.collateralEstimatedValue`}
              >
                <FieldLabel>Estimated value (TZS)</FieldLabel>
                <MoneyInput
                  placeholder="e.g., 5,000,000"
                  value={row.collateralEstimatedValue}
                  className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "collateralEstimatedValue")))}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "collateralEstimatedValue"))}
                  onValueChange={(v) => updateRow(index, "collateralEstimatedValue", v)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "collateralEstimatedValue")}</FieldError>
              </Field>
            </div>
            <Field
              data-invalid={Boolean(rowFieldError(fieldErrors, index, "collateralDescription"))}
              data-form-field={`guarantors.${index}.collateralDescription`}
            >
              <FieldLabel>Collateral description</FieldLabel>
              <Textarea
                placeholder="Describe the collateral offered by this guarantor"
                value={row.collateralDescription}
                className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "collateralDescription")))}
                {...formControlErrorProps(rowFieldError(fieldErrors, index, "collateralDescription"))}
                onChange={(e) => updateRow(index, "collateralDescription", e.target.value)}
                rows={2}
              />
              <FieldError>{rowFieldError(fieldErrors, index, "collateralDescription")}</FieldError>
            </Field>

            <Separator />
            <p className="text-sm font-medium">Identity documents</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FileField
                label="Guarantor ID front"
                accept="image/*,.pdf"
                file={row.idFront}
                error={rowFieldError(fieldErrors, index, "idFront")}
                fieldKey={`guarantors.${index}.idFront`}
                onChange={(file) => updateRow(index, "idFront", file)}
              />
              <FileField
                label="Guarantor ID back"
                accept="image/*,.pdf"
                file={row.idBack}
                error={rowFieldError(fieldErrors, index, "idBack")}
                fieldKey={`guarantors.${index}.idBack`}
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
                error={rowFieldError(fieldErrors, index, "photo")}
                fieldKey={`guarantors.${index}.photo`}
                onChange={(file) => updateRow(index, "photo", file)}
              />
              <FileField
                label="Photo with customer"
                accept="image/*"
                file={row.photoWithCustomer}
                error={rowFieldError(fieldErrors, index, "photoWithCustomer")}
                fieldKey={`guarantors.${index}.photoWithCustomer`}
                onChange={(file) => updateRow(index, "photoWithCustomer", file)}
              />
              <FileField
                label="Ward letter"
                accept="image/*,.pdf"
                file={row.wardLetter}
                error={rowFieldError(fieldErrors, index, "wardLetter")}
                fieldKey={`guarantors.${index}.wardLetter`}
                onChange={(file) => updateRow(index, "wardLetter", file)}
              />
            </div>

            <Field
              data-invalid={Boolean(rowFieldError(fieldErrors, index, "attachments"))}
              data-form-field={`guarantors.${index}.attachments`}
            >
              <FieldLabel>Additional attachments</FieldLabel>
              <Input
                type="file"
                accept="image/*,.pdf"
                multiple
                className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "attachments")))}
                {...formControlErrorProps(rowFieldError(fieldErrors, index, "attachments"))}
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
              <FieldError>{rowFieldError(fieldErrors, index, "attachments")}</FieldError>
            </Field>
          </FieldGroup>
        </div>
      ))}
    </div>
  );
}
