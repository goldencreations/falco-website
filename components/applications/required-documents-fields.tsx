"use client";

import { useState } from "react";
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
 setStatusByType((prev) => ({ ...prev, [type]: { status: "idle", message: "Optional — uploads on submit if selected" } }));
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
 return (
 <div key={type} className="space-y-2 rounded-lg border p-3">
 <div className="flex items-center justify-between gap-2">
 <Label htmlFor={`doc-${type}`} className="font-medium">
 {formatRequiredDocumentLabel(type)}
 </Label>
 {alreadyUploaded || fieldStatus?.status === "success" ? (
 <span className="text-xs font-medium text-emerald-600">On file</span>
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
 <p className="text-xs text-muted-foreground">Selected: {selected.name}</p>
 ) : null}
 {fieldStatus?.status === "uploading" ? (
 <p className="text-xs text-muted-foreground">Uploading…</p>
 ) : null}
 {fieldStatus?.message ? (
 <p
 className={`text-xs ${fieldStatus.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
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
