"use client";

import { Camera, FileText, Lock, Loader2, Plus, Trash2, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MoneyInput } from "@/components/forms/money-input";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import { CachedMediaPreview, resolveMediaViewUrl } from "@/components/media/cached-media-preview";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { CUSTOMER_ID_TYPE_OPTIONS } from "@/lib/customer-id-types";
import type { CustomerIdType } from "@/lib/customer-id-types";
import { DOCUMENT_ACCEPT_HINT, PHOTO_ACCEPT_HINT } from "@/lib/customer-attachments";
import { largePhotoWarning } from "@/lib/upload-limits";

import {
  emptyCustomerGuarantorRow,
  type CustomerGuarantorExistingFile,
  type CustomerGuarantorFormRow,
  type CustomerSex,
} from "@/lib/customer-guarantors";

type Props = {
  value: CustomerGuarantorFormRow[];
  onChange: (rows: CustomerGuarantorFormRow[]) => void;
  fieldErrors?: Record<string, string>;
  /**
   * When editing an existing customer, used to preview ID front/back scans via our own
   * `/api/customers/{customerId}/documents/{documentId}` proxy (same-origin, auth via session
   * cookie) instead of a backend URL guessed from a bare document id — which may not be a route
   * the API actually serves.
   */
  customerId?: string;
  /**
   * Deletes a previously-uploaded guarantor attachment/collateral photo by document id
   * (`DELETE .../documents/{id}`). Return `true` on success so the row can drop it locally;
   * `false`/rejection leaves it. When omitted, already-uploaded files are shown read-only.
   */
  onDeleteExistingDocument?: (documentId: string) => Promise<boolean>;
  removingDocumentIds?: Set<string>;
  /**
   * Removes an already-saved guarantor row immediately through
   * `DELETE /customers/{customerId}/guarantors/{guarantorId}`.
   */
  onDeleteGuarantor?: (guarantorId: string) => Promise<boolean>;
};

/** Same-origin proxy for a customer document, used when we only have a document id (no signed URL). */
function customerDocumentProxyUrl(customerId: string | undefined, documentId: string | undefined): string | undefined {
  if (!customerId?.trim() || !documentId?.trim()) return undefined;
  return `/api/customers/${encodeURIComponent(customerId)}/documents/${encodeURIComponent(documentId)}`;
}

function rowFieldError(
  fieldErrors: Record<string, string> | undefined,
  index: number,
  field: string
) {
  return fieldErrors?.[`guarantors.${index}.${field}`];
}

function guarantorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/** Circular avatar upload for `guarantor_passport_photo`. */
function PassportAvatarField({
  index,
  name,
  file,
  existingUrl,
  existingPreviewUrl,
  error,
  onChange,
}: {
  index: number;
  name: string;
  file: File | null;
  existingUrl?: string;
  existingPreviewUrl?: string;
  error?: string;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const existingSrc = resolveMediaViewUrl(existingPreviewUrl, existingUrl);
  const displaySrc = previewUrl ?? existingSrc;
  const fieldKey = `guarantors.${index}.photoWithCustomer`;

  return (
    <Field data-invalid={Boolean(error)} data-form-field={fieldKey} className="gap-2">
      <FieldLabel>Passport photo</FieldLabel>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className={cn(
            "group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error && "ring-2 ring-destructive/50"
          )}
          onClick={() => inputRef.current?.click()}
          aria-label={displaySrc ? "Replace passport photo" : "Upload passport photo"}
        >
          <Avatar className="h-24 w-24 ring-2 ring-primary/15 transition group-hover:ring-primary/40">
            {displaySrc ? (
              <AvatarImage src={displaySrc} alt="Guarantor passport photo" className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-muted text-muted-foreground">
              {name.trim() ? (
                <span className="text-lg font-semibold">{guarantorInitials(name)}</span>
              ) : (
                <User className="h-8 w-8 opacity-50" aria-hidden />
              )}
            </AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Camera className="h-6 w-6 text-white" aria-hidden />
          </span>
        </button>
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-muted-foreground">
            Headshot used as the guarantor passport photo. {PHOTO_ACCEPT_HINT}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(e) => {
                onChange(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              {displaySrc ? "Replace photo" : "Upload photo"}
            </Button>
            {file ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function FileField({
  label,
  accept,
  file,
  error,
  hint,
  fieldKey,
  existingUrl,
  existingPreviewUrl,
  existingDocumentId,
  onRemoveExisting,
  removingExisting,
  onChange,
}: {
  label: string;
  accept: string;
  file: File | null;
  error?: string;
  hint?: string;
  fieldKey?: string;
  /** Already-uploaded document carried over from the backend record (shown when no new file is picked). */
  existingUrl?: string;
  existingPreviewUrl?: string;
  /** Backend document id for the existing file — enables deleting it without replacing it. */
  existingDocumentId?: string;
  onRemoveExisting?: (documentId: string) => void;
  removingExisting?: boolean;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = Boolean(file && (/^image\//i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)));
  const resolvedExistingPreview = existingPreviewUrl?.trim() || existingUrl?.trim() || "";
  const hasExistingPreview = Boolean(resolvedExistingPreview);

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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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
      ) : hasExistingPreview ? (
        <div className="mt-2 space-y-1 overflow-hidden rounded-md border bg-background">
          <CachedMediaPreview
            previewUrl={resolvedExistingPreview}
            authUrl={existingUrl || resolvedExistingPreview}
            alt={`${label} on file`}
            maxHeight="max-h-44"
            imageClassName="object-contain"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-2 py-1">
            <p className="text-xs text-muted-foreground">
              Current file on record — choose a new file above to replace it.
            </p>
            {existingDocumentId && onRemoveExisting ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={removingExisting}
                onClick={() => onRemoveExisting(existingDocumentId)}
              >
                {removingExisting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <X className="mr-1 h-3 w-3" />
                )}
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {file && largePhotoWarning(file) ? (
        <p className="text-xs text-amber-700">{largePhotoWarning(file)}</p>
      ) : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function isPreviewableImage(file: File): boolean {
  return /^image\//i.test(file.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

/** Grid thumbnail for a locally-selected file — shows an image preview, or a document icon for PDFs. */
function FileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = isPreviewableImage(file);

  useEffect(() => {
    if (!isImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
      <div className="flex h-24 items-center justify-center bg-muted/30">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
        )}
      </div>
      <p className="truncate border-t border-border bg-muted/40 px-1.5 py-1 text-[11px] text-muted-foreground">
        {file.name}
      </p>
    </div>
  );
}

/** Grid thumbnail for an already-uploaded attachment/collateral photo, with an optional remove action. */
function ExistingFileThumb({
  doc,
  onRemove,
  removing,
}: {
  doc: CustomerGuarantorExistingFile;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-background">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-70"
          aria-label={`Remove ${doc.name}`}
        >
          {removing ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <X className="h-3 w-3" aria-hidden />
          )}
        </button>
      ) : (
        <span
          className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white/70"
          title="Older upload without a document ID — can't be deleted individually. Re-upload the file to replace it."
        >
          <Lock className="h-3 w-3" aria-hidden />
        </span>
      )}
      <CachedMediaPreview
        previewUrl={doc.previewUrl}
        authUrl={doc.url}
        alt={doc.name}
        imageClassName="h-24"
      />
      <p className="truncate border-t border-border bg-muted/40 px-1.5 py-1 text-[11px] text-muted-foreground">
        {doc.name}
      </p>
    </div>
  );
}

function ExistingFilesGrid({
  docs,
  onRemove,
  removingIds,
}: {
  docs: CustomerGuarantorExistingFile[];
  onRemove?: (documentId: string) => void;
  removingIds?: Set<string>;
}) {
  // Hide legacy URL-only files (no document id) — they can't be deleted and only clutter the grid.
  const deletableDocs = docs.filter((doc) => Boolean(doc.id?.trim()));
  if (deletableDocs.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">Already on file</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {deletableDocs.map((doc, i) => (
          <ExistingFileThumb
            key={doc.id ?? `${doc.url}-${i}`}
            doc={doc}
            removing={Boolean(doc.id && removingIds?.has(doc.id))}
            onRemove={doc.id && onRemove ? () => onRemove(doc.id!) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function CustomerGuarantorsFields({
  value,
  onChange,
  fieldErrors,
  customerId,
  onDeleteExistingDocument,
  removingDocumentIds,
  onDeleteGuarantor,
}: Props) {
  const [removingGuarantorIds, setRemovingGuarantorIds] = useState<Set<string>>(new Set());
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

  const addCollateralImages = (index: number, files: FileList | null) => {
    if (!files?.length) return;
    onChange(
      value.map((row, i) =>
        i === index
          ? { ...row, collateralImages: [...row.collateralImages, ...Array.from(files)] }
          : row
      )
    );
  };

  const removeCollateralImage = (rowIndex: number, fileIndex: number) => {
    onChange(
      value.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              collateralImages: row.collateralImages.filter((_, j) => j !== fileIndex),
            }
          : row
      )
    );
  };

  const dropExistingDocumentLocally = (
    index: number,
    listKey: "existingAttachments" | "existingCollateralImages",
    documentId: string
  ) => {
    onChange(
      value.map((row, i) =>
        i === index
          ? { ...row, [listKey]: row[listKey].filter((d) => d.id !== documentId) }
          : row
      )
    );
  };

  const removeExistingDocument = async (
    index: number,
    listKey: "existingAttachments" | "existingCollateralImages",
    documentId: string
  ) => {
    if (onDeleteExistingDocument) {
      const ok = await onDeleteExistingDocument(documentId);
      if (!ok) return;
    }
    dropExistingDocumentLocally(index, listKey, documentId);
  };

  const removeExistingIdDocument = async (index: number, side: "idFront" | "idBack", documentId: string) => {
    if (onDeleteExistingDocument) {
      const ok = await onDeleteExistingDocument(documentId);
      if (!ok) return;
    }
    onChange(
      value.map((row, i) =>
        i === index
          ? side === "idFront"
            ? {
                ...row,
                idFrontDocumentId: undefined,
                existingIdFrontUrl: undefined,
                existingIdFrontPreviewUrl: undefined,
              }
            : {
                ...row,
                idBackDocumentId: undefined,
                existingIdBackUrl: undefined,
                existingIdBackPreviewUrl: undefined,
              }
          : row
      )
    );
  };

  const removeExistingSingleDocument = async (
    index: number,
    field: "photo" | "wardLetter",
    documentId: string
  ) => {
    if (onDeleteExistingDocument) {
      const ok = await onDeleteExistingDocument(documentId);
      if (!ok) return;
    }
    onChange(
      value.map((row, i) =>
        i === index
          ? field === "photo"
            ? {
                ...row,
                photoDocumentId: undefined,
                existingPhotoUrl: undefined,
                existingPhotoPreviewUrl: undefined,
              }
            : {
                ...row,
                wardLetterDocumentId: undefined,
                existingWardLetterUrl: undefined,
                existingWardLetterPreviewUrl: undefined,
              }
          : row
      )
    );
  };

  const addRow = () => {
    onChange([...value, emptyCustomerGuarantorRow()]);
  };

  const removeRow = async (index: number) => {
    const row = value[index];
    if (row?.id && onDeleteGuarantor) {
      const confirmed = window.confirm(
        "Remove this guarantor now? This deletes the guarantor record from the customer."
      );
      if (!confirmed) return;
      setRemovingGuarantorIds((prev) => new Set(prev).add(row.id!));
      try {
        const ok = await onDeleteGuarantor(row.id);
        if (!ok) return;
      } finally {
        setRemovingGuarantorIds((prev) => {
          const next = new Set(prev);
          next.delete(row.id!);
          return next;
        });
      }
    }
    if (value.length <= 1) {
      onChange([emptyCustomerGuarantorRow()]);
      return;
    }
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {value.map((row, index) => (
        <div
          key={row.id ?? index}
          className="rounded-lg border border-border p-4"
          data-form-field={`guarantors.${index}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Guarantor {index + 1}</p>
            {value.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={Boolean(row.id && removingGuarantorIds.has(row.id))}
                onClick={() => void removeRow(index)}
              >
                {row.id && removingGuarantorIds.has(row.id) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="sr-only">Remove guarantor {index + 1}</span>
              </Button>
            ) : null}
          </div>
          <FieldGroup>
            <PassportAvatarField
              index={index}
              name={row.name}
              file={row.photoWithCustomer}
              existingUrl={row.existingPassportPhotoUrl}
              existingPreviewUrl={row.existingPassportPhotoPreviewUrl}
              error={rowFieldError(fieldErrors, index, "photoWithCustomer")}
              onChange={(file) => updateRow(index, "photoWithCustomer", file)}
            />

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
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "sex"))}
                data-form-field={`guarantors.${index}.sex`}
              >
                <FieldLabel>Sex</FieldLabel>
                <Select
                  value={row.sex || undefined}
                  onValueChange={(v) => updateRow(index, "sex", v as CustomerSex)}
                >
                  <SelectTrigger
                    className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "sex")))}
                    {...formControlErrorProps(rowFieldError(fieldErrors, index, "sex"))}
                  >
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError>{rowFieldError(fieldErrors, index, "sex")}</FieldError>
              </Field>
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "idType"))}
                data-form-field={`guarantors.${index}.idType`}
              >
                <FieldLabel>ID type</FieldLabel>
                <Select
                  value={row.idType}
                  onValueChange={(value) => updateRow(index, "idType", value as CustomerIdType)}
                >
                  <SelectTrigger
                    className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "idType")))}
                    {...formControlErrorProps(rowFieldError(fieldErrors, index, "idType"))}
                  >
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_ID_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{rowFieldError(fieldErrors, index, "idType")}</FieldError>
              </Field>
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "nationalId"))}
                data-form-field={`guarantors.${index}.nationalId`}
              >
                <FieldLabel>ID number</FieldLabel>
                {row.idType === "NIDA" ? (
                  <TzValidatedInput
                    kind="nida"
                    value={row.nationalId}
                    aria-invalid={Boolean(rowFieldError(fieldErrors, index, "nationalId"))}
                    className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "nationalId")))}
                    {...formControlErrorProps(rowFieldError(fieldErrors, index, "nationalId"))}
                    onValueChange={(v) => updateRow(index, "nationalId", v)}
                  />
                ) : (
                  <Input
                    placeholder="Enter the guarantor ID number"
                    value={row.nationalId}
                    className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "nationalId")))}
                    {...formControlErrorProps(rowFieldError(fieldErrors, index, "nationalId"))}
                    onChange={(e) => updateRow(index, "nationalId", e.target.value)}
                  />
                )}
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
                hint={DOCUMENT_ACCEPT_HINT}
                file={row.idFront}
                error={rowFieldError(fieldErrors, index, "idFront")}
                fieldKey={`guarantors.${index}.idFront`}
                existingUrl={row.existingIdFrontUrl}
                existingPreviewUrl={
                  row.existingIdFrontPreviewUrl ??
                  customerDocumentProxyUrl(customerId, row.idFrontDocumentId)
                }
                existingDocumentId={row.idFrontDocumentId}
                removingExisting={Boolean(row.idFrontDocumentId && removingDocumentIds?.has(row.idFrontDocumentId))}
                onRemoveExisting={(documentId) => void removeExistingIdDocument(index, "idFront", documentId)}
                onChange={(file) => updateRow(index, "idFront", file)}
              />
              <FileField
                label="Guarantor ID back"
                accept="image/*,.pdf"
                hint={DOCUMENT_ACCEPT_HINT}
                file={row.idBack}
                error={rowFieldError(fieldErrors, index, "idBack")}
                fieldKey={`guarantors.${index}.idBack`}
                existingUrl={row.existingIdBackUrl}
                existingPreviewUrl={
                  row.existingIdBackPreviewUrl ??
                  customerDocumentProxyUrl(customerId, row.idBackDocumentId)
                }
                existingDocumentId={row.idBackDocumentId}
                removingExisting={Boolean(row.idBackDocumentId && removingDocumentIds?.has(row.idBackDocumentId))}
                onRemoveExisting={(documentId) => void removeExistingIdDocument(index, "idBack", documentId)}
                onChange={(file) => updateRow(index, "idBack", file)}
              />
            </div>

            <Separator />
            <p className="text-sm font-medium">Photos & supporting documents</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FileField
                label="Guarantor photo"
                accept="image/*"
                hint={PHOTO_ACCEPT_HINT}
                file={row.photo}
                error={rowFieldError(fieldErrors, index, "photo")}
                fieldKey={`guarantors.${index}.photo`}
                existingUrl={row.existingPhotoUrl}
                existingPreviewUrl={
                  row.existingPhotoPreviewUrl ??
                  customerDocumentProxyUrl(customerId, row.photoDocumentId)
                }
                existingDocumentId={row.photoDocumentId}
                removingExisting={Boolean(row.photoDocumentId && removingDocumentIds?.has(row.photoDocumentId))}
                onRemoveExisting={(documentId) => void removeExistingSingleDocument(index, "photo", documentId)}
                onChange={(file) => updateRow(index, "photo", file)}
              />
              <FileField
                label="Ward letter"
                accept="image/*,.pdf"
                hint={DOCUMENT_ACCEPT_HINT}
                file={row.wardLetter}
                error={rowFieldError(fieldErrors, index, "wardLetter")}
                fieldKey={`guarantors.${index}.wardLetter`}
                existingUrl={row.existingWardLetterUrl}
                existingPreviewUrl={
                  row.existingWardLetterPreviewUrl ??
                  customerDocumentProxyUrl(customerId, row.wardLetterDocumentId)
                }
                existingDocumentId={row.wardLetterDocumentId}
                removingExisting={Boolean(
                  row.wardLetterDocumentId && removingDocumentIds?.has(row.wardLetterDocumentId)
                )}
                onRemoveExisting={(documentId) =>
                  void removeExistingSingleDocument(index, "wardLetter", documentId)
                }
                onChange={(file) => updateRow(index, "wardLetter", file)}
              />
            </div>

            <Field
              data-invalid={Boolean(rowFieldError(fieldErrors, index, "collateralImages"))}
              data-form-field={`guarantors.${index}.collateralImages`}
            >
              <FieldLabel>Guarantor collateral photos</FieldLabel>
              <p className="text-xs text-muted-foreground">{PHOTO_ACCEPT_HINT}</p>
              <Input
                type="file"
                accept="image/*"
                multiple
                className={formControlErrorClass(
                  Boolean(rowFieldError(fieldErrors, index, "collateralImages"))
                )}
                {...formControlErrorProps(rowFieldError(fieldErrors, index, "collateralImages"))}
                onChange={(e) => addCollateralImages(index, e.target.files)}
              />
              <ExistingFilesGrid
                docs={row.existingCollateralImages}
                removingIds={removingDocumentIds}
                onRemove={(documentId) =>
                  void removeExistingDocument(index, "existingCollateralImages", documentId)
                }
              />
              {row.collateralImages.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {row.collateralImages.map((file, fileIndex) => (
                    <FileThumb
                      key={`${file.name}-${fileIndex}`}
                      file={file}
                      onRemove={() => removeCollateralImage(index, fileIndex)}
                    />
                  ))}
                </div>
              ) : null}
              <FieldError>{rowFieldError(fieldErrors, index, "collateralImages")}</FieldError>
            </Field>

            <Field
              data-invalid={Boolean(rowFieldError(fieldErrors, index, "attachments"))}
              data-form-field={`guarantors.${index}.attachments`}
            >
              <FieldLabel>Additional attachments</FieldLabel>
              <p className="text-xs text-muted-foreground">{DOCUMENT_ACCEPT_HINT}</p>
              <Input
                type="file"
                accept="image/*,.pdf"
                multiple
                className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "attachments")))}
                {...formControlErrorProps(rowFieldError(fieldErrors, index, "attachments"))}
                onChange={(e) => addAttachments(index, e.target.files)}
              />
              <ExistingFilesGrid
                docs={row.existingAttachments}
                removingIds={removingDocumentIds}
                onRemove={(documentId) =>
                  void removeExistingDocument(index, "existingAttachments", documentId)
                }
              />
              {row.attachments.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {row.attachments.map((file, fileIndex) => (
                    <FileThumb
                      key={`${file.name}-${fileIndex}`}
                      file={file}
                      onRemove={() => removeAttachment(index, fileIndex)}
                    />
                  ))}
                </div>
              ) : null}
              <FieldError>{rowFieldError(fieldErrors, index, "attachments")}</FieldError>
            </Field>
          </FieldGroup>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addRow}>
        <Plus className="mr-2 h-4 w-4" />
        Add guarantor
      </Button>
    </div>
  );
}
