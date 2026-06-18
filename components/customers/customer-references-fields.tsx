"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import {
  MAX_CUSTOMER_REFERENCES,
  type CustomerReferenceFormRow,
} from "@/lib/customer-references";

type Props = {
  value: CustomerReferenceFormRow[];
  onChange: (rows: CustomerReferenceFormRow[]) => void;
};

export function CustomerReferencesFields({ value, onChange }: Props) {
  const updateRow = (index: number, key: keyof CustomerReferenceFormRow, next: string) => {
    onChange(value.map((row, i) => (i === index ? { ...row, [key]: next } : row)));
  };

  const addRow = () => {
    if (value.length >= MAX_CUSTOMER_REFERENCES) return;
    onChange([...value, { name: "", phone: "", relationship: "", address: "" }]);
  };

  const removeRow = (index: number) => {
    if (value.length <= 1) {
      onChange([{ name: "", phone: "", relationship: "", address: "" }]);
      return;
    }
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {value.slice(0, MAX_CUSTOMER_REFERENCES).map((row, index) => (
        <div key={index} className="rounded-lg border border-border p-4">
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
              <Field>
                <FieldLabel>Full name</FieldLabel>
                <Input
                  placeholder="Reference full name"
                  value={row.name}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Relationship</FieldLabel>
                <Input
                  placeholder="e.g., Friend, cousin, neighbor"
                  value={row.relationship}
                  onChange={(e) => updateRow(index, "relationship", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Phone number</FieldLabel>
                <TzValidatedInput
                  kind="phone"
                  value={row.phone}
                  onValueChange={(v) => updateRow(index, "phone", v)}
                />
              </Field>
              <Field>
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
      {value.length < MAX_CUSTOMER_REFERENCES ? (
        <Button type="button" variant="outline" onClick={addRow}>
          <Plus className="mr-2 h-4 w-4" />
          Add reference
        </Button>
      ) : null}
    </div>
  );
}
