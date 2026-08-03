"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, FileText, Home, Store, Trash2, Upload, User } from "lucide-react";
import {
  CachedMediaPreview,
  resolveMediaViewUrl,
} from "@/components/media/cached-media-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DOCUMENT_ACCEPT,
  PHOTO_ACCEPT,
  type CustomerAttachmentFormState,
  validateLocationPhoto,
  validateSupportingDocument,
} from "@/lib/customer-attachments";
import { cn } from "@/lib/utils";

type ExistingPhoto = { id?: string; name: string; url: string; previewUrl?: string | null };

type CustomerAttachmentsFieldsProps = {
  value: CustomerAttachmentFormState;
  onChange: (next: CustomerAttachmentFormState) => void;
  existingPassportUrl?: string | null;
  existingPassportPreviewUrl?: string | null;
  existingHomePhotos?: ExistingPhoto[];
  existingBusinessPhotos?: ExistingPhoto[];
  existingDocuments?: Array<{ id?: string; name: string; url: string; previewUrl?: string | null }>;
  className?: string;
  fieldErrors?: Record<string, string>;
  /** Deletes a previously-uploaded document by id (`DELETE .../documents/{id}`). Omit to hide remove controls. */
  onRemoveExistingDocument?: (documentId: string) => unknown;
  /** Ids currently being deleted — used to show a busy state and prevent double-clicks. */
  removingDocumentIds?: Set<string>;
};

function isImageDocument(doc: { name: string; url: string; previewUrl?: string | null }) {
  if (doc.previewUrl?.trim()) return true;
  return /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(doc.name) || /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(doc.url);
}

function fileKey(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

type SingleImageUploadFieldProps = {
  id: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
  accept: string;
  file: File | null;
  existingUrl?: string | null;
  existingPreviewUrl?: string | null;
  error?: string | null;
  onSelect: (file: File | null) => void;
};

function SingleImageUploadField({
  id,
  title,
  hint,
  icon,
  accept,
  file,
  existingUrl,
  existingPreviewUrl,
  error,
  onSelect,
}: SingleImageUploadFieldProps) {
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

  const existingViewUrl = resolveMediaViewUrl(existingPreviewUrl, existingUrl);

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
        </Label>
        <Badge
          variant="secondary"
          className="border border-emerald-200/80 bg-emerald-50/90 text-[10px] font-normal text-emerald-800"
        >
          Optional
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>

      {!file && existingViewUrl ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">Current photo on file</p>
          <CachedMediaPreview
            previewUrl={existingPreviewUrl}
            authUrl={existingUrl ?? existingPreviewUrl ?? ""}
            alt={title}
            maxHeight="max-h-44"
            imageClassName="object-cover"
          />
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/20 px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left",
          error ? "border-destructive/40" : "border-border"
        )}
      >
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
            <Upload className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">
              {file ? "Replace photo" : "Upload photo"}
            </p>
            <p className="text-[11px] text-muted-foreground">JPG, JPEG, PNG, WEBP — max 5MB</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              onSelect(next);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            {file ? "Choose another" : "Browse"}
          </Button>
          {file ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onSelect(null)}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-md border bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={`${title} preview`} className="max-h-48 w-full object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={() => onSelect(null)}
            aria-label={`Remove ${title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type MultiImageUploadFieldProps = {
  id: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
  accept: string;
  files: File[];
  existingPhotos?: ExistingPhoto[];
  error?: string | null;
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  onClearAll: () => void;
  onRemoveExisting?: (documentId: string) => unknown;
  removingDocumentIds?: Set<string>;
};

function MultiImageUploadField({
  id,
  title,
  hint,
  icon,
  accept,
  files,
  existingPhotos = [],
  error,
  onAdd,
  onRemove,
  onClearAll,
  onRemoveExisting,
  removingDocumentIds,
}: MultiImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
        </Label>
        <Badge
          variant="secondary"
          className="border border-emerald-200/80 bg-emerald-50/90 text-[10px] font-normal text-emerald-800"
        >
          Optional
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>

      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/20 px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left",
          error ? "border-destructive/40" : "border-border"
        )}
      >
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
            <Upload className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">Upload photos</p>
            <p className="text-[11px] text-muted-foreground">
              Select one or more images — JPG, JPEG, PNG, WEBP — max 5MB each
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            onChange={(e) => {
              onAdd(e.target.files);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            Add photos
          </Button>
          {files.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={onClearAll}>
              Clear all
            </Button>
          ) : null}
        </div>
      </div>

      {existingPhotos.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            {existingPhotos.length === 1 ? "Current photo on file" : "Current photos on file"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {existingPhotos.map((photo, index) => {
              const isRemoving = Boolean(photo.id && removingDocumentIds?.has(photo.id));
              return (
                <div
                  key={`${photo.url}-${index}`}
                  className="relative overflow-hidden rounded-md border border-border bg-background"
                >
                  <CachedMediaPreview
                    previewUrl={photo.previewUrl}
                    authUrl={photo.url}
                    alt={photo.name}
                    maxHeight="max-h-44"
                    imageClassName="object-cover"
                  />
                  {photo.id && onRemoveExisting ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      disabled={isRemoving}
                      onClick={() => void onRemoveExisting(photo.id!)}
                      aria-label={`Remove ${photo.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <p className="truncate border-t px-2 py-1 text-[11px] text-muted-foreground">
                    {photo.name}
                  </p>
                </div>
              );
            })}
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add more photos below — new uploads are saved when you submit the form.
            </p>
          ) : null}
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="space-y-3">
          {files.map((file, index) => (
            <li
              key={fileKey(file, index)}
              className="overflow-hidden rounded-md border bg-background"
            >
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
                <span className="truncate text-muted-foreground">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {previewUrls[index] ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrls[index]}
                    alt={`${title} preview ${index + 1}`}
                    className="max-h-48 w-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-2 h-7 w-7"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CustomerAttachmentsFields({
  value,
  onChange,
  existingPassportUrl,
  existingPassportPreviewUrl,
  existingHomePhotos = [],
  existingBusinessPhotos = [],
  existingDocuments = [],
  className,
  fieldErrors,
  onRemoveExistingDocument,
  removingDocumentIds,
}: CustomerAttachmentsFieldsProps) {
  const docsInputRef = useRef<HTMLInputElement>(null);
  const docsId = useId();
  const [passportError, setPassportError] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  const selectPassportPhoto = (file: File | null) => {
    if (!file) {
      setPassportError(null);
      onChange({ ...value, passport_photo: null });
      return;
    }
    const v = validateLocationPhoto(file);
    if (!v.ok) {
      setPassportError(v.error);
      return;
    }
    setPassportError(null);
    onChange({ ...value, passport_photo: file });
  };

  const addHomePhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...value.home_location_photos];
    for (const file of Array.from(files)) {
      const v = validateLocationPhoto(file);
      if (!v.ok) {
        setHomeError(v.error);
        return;
      }
      if (!next.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) {
        next.push(file);
      }
    }
    setHomeError(null);
    onChange({ ...value, home_location_photos: next });
  };

  const addBusinessPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...value.business_location_photos];
    for (const file of Array.from(files)) {
      const v = validateLocationPhoto(file);
      if (!v.ok) {
        setBusinessError(v.error);
        return;
      }
      if (!next.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) {
        next.push(file);
      }
    }
    setBusinessError(null);
    onChange({ ...value, business_location_photos: next });
  };

  const addDocuments = (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...value.supporting_documents];
    for (const file of Array.from(files)) {
      const v = validateSupportingDocument(file);
      if (!v.ok) {
        setDocsError(v.error);
        return;
      }
      if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    setDocsError(null);
    onChange({ ...value, supporting_documents: next });
  };

  const removeDocument = (index: number) => {
    onChange({
      ...value,
      supporting_documents: value.supporting_documents.filter((_, i) => i !== index),
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div data-form-field="attachments.passport_photo">
      <SingleImageUploadField
        id="customer-passport-photo"
        title="Passport / profile photo"
        hint="Customer headshot used on the customer list and profile header."
        icon={<User className="h-3.5 w-3.5 text-sky-700" aria-hidden />}
        accept={PHOTO_ACCEPT}
        file={value.passport_photo}
        existingUrl={existingPassportUrl}
        existingPreviewUrl={existingPassportPreviewUrl}
        error={passportError ?? fieldErrors?.["attachments.passport_photo"] ?? null}
        onSelect={selectPassportPhoto}
      />
      </div>

      <div data-form-field="attachments.home_location_photos">
      <MultiImageUploadField
        id="customer-home-photos"
        title="Home location photos"
        hint="Upload one or more photos of where the customer lives — for field verification alongside the home map pin."
        icon={<Home className="h-3.5 w-3.5 text-emerald-700" aria-hidden />}
        accept={PHOTO_ACCEPT}
        files={value.home_location_photos}
        existingPhotos={existingHomePhotos}
        error={homeError ?? fieldErrors?.["attachments.home_location_photos"] ?? null}
        onAdd={addHomePhotos}
        onRemove={(index) =>
          onChange({
            ...value,
            home_location_photos: value.home_location_photos.filter((_, i) => i !== index),
          })
        }
        onClearAll={() => {
          setHomeError(null);
          onChange({ ...value, home_location_photos: [] });
        }}
        onRemoveExisting={onRemoveExistingDocument}
        removingDocumentIds={removingDocumentIds}
      />
      </div>

      <div data-form-field="attachments.business_location_photos">
      <MultiImageUploadField
        id="customer-business-photos"
        title="Business location photos"
        hint="Upload one or more photos of the customer's shop, office, or outlet."
        icon={<Store className="h-3.5 w-3.5 text-amber-700" aria-hidden />}
        accept={PHOTO_ACCEPT}
        files={value.business_location_photos}
        existingPhotos={existingBusinessPhotos}
        error={businessError ?? fieldErrors?.["attachments.business_location_photos"] ?? null}
        onAdd={addBusinessPhotos}
        onRemove={(index) =>
          onChange({
            ...value,
            business_location_photos: value.business_location_photos.filter((_, i) => i !== index),
          })
        }
        onClearAll={() => {
          setBusinessError(null);
          onChange({ ...value, business_location_photos: [] });
        }}
        onRemoveExisting={onRemoveExistingDocument}
        removingDocumentIds={removingDocumentIds}
      />
      </div>

      <div
        className={cn(
          "space-y-2 rounded-lg border border-border p-3",
          fieldErrors?.["attachments.supporting_documents"] && "border-destructive/40"
        )}
        data-form-field="attachments.supporting_documents"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={docsId} className="flex items-center gap-1.5 text-sm font-medium">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Supporting documents
          </Label>
          <Badge
            variant="secondary"
            className="border border-emerald-200/80 bg-emerald-50/90 text-[10px] font-normal text-emerald-800"
          >
            Optional
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload ID copies, business permits, or other supporting files. PDF, JPG, JPEG, PNG — max 10MB each.
          You can add multiple files in one go.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/20 px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
              <Upload className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">Add documents</p>
              <p className="text-[11px] text-muted-foreground">Select one or more files</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
            <input
              ref={docsInputRef}
              id={docsId}
              type="file"
              accept={DOCUMENT_ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                addDocuments(e.target.files);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => docsInputRef.current?.click()}>
              Browse
            </Button>
          </div>
        </div>

        {value.supporting_documents.length > 0 ? (
          <ul className="space-y-2">
            {value.supporting_documents.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{file.name}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeDocument(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {existingDocuments.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">On file</p>
            <ul className="space-y-2">
              {existingDocuments.map((doc) => {
                const viewUrl = resolveMediaViewUrl(doc.previewUrl, doc.url);
                const showPreview = isImageDocument(doc);
                const isRemoving = Boolean(doc.id && removingDocumentIds?.has(doc.id));

                return (
                  <li key={doc.url} className="overflow-hidden rounded-md border bg-background text-xs">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{doc.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {viewUrl ? (
                          <Button type="button" variant="ghost" size="sm" asChild>
                            <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              View
                            </a>
                          </Button>
                        ) : null}
                        {doc.id && onRemoveExistingDocument ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={isRemoving}
                            onClick={() => void onRemoveExistingDocument(doc.id!)}
                            aria-label={`Remove ${doc.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </span>
                    </div>
                    {showPreview ? (
                      <div className="border-t px-3 pb-3 pt-2">
                        <CachedMediaPreview
                          previewUrl={doc.previewUrl}
                          authUrl={doc.url}
                          alt={doc.name}
                          maxHeight="max-h-44"
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {docsError || fieldErrors?.["attachments.supporting_documents"] ? (
          <p role="alert" className="text-xs text-destructive">
            {docsError ?? fieldErrors?.["attachments.supporting_documents"]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
