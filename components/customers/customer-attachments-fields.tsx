"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, FileText, Home, Store, Trash2, Upload } from "lucide-react";
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

type CustomerAttachmentsFieldsProps = {
  value: CustomerAttachmentFormState;
  onChange: (next: CustomerAttachmentFormState) => void;
  existingHomeUrl?: string | null;
  existingBusinessUrl?: string | null;
  existingDocuments?: Array<{ name: string; url: string; previewUrl?: string | null }>;
  className?: string;
};

type ImageFieldProps = {
  id: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
  accept: string;
  file: File | null;
  existingUrl?: string | null;
  error?: string | null;
  onSelect: (file: File | null) => void;
};

function isImageDocument(doc: { name: string; url: string; previewUrl?: string | null }) {
  if (doc.previewUrl?.trim()) return true;
  return /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(doc.name) || /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(doc.url);
}

function ImageUploadField({
  id,
  title,
  hint,
  icon,
  accept,
  file,
  existingUrl,
  error,
  onSelect,
}: ImageFieldProps) {
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

  const displayUrl = previewUrl ?? existingUrl ?? null;

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
            <p className="text-xs font-medium text-foreground">Upload an image</p>
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
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            Browse
          </Button>
          {(file || existingUrl) && (
            <Button type="button" variant="outline" size="sm" onClick={() => onSelect(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {file ? <p className="text-xs text-muted-foreground">Selected: {file.name}</p> : null}
      {!file && existingUrl ? (
        <p className="text-xs text-muted-foreground">Current file on record (select a new image to replace).</p>
      ) : null}

      {displayUrl ? (
        <div className="overflow-hidden rounded-md border bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayUrl} alt={`${title} preview`} className="max-h-48 w-full object-cover" />
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

export function CustomerAttachmentsFields({
  value,
  onChange,
  existingHomeUrl,
  existingBusinessUrl,
  existingDocuments = [],
  className,
}: CustomerAttachmentsFieldsProps) {
  const docsInputRef = useRef<HTMLInputElement>(null);
  const docsId = useId();
  const [homeError, setHomeError] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  const setHome = (file: File | null) => {
    if (!file) {
      setHomeError(null);
      onChange({ ...value, home_location_photo: null });
      return;
    }
    const v = validateLocationPhoto(file);
    if (!v.ok) {
      setHomeError(v.error);
      return;
    }
    setHomeError(null);
    onChange({ ...value, home_location_photo: file });
  };

  const setBusiness = (file: File | null) => {
    if (!file) {
      setBusinessError(null);
      onChange({ ...value, business_location_photo: null });
      return;
    }
    const v = validateLocationPhoto(file);
    if (!v.ok) {
      setBusinessError(v.error);
      return;
    }
    setBusinessError(null);
    onChange({ ...value, business_location_photo: file });
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
      <ImageUploadField
        id="customer-home-photo"
        title="Home location photo"
        hint="Photo of where the customer lives — for field verification alongside the home map pin."
        icon={<Home className="h-3.5 w-3.5 text-emerald-700" aria-hidden />}
        accept={PHOTO_ACCEPT}
        file={value.home_location_photo}
        existingUrl={existingHomeUrl}
        error={homeError}
        onSelect={setHome}
      />

      <ImageUploadField
        id="customer-business-photo"
        title="Business location photo"
        hint="Photo of the customer's shop, office, or outlet — separate from the home photo."
        icon={<Store className="h-3.5 w-3.5 text-amber-700" aria-hidden />}
        accept={PHOTO_ACCEPT}
        file={value.business_location_photo}
        existingUrl={existingBusinessUrl}
        error={businessError}
        onSelect={setBusiness}
      />

      <div className="space-y-2 rounded-lg border border-border p-3">
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

                return (
                  <li key={doc.url} className="overflow-hidden rounded-md border bg-background text-xs">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{doc.name}</span>
                      </span>
                      {viewUrl ? (
                        <Button type="button" variant="ghost" size="sm" asChild>
                          <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            View
                          </a>
                        </Button>
                      ) : null}
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

        {docsError ? (
          <p role="alert" className="text-xs text-destructive">
            {docsError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
