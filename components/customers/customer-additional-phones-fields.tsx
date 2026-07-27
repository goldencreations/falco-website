"use client";

import { Plus, Trash2 } from "lucide-react";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import { formControlErrorClass, formControlErrorProps } from "@/components/forms/form-field-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MAX_ADDITIONAL_CUSTOMER_PHONES } from "@/lib/customer-phones";

type Props = {
  value: string[];
  onChange: (phones: string[]) => void;
  fieldErrors?: Record<string, string>;
};

export function CustomerAdditionalPhonesFields({ value, onChange, fieldErrors }: Props) {
  const phones = value.length > 0 ? value : [];

  const updateAt = (index: number, next: string) => {
    const rows = [...phones];
    rows[index] = next;
    onChange(rows);
  };

  const addPhone = () => {
    if (phones.length >= MAX_ADDITIONAL_CUSTOMER_PHONES) return;
    onChange([...phones, ""]);
  };

  const removeAt = (index: number) => {
    onChange(phones.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 md:col-span-2" data-form-field="additional_phones">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>Additional phone numbers</Label>
          <p className="text-xs text-muted-foreground">
            Optional. Up to {MAX_ADDITIONAL_CUSTOMER_PHONES} extra numbers.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={phones.length >= MAX_ADDITIONAL_CUSTOMER_PHONES}
          onClick={addPhone}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add phone number
        </Button>
      </div>

      {phones.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          No additional numbers yet.
        </p>
      ) : (
        <div className="space-y-2">
          {phones.map((phone, index) => {
            const error =
              fieldErrors?.[`additional_phones.${index}`] ??
              (index === 0 ? fieldErrors?.alt_phone : undefined);
            return (
              <div
                key={index}
                className="flex items-start gap-2"
                data-form-field={`additional_phones.${index}`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <TzValidatedInput
                    kind="phone"
                    value={phone}
                    placeholder={`Additional phone ${index + 1}`}
                    className={formControlErrorClass(Boolean(error))}
                    {...formControlErrorProps(error)}
                    onValueChange={(next) => updateAt(index, next)}
                  />
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAt(index)}
                  aria-label={`Remove additional phone ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {fieldErrors?.additional_phones ? (
        <p className="text-xs text-destructive">{fieldErrors.additional_phones}</p>
      ) : null}
    </div>
  );
}
