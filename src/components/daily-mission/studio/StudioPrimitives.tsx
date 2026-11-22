"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type TactileVariant =
  | "primary"
  | "info"
  | "warning"
  | "accent"
  | "secondary"
  | "danger"
  | "outline"
  | "ghost";
export type TactileSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<TactileVariant, string> = {
  primary:
    "bg-[#059669] text-white border-[#047857] shadow-[0_4px_0_#047857] hover:bg-[#10B981] active:shadow-none active:translate-y-[4px]",
  info:
    "bg-[#6366F1] text-white border-[#4338CA] shadow-[0_4px_0_#4338CA] hover:bg-[#818CF8] active:shadow-none active:translate-y-[4px]",
  warning:
    "bg-[#F97316] text-white border-[#C2410C] shadow-[0_4px_0_#C2410C] hover:bg-[#FB923C] active:shadow-none active:translate-y-[4px]",
  accent:
    "bg-[#A855F7] text-white border-[#7E22CE] shadow-[0_4px_0_#7E22CE] hover:bg-[#C084FC] active:shadow-none active:translate-y-[4px]",
  secondary:
    "bg-[#06B6D4] text-white border-[#0E7490] shadow-[0_4px_0_#0E7490] hover:bg-[#22D3EE] active:shadow-none active:translate-y-[4px]",
  danger:
    "bg-[#F43F5E] text-white border-[#E11D48] shadow-[0_4px_0_#E11D48] hover:bg-[#FB7185] active:shadow-none active:translate-y-[4px]",
  outline:
    "bg-white text-[#6366F1] border-2 border-[#E2E8F0] shadow-[0_4px_0_#E2E8F0] hover:bg-[#F8FAFC] active:shadow-none active:translate-y-[4px]",
  ghost:
    "bg-transparent text-[#64748B] border-transparent shadow-none hover:bg-[#F8FAFC] hover:text-[#1E293B]",
};

const SIZE_CLASSES: Record<TactileSize, string> = {
  sm: "h-10 px-4 text-xs tracking-wider rounded-xl",
  md: "h-12 px-5 text-sm tracking-wide rounded-2xl",
  lg: "h-14 px-6 text-sm sm:text-base tracking-wide rounded-2xl",
};

interface TactileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TactileVariant;
  size?: TactileSize;
  uppercase?: boolean;
  children: ReactNode;
}

/** Tactile 3D push-button of the Daily English studio. */
export function TactileButton({
  variant = "primary",
  size = "md",
  uppercase = true,
  className,
  disabled,
  children,
  ...rest
}: TactileButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center gap-2 font-extrabold transition-[transform,box-shadow,background-color] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2",
        uppercase && "uppercase",
        SIZE_CLASSES[size],
        disabled
          ? "cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8] border-[#E2E8F0] shadow-none translate-y-0"
          : VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

interface GlossyProgressBarProps {
  value: number; // 0 to 100
  combo?: number;
  className?: string;
}

/** Rounded glossy lesson progress bar with spring fill and combo glow. */
export function GlossyProgressBar({ value, combo = 0, className }: GlossyProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const hotCombo = combo >= 3;
  return (
    <div
      className={cn("relative h-4 w-full overflow-hidden rounded-full bg-[#E2E8F0]", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cn(
          "relative h-full rounded-full",
          hotCombo ? "bg-gradient-to-r from-[#059669] via-[#34D399] to-[#FBBF24]" : "bg-[#059669]",
        )}
        initial={false}
        animate={{ width: `${Math.max(clamped > 0 ? 7 : 0, clamped)}%` }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        <div className="mx-2 mt-1 h-1.5 rounded-full bg-white/35" />
      </motion.div>
    </div>
  );
}

const CONFETTI_PIECES = [
  { x: -120, y: -90, color: "#059669", rotate: -45, delay: 0 },
  { x: -85, y: -120, color: "#FBBF24", rotate: 30, delay: 0.04 },
  { x: -45, y: -105, color: "#6366F1", rotate: -60, delay: 0.08 },
  { x: 0, y: -130, color: "#F97316", rotate: 50, delay: 0.02 },
  { x: 48, y: -110, color: "#A855F7", rotate: -35, delay: 0.06 },
  { x: 90, y: -115, color: "#059669", rotate: 70, delay: 0.03 },
  { x: 125, y: -85, color: "#F43F5E", rotate: -55, delay: 0.09 },
  { x: -100, y: -40, color: "#06B6D4", rotate: 40, delay: 0.05 },
  { x: 105, y: -45, color: "#FBBF24", rotate: -40, delay: 0.07 },
  { x: -30, y: -70, color: "#6366F1", rotate: 25, delay: 0.1 },
  { x: 35, y: -75, color: "#F97316", rotate: -25, delay: 0.11 },
] as const;

export function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2">
        {CONFETTI_PIECES.map((piece, idx) => (
          <motion.span
            key={idx}
            className="absolute block h-3 w-3 rounded-sm"
            style={{ backgroundColor: piece.color }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: piece.x,
              y: [0, piece.y, piece.y + 80],
              scale: [0, 1.2, 0.8],
              opacity: [1, 1, 0],
              rotate: piece.rotate * 3,
            }}
            transition={{ duration: 1.15, delay: piece.delay, ease: "easeOut" }}
          />
        ))}
      </div>
    </div>
  );
}
