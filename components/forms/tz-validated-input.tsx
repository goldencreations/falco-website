"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
 sanitizeTzNidaInput,
 sanitizeTzPhoneInput,
 TZ_NIDA_PLACEHOLDER,
 TZ_PHONE_PLACEHOLDER,
} from "@/lib/tz-form-inputs";

type TzValidatedInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
 kind: "phone" | "nida";
 value: string;
 onValueChange: (value: string) => void;
};

export function TzValidatedInput({
 kind,
 value,
 onValueChange,
 className,
 placeholder,
 inputMode = "numeric",
 ...props
}: TzValidatedInputProps) {
 const [shake, setShake] = useState(false);

 const triggerShake = useCallback(() => {
 setShake(true);
 window.setTimeout(() => setShake(false), 450);
 }, []);

 const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
 const raw = event.target.value;
 const result =
 kind === "phone"
 ? sanitizeTzPhoneInput(raw, value)
 : sanitizeTzNidaInput(raw, value);
 if (result.rejected) {
 triggerShake();
 return;
 }
 onValueChange(result.value);
 };

 return (
 <Input
 {...props}
 type="text"
 inputMode={inputMode}
 autoComplete="off"
 value={value}
 onChange={handleChange}
 placeholder={
 placeholder ?? (kind === "phone" ? TZ_PHONE_PLACEHOLDER : TZ_NIDA_PLACEHOLDER)
 }
 className={cn(shake && "animate-shake", className)}
 />
 );
}
