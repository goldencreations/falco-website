"use client";

import { Input } from "@/components/ui/input";
import { formatMoneyInput } from "@/lib/money-input";
import { cn } from "@/lib/utils";

type MoneyInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
 value: string;
 onValueChange: (value: string) => void;
};

export function MoneyInput({ value, onValueChange, className, inputMode, ...props }: MoneyInputProps) {
 return (
 <Input
 {...props}
 type="text"
 inputMode={inputMode ?? "decimal"}
 autoComplete="off"
 value={value}
 onChange={(event) => onValueChange(formatMoneyInput(event.target.value))}
 className={cn(className)}
 />
 );
}
