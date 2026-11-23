"use client";

import { motion } from "framer-motion";
import type { MascotAccessoryId } from "@/modules/daily-english/studio-content";

export type MascotMood = "idle" | "happy" | "celebrating" | "thinking" | "oops" | "listening" | "hero";

interface VoltMascotProps {
  mood?: MascotMood;
  size?: number;
  accessory?: MascotAccessoryId | null;
  className?: string;
}

/**
 * Original Engineer Learning OS mascot ("Bit" — a friendly emerald circuit-bot).
 * Supports equippable studio accessories unlocked in the local gems shop.
 */
export function VoltMascot({
  mood = "idle",
  size = 96,
  accessory = null,
  className = "",
}: VoltMascotProps) {
  const isHappy = mood === "happy" || mood === "celebrating" || mood === "hero";
  const isOops = mood === "oops";
  const isListening = mood === "listening";
  const isCelebrating = mood === "celebrating";

  const bodyAnimation = isCelebrating
    ? { y: [0, -12, 0, -8, 0], rotate: [0, -6, 6, -4, 0] }
    : isOops
      ? { x: [0, -5, 5, -4, 4, 0], rotate: [0, -3, 3, 0] }
      : mood === "happy"
        ? { y: [0, -6, 0], scale: [1, 1.05, 1] }
        : { y: [0, -4, 0] };

  const bodyTransition = isCelebrating
    ? { duration: 0.9, repeat: Infinity, repeatDelay: 0.5 }
    : isOops
      ? { duration: 0.45 }
      : mood === "happy"
        ? { duration: 0.55 }
        : { duration: 2.8, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <motion.div
      className={`relative inline-flex select-none items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      animate={bodyAnimation}
      transition={bodyTransition}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft ground shadow */}
        <ellipse cx="60" cy="110" rx="32" ry="6" fill="#000000" fillOpacity="0.09" />

        {/* Celebratory sparkles */}
        {isCelebrating && (
          <g>
            <path d="M16 26L19 19L22 26L29 29L22 32L19 39L16 32L9 29L16 26Z" fill="#FBBF24" />
            <path d="M100 20L102.5 14L105 20L111 22.5L105 25L102.5 31L100 25L94 22.5L100 20Z" fill="#6366F1" />
            <circle cx="106" cy="52" r="4" fill="#F97316" />
            <circle cx="14" cy="58" r="3.5" fill="#A855F7" />
          </g>
        )}

        {/* Antenna / spark crest (replaced by golden crown if equipped) */}
        {accessory === "crown" ? (
          <g>
            <path
              d="M36 27L42 10L53 19L60 7L67 19L78 10L84 27Z"
              fill="#FBBF24"
              stroke="#B45309"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <circle cx="60" cy="18" r="2.6" fill="#6366F1" />
          </g>
        ) : (
          <>
            <line x1="60" y1="26" x2="60" y2="12" stroke="#047857" strokeWidth="5" strokeLinecap="round" />
            <circle cx="60" cy="11" r="6.5" fill={isOops ? "#F43F5E" : "#FBBF24"} stroke="#047857" strokeWidth="2.5" />
          </>
        )}

        {/* Studio Headphones band */}
        {accessory === "headphones" && (
          <path
            d="M21 56C21 28 38 16 60 16C82 16 99 28 99 56"
            stroke="#4338CA"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Listening sound arcs */}
        {isListening && (
          <g stroke="#6366F1" strokeWidth="3.5" strokeLinecap="round">
            <path d="M14 54C10 60 10 68 14 74" />
            <path d="M7 48C1 58 1 70 7 80" opacity="0.6" />
            <path d="M106 54C110 60 110 68 106 74" />
            <path d="M113 48C119 58 119 70 113 80" opacity="0.6" />
          </g>
        )}

        {/* Ears / side sensors (or studio earcups) */}
        <rect
          x={accessory === "headphones" ? 14 : 17}
          y={accessory === "headphones" ? 48 : 52}
          width={accessory === "headphones" ? 15 : 12}
          height={accessory === "headphones" ? 28 : 22}
          rx="7"
          fill={accessory === "headphones" ? "#6366F1" : isListening ? "#6366F1" : "#047857"}
        />
        <rect
          x={accessory === "headphones" ? 91 : 91}
          y={accessory === "headphones" ? 48 : 52}
          width={accessory === "headphones" ? 15 : 12}
          height={accessory === "headphones" ? 28 : 22}
          rx="7"
          fill={accessory === "headphones" ? "#6366F1" : isListening ? "#6366F1" : "#047857"}
        />

        {/* Main rounded body with 3D underside */}
        <rect x="24" y="28" width="72" height="74" rx="28" fill="#047857" />
        <rect x="24" y="24" width="72" height="71" rx="28" fill="#059669" />

        {/* Glossy forehead highlight */}
        <path d="M40 33C48 29 72 29 80 33" stroke="#34D399" strokeWidth="5" strokeLinecap="round" />

        {/* Face visor screen */}
        <rect x="33" y="42" width="54" height="36" rx="16" fill="#FFFFFF" />

        {/* Eyes */}
        {isHappy ? (
          <g stroke="#0F172A" strokeWidth="4.2" strokeLinecap="round" fill="none">
            <path d="M43 59C45 53 52 53 54 59" />
            <path d="M66 59C68 53 75 53 77 59" />
          </g>
        ) : isOops ? (
          <g>
            <circle cx="48" cy="58" r="5" fill="#0F172A" />
            <circle cx="72" cy="58" r="5" fill="#0F172A" />
            <circle cx="49.5" cy="56.5" r="1.8" fill="#FFFFFF" />
            <circle cx="73.5" cy="56.5" r="1.8" fill="#FFFFFF" />
            <path d="M42 49L53 52" stroke="#E11D48" strokeWidth="3" strokeLinecap="round" />
            <path d="M78 49L67 52" stroke="#E11D48" strokeWidth="3" strokeLinecap="round" />
          </g>
        ) : mood === "thinking" ? (
          <g>
            <circle cx="49" cy="57" r="5.2" fill="#0F172A" />
            <circle cx="73" cy="57" r="5.2" fill="#0F172A" />
            <circle cx="51" cy="55" r="2" fill="#FFFFFF" />
            <circle cx="75" cy="55" r="2" fill="#FFFFFF" />
            <path d="M66 49L78 48" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <circle cx="48" cy="57" r="5.5" fill="#0F172A" />
            <circle cx="72" cy="57" r="5.5" fill="#0F172A" />
            <circle cx="50" cy="55" r="2.2" fill="#FFFFFF" />
            <circle cx="74" cy="55" r="2.2" fill="#FFFFFF" />
          </g>
        )}

        {/* Rosy cheeks */}
        <ellipse cx="40" cy="66" rx="4.5" ry="2.6" fill={isOops ? "#FDA4AF" : "#F97316"} fillOpacity="0.45" />
        <ellipse cx="80" cy="66" rx="4.5" ry="2.6" fill={isOops ? "#FDA4AF" : "#F97316"} fillOpacity="0.45" />

        {/* Mouth */}
        {isHappy ? (
          <path d="M52 67C55 73 65 73 68 67" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        ) : isOops ? (
          <path d="M54 71C57 67 63 67 66 71" stroke="#E11D48" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        ) : mood === "thinking" ? (
          <line x1="55" y1="69" x2="65" y2="68" stroke="#0F172A" strokeWidth="3.2" strokeLinecap="round" />
        ) : (
          <path d="M54 67C57 71 63 71 66 67" stroke="#0F172A" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        )}

        {/* Cyber Visor glasses */}
        {accessory === "visor" && (
          <g>
            <rect
              x="35"
              y="49"
              width="50"
              height="16"
              rx="8"
              fill="#6366F1"
              fillOpacity="0.82"
              stroke="#312E81"
              strokeWidth="2.5"
            />
            <line x1="42" y1="54" x2="56" y2="54" stroke="#A5F3FC" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="65" y1="54" x2="77" y2="54" stroke="#A5F3FC" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}

        {/* Engineer Scarf */}
        {accessory === "scarf" ? (
          <g>
            <rect x="26" y="80" width="68" height="12" rx="6" fill="#6366F1" stroke="#4338CA" strokeWidth="2" />
            <rect x="66" y="87" width="14" height="17" rx="5" fill="#4338CA" />
            <line x1="34" y1="86" x2="86" y2="86" stroke="#A5B4FC" strokeWidth="2" strokeDasharray="6 4" />
          </g>
        ) : (
          /* Chest circuit badge */
          <>
            <rect x="49" y="83" width="22" height="8" rx="4" fill="#D1FAE5" />
            <circle cx="55" cy="87" r="2" fill="#047857" />
            <circle cx="65" cy="87" r="2" fill="#6366F1" />
          </>
        )}

        {/* Little feet */}
        <rect x="38" y="96" width="14" height="10" rx="5" fill="#F97316" />
        <rect x="68" y="96" width="14" height="10" rx="5" fill="#F97316" />
      </svg>
    </motion.div>
  );
}
