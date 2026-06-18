"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  formatRequiredDocumentLabel,
  normalizeDocumentType,
  uploadApplicationDocumentApi,
  validateDocumentFile,
  type DocumentFilesByType,
} from "@/lib/application-documents";

type FieldStatus = "idle" | "uploading" | "success" | "error";

type Props = {
  requiredTypes: string[];
  filesByType: DocumentFilesByType;
  onChange: (type: string, files: File[]) => void;
  uploadedTypes?: string[];
  applicationId?: string;
  uploadOnSelect?: boolean;
  onUploadComplete?: (type: string) => void;
};

function fileKey(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

function FilePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const isImage = /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name);
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  if (previewUrl) {
    return (
      <div className="overflow-hidden rounded-md border bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={file.name} className="max-h-48 w-full object-contain" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-muted-foreground">{file.name}</span>
    </div>
  );
}

export function RequiredDocumentsFields({
  requiredTypes,
  filesByType,
  onChange,
  uploadedTypes = [],
  applicationId,
  uploadOnSelect = false,
  onUploadComplete,
}: Props) {
  const [statusByType, setStatusByType] = useState<
    Record<string, { status: FieldStatus; message?: string }>
  >({});

  if (requiredTypes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No document types configured for this product.</p>
    );
  }

  const uploaded = new Set(uploadedTypes.map(normalizeDocumentType));
  const accept = ALLOWED_DOCUMENT_EXTENSIONS.join(",");

  const addFiles = async (rawType: string, fileList: FileList | null) => {
    if (!fileList?.length) return;
    const type = normalizeDocumentType(rawType);
    const existing = filesByType[type] ?? [];
    const next = [...existing];
    const added: File[] = [];

    for (const file of Array.from(fileList)) {
      const validation = validateDocumentFile(file);
      if (!validation.ok) {
        setStatusByType((prev) => ({ ...prev, [type]: { status: "error", message: validation.error } }));
        return;
      }
      if (!next.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) {
        next.push(file);
        added.push(file);
      }
    }

    if (added.length === 0) return;

    onChange(type, next);
    setStatusByType((prev) => ({ ...prev, [type]: { status: "idle" } }));

    if (!uploadOnSelect || !applicationId) return;

    setStatusByType((prev) => ({ ...prev, [type]: { status: "uploading" } }));
    for (const file of added) {
      const up = await uploadApplicationDocumentApi(applicationId, file, type);
      if (!up.ok) {
        setStatusByType((prev) => ({ ...prev, [type]: { status: "error", message: up.error } }));
        return;
      }
    }
    setStatusByType((prev) => ({
      ...prev,
      [type]: { status: "success", message: `${next.length} file${next.length === 1 ? "" : "s"} uploaded` },
    }));
    onUploadComplete?.(type);
  };

  const removeFile = (type: string, index: number) => {
    const next = (filesByType[type] ?? []).filter((_, i) => i !== index);
    onChange(type, next);
    setStatusByType((prev) => ({ ...prev, [type]: { status: next.length > 0 ? "idle" : "idle" } }));
  };

  const clearFiles = (type: string) => {
    onChange(type, []);
    setStatusByType((prev) => ({ ...prev, [type]: { status: "idle" } }));
  };

  return (
    <div className="space-y-4">
      {requiredTypes.map((rawType) => {
        const type = normalizeDocumentType(rawType);
        const selected = filesByType[type] ?? [];
        const fieldStatus = statusByType[type];
        const alreadyUploaded = uploaded.has(type);
        const isSuccess = alreadyUploaded || fieldStatus?.status === "success";

        return (
          <DocumentTypeField
            key={type}
            type={type}
            accept={accept}
            selected={selected}
            fieldStatus={fieldStatus}
            isSuccess={isSuccess}
            onAdd={(files) => void addFiles(type, files)}
            onRemove={(index) => removeFile(type, index)}
            onClear={() => clearFiles(type)}
          />
        );
      })}
    </div>
  );
}

function DocumentTypeField({
  type,
  accept,
  selected,
  fieldStatus,
  isSuccess,
  onAdd,
  onRemove,
  onClear,
}: {
  type: string;
  accept: string;
  selected: File[];
  fieldStatus?: { status: FieldStatus; message?: string };
  isSuccess: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`doc-${type}`} className="font-medium">
          {formatRequiredDocumentLabel(type)}
        </Label>
        {isSuccess ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            On file
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Optional</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        PDF, JPG, PNG, WEBP — max 10MB each. Add as many files as needed.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={`doc-${type}`}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          disabled={fieldStatus?.status === "uploading"}
          onChange={(e) => {
            onAdd(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={fieldStatus?.status === "uploading"}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Add files
        </Button>
        {selected.length > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear all
          </Button>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <ul className="space-y-3">
          {selected.map((file, index) => (
            <li key={fileKey(file, index)} className="space-y-2">
              <FilePreview file={file} />
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs text-muted-foreground">{file.name}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {fieldStatus?.status === "uploading" ? (
        <p className="text-xs text-muted-foreground">Uploading…</p>
      ) : null}
      {fieldStatus?.message ? (
        <p
          className={`text-xs ${fieldStatus.status === "error" ? "text-destructive" : "text-emerald-600"}`}
        >
          {fieldStatus.message}
        </p>
      ) : null}
    </div>
  );
}
