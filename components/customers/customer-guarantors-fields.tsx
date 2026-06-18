"use client";

import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import {
  MAX_CUSTOMER_GUARANTORS,
  type CustomerGuarantorFormRow,
} from "@/lib/customer-guarantors";

type Props = {
  value: CustomerGuarantorFormRow[];
  onChange: (rows: CustomerGuarantorFormRow[]) => void;
};

export function CustomerGuarantorsFields({ value, onChange }: Props) {
  const updateRow = (
    index: number,
    key: keyof CustomerGuarantorFormRow,
    next: string | File | null
  ) => {
    onChange(
      value.map((row, i) => (i === index ? { ...row, [key]: next } : row))
    );
  };

  return (
    <div className="space-y-4">
      {value.slice(0, MAX_CUSTOMER_GUARANTORS).map((row, index) => (
        <div key={index} className="rounded-lg border border-border p-4">
          <p className="mb-3 text-sm font-semibold">Guarantor {index + 1}</p>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Full name</FieldLabel>
                <Input
                  placeholder="Guarantor full name"
                  value={row.name}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>National ID</FieldLabel>
                <TzValidatedInput
                  kind="nida"
                  value={row.nationalId}
                  onValueChange={(v) => updateRow(index, "nationalId", v)}
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
                <FieldLabel>Relationship</FieldLabel>
                <Select
                  value={row.relationship}
                  onValueChange={(v) => updateRow(index, "relationship", v)}
                >
                  <SelectTrigger>
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
              </Field>
            </div>
            {row.relationship === "other" ? (
              <Field>
                <FieldLabel>Specify relationship</FieldLabel>
                <Input
                  placeholder="Enter relationship"
                  value={row.otherRelationship}
                  onChange={(e) => updateRow(index, "otherRelationship", e.target.value)}
                />
              </Field>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Guarantor ID front</FieldLabel>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => updateRow(index, "idFront", e.target.files?.[0] ?? null)}
                />
                {row.idFront ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{row.idFront.name}</p>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>Guarantor ID back</FieldLabel>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => updateRow(index, "idBack", e.target.files?.[0] ?? null)}
                />
                {row.idBack ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{row.idBack.name}</p>
                ) : null}
              </Field>
            </div>
          </FieldGroup>
        </div>
      ))}
    </div>
  );
}
