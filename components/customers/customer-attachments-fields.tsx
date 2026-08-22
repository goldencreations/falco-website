"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ExternalLink, FileText, Home, Store, Trash2, Upload, User } from "lucide-react";
import {
  CachedMediaPreview,
  FORM_ATTACHMENT_PREVIEW_MAX_HEIGHT,
  LocalFilePreview,
  resolveMediaViewUrl,
} from "@/components/media/cached-media-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_ACCEPT_HINT,
  PHOTO_ACCEPT,
  PHOTO_ACCEPT_HINT,
  type CustomerAttachmentFormState,
  validateLocationPhoto,
  validateSupportingDocument,
} from "@/lib/customer-attachments";
import { largePhotoWarning } from "@/lib/upload-limits";
import { isPreviewableDocumentFilename, isPreviewableUploadFile } from "@/lib/media-preview";
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

function isPreviewableDocument(doc: { name: string; url: string; previewUrl?: string | null }) {
  return isPreviewableDocumentFilename(doc.name, doc.url ?? doc.previewUrl);
}

function fileKey(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

function newUploadKey(index: number) {
  return `new:${index}`;
}

function existingDocumentKey(id: string) {
  return `existing-id:${id}`;
}

function existingPhotoKey(photo: ExistingPhoto, index: number) {
  if (photo.id) return existingDocumentKey(photo.id);
  return `existing-index:${index}`;
}

function useBulkSelection() {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedKeys(new Set());
      return !prev;
    });
  }, []);

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllKeys = useCallback((keys: string[]) => {
    setSelectedKeys((prev) => {
      const allSelected = keys.length > 0 && keys.every((key) => prev.has(key));
      return allSelected ? new Set() : new Set(keys);
    });
  }, []);

  const clearSelected = useCallback(() => setSelectedKeys(new Set()), []);

  return {
    selectionMode,
    selectedKeys,
    toggleSelectionMode,
    toggleKey,
    selectAllKeys,
    clearSelected,
    setSelectionMode,
  };
}

type BulkSelectToolbarProps = {
  selectionMode: boolean;
  selectedCount: number;
  selectableCount: number;
  bulkDeleting?: boolean;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
};

function BulkSelectToolbar({
  selectionMode,
  selectedCount,
  selectableCount,
  bulkDeleting = false,
  onToggleSelectionMode,
  onSelectAll,
  onDeleteSelected,
}: BulkSelectToolbarProps) {
  if (selectableCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={selectionMode ? "secondary" : "outline"}
        size="sm"
        onClick={onToggleSelectionMode}
      >
        {selectionMode ? "Cancel" : "Select"}
      </Button>
      {selectionMode ? (
        <>
          <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
            {selectedCount === selectableCount ? "Deselect all" : "Select all"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={selectedCount === 0 || bulkDeleting}
            onClick={onDeleteSelected}
          >
            {bulkDeleting ? "Deleting…" : `Delete selected${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
          </Button>
        </>
      ) : null}
    </div>
  );
}

type SelectableItemShellProps = {
  selectionMode: boolean;
  selected: boolean;
  selectable: boolean;
  onToggleSelect: () => void;
  children: React.ReactNode;
  className?: string;
};

function SelectableItemShell({
  selectionMode,
  selected,
  selectable,
  onToggleSelect,
  children,
  className,
}: SelectableItemShellProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-background",
        selectionMode && selectable && "cursor-pointer",
        selectionMode && selected && "border-primary ring-2 ring-primary/40",
        className
      )}
      onClick={selectionMode && selectable ? onToggleSelect : undefined}
      onKeyDown={
        selectionMode && selectable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleSelect();
              }
            }
          : undefined
      }
      role={selectionMode && selectable ? "button" : undefined}
      tabIndex={selectionMode && selectable ? 0 : undefined}
    >
      {selectionMode && selectable ? (
        <div
          className="absolute left-2 top-2 z-10 rounded-md bg-background/90 p-0.5 shadow-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect()}
            aria-label="Select item"
          />
        </div>
      ) : null}
      {children}
    </div>
  );
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
        <div className="w-fit max-w-full space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">Current photo on file</p>
          <CachedMediaPreview
            previewUrl={existingPreviewUrl}
            authUrl={existingUrl ?? existingPreviewUrl ?? ""}
            alt={title}
            fit
            maxHeight={FORM_ATTACHMENT_PREVIEW_MAX_HEIGHT}
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
            <p className="text-[11px] text-muted-foreground">{PHOTO_ACCEPT_HINT}</p>
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
      {file && largePhotoWarning(file) ? (
        <p className="text-xs text-amber-700">{largePhotoWarning(file)}</p>
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
  onRemoveMany?: (indices: number[]) => void;
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
  onRemoveMany,
  onClearAll,
  onRemoveExisting,
  removingDocumentIds,
}: MultiImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const {
    selectionMode,
    selectedKeys,
    toggleSelectionMode,
    toggleKey,
    selectAllKeys,
    clearSelected,
    setSelectionMode,
  } = useBulkSelection();

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const selectableKeys = useMemo(() => {
    const keys: string[] = [];
    existingPhotos.forEach((photo, index) => {
      if (photo.id && onRemoveExisting) keys.push(existingPhotoKey(photo, index));
    });
    files.forEach((_, index) => keys.push(newUploadKey(index)));
    return keys;
  }, [existingPhotos, files, onRemoveExisting]);

  useEffect(() => {
    if (selectionMode && selectableKeys.length === 0) {
      setSelectionMode(false);
      clearSelected();
    }
  }, [clearSelected, selectableKeys.length, selectionMode, setSelectionMode]);

  const handleDeleteSelected = async () => {
    const newIndices: number[] = [];
    const existingIds: string[] = [];

    for (const key of selectedKeys) {
      if (key.startsWith("new:")) {
        newIndices.push(Number(key.slice(4)));
      } else if (key.startsWith("existing-id:")) {
        existingIds.push(key.slice("existing-id:".length));
      }
    }

    if (newIndices.length > 0) {
      if (onRemoveMany) {
        onRemoveMany(newIndices);
      } else {
        [...newIndices].sort((a, b) => b - a).forEach((index) => onRemove(index));
      }
    }

    if (existingIds.length > 0 && onRemoveExisting) {
      setBulkDeleting(true);
      try {
        for (const documentId of existingIds) {
          await onRemoveExisting(documentId);
        }
      } finally {
        setBulkDeleting(false);
      }
    }

    clearSelected();
    setSelectionMode(false);
  };

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
              Select one or more images — {PHOTO_ACCEPT_HINT}
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
          {files.length > 0 && !selectionMode ? (
            <Button type="button" variant="outline" size="sm" onClick={onClearAll}>
              Clear all
            </Button>
          ) : null}
        </div>
      </div>

      <BulkSelectToolbar
        selectionMode={selectionMode}
        selectedCount={selectedKeys.size}
        selectableCount={selectableKeys.length}
        bulkDeleting={bulkDeleting}
        onToggleSelectionMode={toggleSelectionMode}
        onSelectAll={() => selectAllKeys(selectableKeys)}
        onDeleteSelected={() => void handleDeleteSelected()}
      />

      {existingPhotos.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            {existingPhotos.length === 1 ? "Current photo on file" : "Current photos on file"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {existingPhotos.map((photo, index) => {
              const isRemoving = Boolean(photo.id && removingDocumentIds?.has(photo.id));
              const itemKey = existingPhotoKey(photo, index);
              const selectable = Boolean(photo.id && onRemoveExisting);
              const selected = selectedKeys.has(itemKey);

              return (
                <SelectableItemShell
                  key={`${photo.url}-${index}`}
                  selectionMode={selectionMode}
                  selected={selected}
                  selectable={selectable}
                  onToggleSelect={() => toggleKey(itemKey)}
                  className="border-border"
                >
                  <CachedMediaPreview
                    previewUrl={photo.previewUrl}
                    authUrl={photo.url}
                    alt={photo.name}
                    maxHeight="max-h-44"
                    imageClassName="object-cover"
                  />
                  {!selectionMode && photo.id && onRemoveExisting ? (
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
                </SelectableItemShell>
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
        <ul className="flex flex-wrap gap-3">
          {files.map((file, index) => {
            const itemKey = newUploadKey(index);
            const selected = selectedKeys.has(itemKey);

            return (
              <li key={fileKey(file, index)} className="w-fit max-w-full">
                <SelectableItemShell
                  selectionMode={selectionMode}
                  selected={selected}
                  selectable
                  onToggleSelect={() => toggleKey(itemKey)}
                >
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
                    <span className="max-w-[12rem] truncate text-muted-foreground">{file.name}</span>
                    {!selectionMode ? (
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
                    ) : null}
                  </div>
                  {previewUrls[index] ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrls[index]}
                        alt={`${title} preview ${index + 1}`}
                        className="max-h-48 w-full object-cover"
                      />
                      {!selectionMode ? (
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
                      ) : null}
                    </div>
                  ) : null}
                </SelectableItemShell>
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {files.map((file) => largePhotoWarning(file)).filter(Boolean).length > 0 ? (
        <div className="space-y-1">
          {files.map((file) => {
            const warning = largePhotoWarning(file);
            return warning ? (
              <p key={file.name} className="text-xs text-amber-700">
                {warning}
              </p>
            ) : null;
          })}
        </div>
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

  const removeDocuments = (indices: number[]) => {
    const toRemove = new Set(indices);
    onChange({
      ...value,
      supporting_documents: value.supporting_documents.filter((_, i) => !toRemove.has(i)),
    });
  };

  const docsBulk = useBulkSelection();
  const [docsBulkDeleting, setDocsBulkDeleting] = useState(false);

  const docsSelectableKeys = useMemo(() => {
    const keys: string[] = [];
    value.supporting_documents.forEach((_, index) => keys.push(newUploadKey(index)));
    existingDocuments.forEach((doc) => {
      if (doc.id && onRemoveExistingDocument) keys.push(existingDocumentKey(doc.id));
    });
    return keys;
  }, [existingDocuments, onRemoveExistingDocument, value.supporting_documents]);

  useEffect(() => {
    if (docsBulk.selectionMode && docsSelectableKeys.length === 0) {
      docsBulk.setSelectionMode(false);
      docsBulk.clearSelected();
    }
  }, [
    docsBulk.selectionMode,
    docsBulk.clearSelected,
    docsBulk.setSelectionMode,
    docsSelectableKeys.length,
  ]);

  const handleDeleteSelectedDocuments = async () => {
    const newIndices: number[] = [];
    const existingIds: string[] = [];

    for (const key of docsBulk.selectedKeys) {
      if (key.startsWith("new:")) {
        newIndices.push(Number(key.slice(4)));
      } else if (key.startsWith("existing-id:")) {
        existingIds.push(key.slice("existing-id:".length));
      }
    }

    if (newIndices.length > 0) {
      removeDocuments(newIndices);
    }

    if (existingIds.length > 0 && onRemoveExistingDocument) {
      setDocsBulkDeleting(true);
      try {
        for (const documentId of existingIds) {
          await onRemoveExistingDocument(documentId);
        }
      } finally {
        setDocsBulkDeleting(false);
      }
    }

    docsBulk.clearSelected();
    docsBulk.setSelectionMode(false);
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
        onRemoveMany={(indices) => {
          const toRemove = new Set(indices);
          onChange({
            ...value,
            home_location_photos: value.home_location_photos.filter((_, i) => !toRemove.has(i)),
          });
        }}
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
        onRemoveMany={(indices) => {
          const toRemove = new Set(indices);
          onChange({
            ...value,
            business_location_photos: value.business_location_photos.filter((_, i) => !toRemove.has(i)),
          });
        }}
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
          Upload ID copies, business permits, or other supporting files. {DOCUMENT_ACCEPT_HINT}
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

        <BulkSelectToolbar
          selectionMode={docsBulk.selectionMode}
          selectedCount={docsBulk.selectedKeys.size}
          selectableCount={docsSelectableKeys.length}
          bulkDeleting={docsBulkDeleting}
          onToggleSelectionMode={docsBulk.toggleSelectionMode}
          onSelectAll={() => docsBulk.selectAllKeys(docsSelectableKeys)}
          onDeleteSelected={() => void handleDeleteSelectedDocuments()}
        />

        {value.supporting_documents.length > 0 ? (
          <ul className="flex flex-wrap gap-3">
            {value.supporting_documents.map((file, index) => {
              const itemKey = newUploadKey(index);
              const selected = docsBulk.selectedKeys.has(itemKey);

              return (
                <li key={`${file.name}-${file.size}-${index}`} className="w-fit max-w-full">
                  <SelectableItemShell
                    selectionMode={docsBulk.selectionMode}
                    selected={selected}
                    selectable
                    onToggleSelect={() => docsBulk.toggleKey(itemKey)}
                    className="text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="max-w-[12rem] truncate text-muted-foreground">{file.name}</span>
                      </span>
                      {!docsBulk.selectionMode ? (
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
                      ) : null}
                    </div>
                    {isPreviewableUploadFile(file) ? (
                      <div className="relative px-3 pb-3 pt-2">
                        <LocalFilePreview
                          file={file}
                          alt={file.name}
                          maxHeight={FORM_ATTACHMENT_PREVIEW_MAX_HEIGHT}
                        />
                        {!docsBulk.selectionMode ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute right-5 top-4 h-7 w-7"
                            onClick={() => removeDocument(index)}
                            aria-label={`Remove ${file.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </SelectableItemShell>
                </li>
              );
            })}
          </ul>
        ) : null}

        {existingDocuments.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">On file</p>
            <ul className="flex flex-wrap gap-3">
              {existingDocuments.map((doc, index) => {
                const viewUrl = resolveMediaViewUrl(doc.previewUrl, doc.url);
                const showPreview = isPreviewableDocument(doc);
                const isRemoving = Boolean(doc.id && removingDocumentIds?.has(doc.id));
                const itemKey = doc.id ? existingDocumentKey(doc.id) : `existing-index:${index}`;
                const selectable = Boolean(doc.id && onRemoveExistingDocument);
                const selected = docsBulk.selectedKeys.has(itemKey);

                return (
                  <li
                    key={doc.id ?? `${doc.url}-${doc.name}-${index}`}
                    className={cn(
                      showPreview ? "w-fit max-w-full" : "w-full min-w-0"
                    )}
                  >
                    <SelectableItemShell
                      selectionMode={docsBulk.selectionMode}
                      selected={selected}
                      selectable={selectable}
                      onToggleSelect={() => docsBulk.toggleKey(itemKey)}
                      className="text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">{doc.name}</span>
                        </span>
                        {!docsBulk.selectionMode ? (
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
                        ) : null}
                      </div>
                      {showPreview ? (
                        <div className="inline-block w-fit max-w-full border-t px-3 pb-3 pt-2">
                          <CachedMediaPreview
                            previewUrl={doc.previewUrl}
                            authUrl={doc.url}
                            alt={doc.name}
                            fit
                            maxHeight={FORM_ATTACHMENT_PREVIEW_MAX_HEIGHT}
                          />
                        </div>
                      ) : null}
                    </SelectableItemShell>
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
