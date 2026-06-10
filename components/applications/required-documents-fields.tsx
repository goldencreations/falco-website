"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 ALLOWED_DOCUMENT_EXTENSIONS,
 formatRequiredDocumentLabel,
 normalizeDocumentType,
 uploadApplicationDocumentApi,
 validateDocumentFile,
} from "@/lib/application-documents";

type FieldStatus = "idle" | "uploading" | "success" | "error";

type Props = {
 requiredTypes: string[];
 filesByType: Record<string, File | null>;
 onChange: (type: string, file: File | null) => void;
 uploadedTypes?: string[];
 applicationId?: string;
 uploadOnSelect?: boolean;
 onUploadComplete?: (type: string) => void;
};

function FilePreview({ file }: { file: File }) {
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const urlRef = useRef<string | null>(null);

 useEffect(() => {
  const isImage = /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name);
  if (isImage) {
   const url = URL.createObjectURL(file);
   urlRef.current = url;
   setPreviewUrl(url);
   return () => {
    URL.revokeObjectURL(url);
    urlRef.current = null;
   };
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
 const [statusByType, setStatusByType] = useState<Record<string, { status: FieldStatus; message?: string }>>(
 {}
 );

 if (requiredTypes.length === 0) {
 return (
 <p className="text-sm text-muted-foreground">No document types configured for this product.</p>
 );
 }

 const uploaded = new Set(uploadedTypes.map(normalizeDocumentType));
 const accept = ALLOWED_DOCUMENT_EXTENSIONS.join(",");

 const handleFile = async (rawType: string, file: File | null) => {
 const type = normalizeDocumentType(rawType);
 onChange(type, file);
 if (!file) {
 setStatusByType((prev) => ({ ...prev, [type]: { status: "idle" } }));
 return;
 }

 const validation = validateDocumentFile(file);
 if (!validation.ok) {
 setStatusByType((prev) => ({ ...prev, [type]: { status: "error", message: validation.error } }));
 return;
 }

 if (!uploadOnSelect || !applicationId) {
 setStatusByType((prev) => ({ ...prev, [type]: { status: "idle" } }));
 return;
 }

 setStatusByType((prev) => ({ ...prev, [type]: { status: "uploading" } }));
 const up = await uploadApplicationDocumentApi(applicationId, file, type);
 if (!up.ok) {
 setStatusByType((prev) => ({ ...prev, [type]: { status: "error", message: up.error } }));
 return;
 }
 setStatusByType((prev) => ({ ...prev, [type]: { status: "success", message: "Uploaded" } }));
 onUploadComplete?.(type);
 };

 return (
 <div className="space-y-4">
 {requiredTypes.map((rawType) => {
 const type = normalizeDocumentType(rawType);
 const alreadyUploaded = uploaded.has(type);
 const selected = filesByType[type];
 const fieldStatus = statusByType[type];
 const isSuccess = alreadyUploaded || fieldStatus?.status === "success";
 return (
 <div key={type} className="space-y-2 rounded-lg border p-3">
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
 <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WEBP — max 10MB</p>
 <Input
  id={`doc-${type}`}
  type="file"
  accept={accept}
  disabled={fieldStatus?.status === "uploading"}
  onChange={(e) => void handleFile(type, e.target.files?.[0] ?? null)}
 />
 {selected ? (
  <div className="space-y-2">
   <FilePreview file={selected} />
   <div className="flex items-center justify-between gap-2">
    <p className="truncate text-xs text-muted-foreground">{selected.name}</p>
    <Button
     type="button"
     variant="ghost"
     size="sm"
     className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
     onClick={() => {
      onChange(type, null);
      setStatusByType((prev) => ({ ...prev, [type]: { status: "idle" } }));
      const input = document.getElementById(`doc-${type}`) as HTMLInputElement | null;
      if (input) input.value = "";
     }}
    >
     <X className="mr-1 h-3 w-3" />
     Remove
    </Button>
   </div>
  </div>
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
 })}
 </div>
 );
}
