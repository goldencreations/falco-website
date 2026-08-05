import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/logo_falco.jpeg";

type FalcoLogoProps = {
  className?: string;
  /** Square badge for sidebars and compact headers */
  markClassName?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Full horizontal wordmark for login and marketing headers */
  variant?: "mark" | "wordmark";
  priority?: boolean;
};

const markSizes = {
  sm: "h-9 w-9 rounded-lg p-0.5",
  md: "h-11 w-11 rounded-xl p-1",
  lg: "h-12 w-12 rounded-xl p-1",
} as const;

const wordmarkHeights = {
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
  xl: "h-[7.8rem] sm:h-[9.1rem]",
} as const;

const wordmarkDimensions = {
  sm: { width: 160, height: 48 },
  md: { width: 200, height: 56 },
  lg: { width: 220, height: 64 },
  xl: { width: 520, height: 156 },
} as const;

export function FalcoLogo({
  className,
  markClassName,
  size = "md",
  variant = "mark",
  priority = false,
}: FalcoLogoProps) {
  if (variant === "wordmark") {
    const dims = wordmarkDimensions[size in wordmarkDimensions ? size : "md"];
    return (
      <Image
        src={LOGO_SRC}
        alt="Falco Financial Services"
        width={dims.width}
        height={dims.height}
        priority={priority}
        className={cn("w-auto object-contain object-left", wordmarkHeights[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-sm ring-1 ring-border/60",
        markSizes[size],
        markClassName,
        className
      )}
    >
      <Image
        src={LOGO_SRC}
        alt="Falco Financial Services"
        width={44}
        height={44}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
