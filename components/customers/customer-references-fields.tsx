"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formControlErrorClass, formControlErrorProps } from "@/components/forms/form-field-message";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import type { CustomerSex } from "@/lib/customer-guarantors";
import { emptyCustomerReferenceRow, type CustomerReferenceFormRow } from "@/lib/customer-references";

type Props = {
  value: CustomerReferenceFormRow[];
  onChange: (rows: CustomerReferenceFormRow[]) => void;
  fieldErrors?: Record<string, string>;
};

function rowFieldError(
  fieldErrors: Record<string, string> | undefined,
  index: number,
  field: string
) {
  return fieldErrors?.[`references.${index}.${field}`];
}

export function CustomerReferencesFields({ value, onChange, fieldErrors }: Props) {
  const updateRow = (index: number, key: keyof CustomerReferenceFormRow, next: string) => {
    onChange(value.map((row, i) => (i === index ? { ...row, [key]: next } : row)));
  };

  const addRow = () => {
    onChange([...value, emptyCustomerReferenceRow()]);
  };

  const removeRow = (index: number) => {
    if (value.length <= 1) {
      onChange([emptyCustomerReferenceRow()]);
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
          data-form-field={`references.${index}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Reference {index + 1}</p>
            {value.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(rowFieldError(fieldErrors, index, "name"))}>
                <FieldLabel>Full name</FieldLabel>
                <Input
                  placeholder="Reference full name"
                  value={row.name}
                  className={formControlErrorClass(Boolean(rowFieldError(fieldErrors, index, "name")))}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "name"))}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "name")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(rowFieldError(fieldErrors, index, "sex"))}>
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
              <Field data-invalid={Boolean(rowFieldError(fieldErrors, index, "relationship"))}>
                <FieldLabel>Relationship</FieldLabel>
                <Input
                  placeholder="e.g., Friend, cousin, neighbor"
                  value={row.relationship}
                  className={formControlErrorClass(
                    Boolean(rowFieldError(fieldErrors, index, "relationship"))
                  )}
                  {...formControlErrorProps(rowFieldError(fieldErrors, index, "relationship"))}
                  onChange={(e) => updateRow(index, "relationship", e.target.value)}
                />
                <FieldError>{rowFieldError(fieldErrors, index, "relationship")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(rowFieldError(fieldErrors, index, "phone"))}>
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
              <Field className="sm:col-span-2">
                <FieldLabel>Address / location</FieldLabel>
                <Input
                  placeholder="Where this reference can be found"
                  value={row.address}
                  onChange={(e) => updateRow(index, "address", e.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addRow}>
        <Plus className="mr-2 h-4 w-4" />
        Add reference
      </Button>
    </div>
  );
}
