"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formControlErrorClass, formControlErrorProps } from "@/components/forms/form-field-message";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { CachedMediaPreview } from "@/components/media/cached-media-preview";
import { PHOTO_ACCEPT } from "@/lib/customer-attachments";
import {
  emptyCustomerCollateralRow,
  type CustomerCollateralFormRow,
} from "@/lib/customer-collateral";

type Props = {
  value: CustomerCollateralFormRow[];
  onChange: (rows: CustomerCollateralFormRow[]) => void;
  fieldErrors?: Record<string, string>;
  /**
   * Deletes a previously-uploaded collateral image by document id (`DELETE .../documents/{id}`).
   * Return `true` on success so the row can drop the image locally; `false`/rejection leaves it.
   * When omitted (or the image has no known document id), removal is local-only.
   */
  onDeleteExistingImage?: (documentId: string) => Promise<boolean>;
  removingDocumentIds?: Set<string>;
};

function rowFieldError(
  fieldErrors: Record<string, string> | undefined,
  index: number,
  field: string
) {
  return fieldErrors?.[`collateral.${index}.${field}`];
}

function CollateralImagePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove?: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!previewUrl) return null;

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt="Collateral preview"
        className="max-h-48 w-full object-contain bg-muted/20"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted px-2 py-1">
        <p className="truncate text-xs text-muted-foreground">{file.name}</p>
        {onRemove ? (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CollateralExistingImagePreview({
  authUrl,
  previewUrl,
  onRemove,
  removing,
}: {
  authUrl: string;
  previewUrl?: string;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <div className="space-y-1 overflow-hidden rounded-md border border-border">
      <CachedMediaPreview
        previewUrl={previewUrl}
        authUrl={authUrl}
        alt="Collateral on file"
        maxHeight="max-h-48"
        imageClassName="object-contain"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted px-2 py-1">
        <p className="text-xs text-muted-foreground">Current image on file</p>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            disabled={removing}
            onClick={onRemove}
          >
            {removing ? "Removing…" : "Remove"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CustomerCollateralFields({
  value,
  onChange,
  fieldErrors,
  onDeleteExistingImage,
  removingDocumentIds,
}: Props) {
  const updateRow = (
    index: number,
    key: keyof CustomerCollateralFormRow,
    next: string | File | File[] | null
  ) => {
    onChange(value.map((row, i) => (i === index ? { ...row, [key]: next } : row)));
  };

  const updateImages = (index: number, files: FileList | null) => {
    const nextFiles = files ? Array.from(files) : [];
    if (nextFiles.length === 0) return;
    onChange(
      value.map((row, i) =>
        i === index
          ? {
              ...row,
              images: [...row.images, ...nextFiles],
              image: row.images[0] ?? nextFiles[0] ?? null,
            }
          : row
      )
    );
  };

  const removeImage = (index: number, fileIndex: number) => {
    onChange(
      value.map((row, i) => {
        if (i !== index) return row;
        const nextFiles = row.images.filter((_, idx) => idx !== fileIndex);
        return {
          ...row,
          images: nextFiles,
          image: nextFiles[0] ?? null,
        };
      })
    );
  };

  const dropExistingImageLocally = (index: number, urlIndex: number) => {
    onChange(
      value.map((row, i) => {
        if (i !== index) return row;
        const nextUrls = row.existingImageUrls.filter((_, idx) => idx !== urlIndex);
        const nextDocIds = (row.existingImageDocumentIds ?? []).filter((_, idx) => idx !== urlIndex);
        return {
          ...row,
          existingImageUrls: nextUrls,
          existingImageDocumentIds: nextDocIds,
          existingImageUrl: nextUrls[0],
          existingImagePreviewUrl: nextUrls[0],
          imageDocumentId: nextUrls.length > 0 ? row.imageDocumentId : undefined,
          imageDocumentIds: nextUrls.length > 0 ? row.imageDocumentIds : [],
        };
      })
    );
  };

  const removeExistingImage = async (index: number, urlIndex: number) => {
    const documentId = value[index]?.existingImageDocumentIds?.[urlIndex];
    if (documentId && onDeleteExistingImage) {
      const ok = await onDeleteExistingImage(documentId);
      if (!ok) return;
    }
    dropExistingImageLocally(index, urlIndex);
  };

  const addRow = () => {
    onChange([...value, emptyCustomerCollateralRow()]);
  };

  const removeRow = (index: number) => {
    if (value.length <= 1) {
      onChange([emptyCustomerCollateralRow()]);
      return;
    }
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {value.map((row, index) => (
        <div
          key={index}
          className="rounded-lg border border-border p-4"
          data-form-field={`collateral.${index}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Collateral {index + 1}</p>
            {value.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)}>
                <Trash2 className="h-4 w-4" aria-hidden />
                <span className="sr-only">Remove collateral {index + 1}</span>
              </Button>
            ) : null}
          </div>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "collateralType"))}
                data-form-field={`collateral.${index}.collateralType`}
              >
                <FieldLabel>Collateral type</FieldLabel>
                <Input
                  placeholder="e.g., Motorcycle, TV, land title"
                  value={row.collateralType}
                  className={formControlErrorClass(
                    Boolean(rowFieldError(fieldErrors, index, "collateralType"))
                  )}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "collateralType"))}
                  onChange={(e) => updateRow(index, "collateralType", e.target.value)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "collateralType")}</FieldError>
              </Field>
              <Field
                data-invalid={Boolean(rowFieldError(fieldErrors, index, "estimatedValue"))}
                data-form-field={`collateral.${index}.estimatedValue`}
              >
                <FieldLabel>Estimated value (TZS)</FieldLabel>
                <MoneyInput
                  placeholder="e.g., 5,000,000"
                  value={row.estimatedValue}
                  className={formControlErrorClass(
                    Boolean(rowFieldError(fieldErrors, index, "estimatedValue"))
                  )}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "estimatedValue"))}
                  onValueChange={(v) => updateRow(index, "estimatedValue", v)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "estimatedValue")}</FieldError>
              </Field>
            </div>
            <Field
              data-invalid={Boolean(rowFieldError(fieldErrors, index, "description"))}
              data-form-field={`collateral.${index}.description`}
            >
              <FieldLabel>Description</FieldLabel>
              <Textarea
                placeholder="Describe the collateral item..."
                value={row.description}
                aria-invalid={Boolean(rowFieldError(fieldErrors, index, "description"))}
                className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "description")))}
                {...formControlErrorProps(rowFieldError(fieldErrors, index, "description"))}
                onChange={(e) => updateRow(index, "description", e.target.value)}
                rows={2}
              />
              <FieldError>{rowFieldError(fieldErrors, index, "description")}</FieldError>
            </Field>
            <Field
              data-invalid={Boolean(rowFieldError(fieldErrors, index, "images"))}
              data-form-field={`collateral.${index}.images`}
            >
              <FieldLabel>Collateral image</FieldLabel>
              <Input
                type="file"
                accept={PHOTO_ACCEPT}
                multiple
                className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "images")))}
                {...formControlErrorProps(rowFieldError(fieldErrors, index, "images"))}
                onChange={(e) => updateImages(index, e.target.files)}
              />
              <p className="text-xs text-muted-foreground">
                JPG, JPEG, PNG, or WEBP — max 5MB each. You can select multiple images.
              </p>
              {row.existingImageUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {row.existingImageUrls.map((authUrl, urlIndex) => {
                    const documentId = row.existingImageDocumentIds?.[urlIndex];
                    return (
                      <CollateralExistingImagePreview
                        key={`${authUrl}-${urlIndex}`}
                        authUrl={authUrl}
                        previewUrl={authUrl}
                        removing={Boolean(documentId && removingDocumentIds?.has(documentId))}
                        onRemove={() => void removeExistingImage(index, urlIndex)}
                      />
                    );
                  })}
                </div>
              ) : null}
              {row.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {row.images.map((file, fileIndex) => (
                    <CollateralImagePreview
                      key={`${file.name}-${file.size}-${file.lastModified}-${fileIndex}`}
                      file={file}
                      onRemove={() => removeImage(index, fileIndex)}
                    />
                  ))}
                </div>
              ) : null}
              <FieldError>{rowFieldError(fieldErrors, index, "images")}</FieldError>
            </Field>
          </FieldGroup>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        Add another collateral
      </Button>
    </div>
  );
}
