"use client";
import React, { useState } from "react";
import { Shield } from "lucide-react";

interface ClubCrestProps {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  xs: { dim: "h-4 w-4", text: "text-[9px]", icon: 10 },
  sm: { dim: "h-6 w-6", text: "text-[10px]", icon: 14 },
  md: { dim: "h-8 w-8", text: "text-xs", icon: 18 },
  lg: { dim: "h-12 w-12", text: "text-sm", icon: 24 },
  xl: { dim: "h-16 w-16", text: "text-base", icon: 32 },
};

export default function ClubCrest({ src, name, size = "md", className = "" }: ClubCrestProps) {
  const [hasError, setHasError] = useState(false);
  const cfg = SIZE_MAP[size];

  // Generate 2-3 letter initials from name
  const initials = name
    ? name
        .replace(/^(AFC|FC)\s+/i, "")
        .replace(/\s+(AFC|FC|CF)$/i, "")
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "FC";

  if (!src || hasError) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-panel2 to-line/80 font-bold font-mono text-muted border border-line/60 shadow-xs ${cfg.dim} ${cfg.text} ${className}`}
        title={name}
      >
        {initials || <Shield size={cfg.icon} className="opacity-60" />}
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 flex items-center justify-center p-0.5 rounded-full bg-panel2/60 border border-line/40 shadow-xs ${cfg.dim} ${className}`}>
      <img
        src={src}
        alt={`${name} crest`}
        loading="lazy"
        onError={() => setHasError(true)}
        className="h-full w-full object-contain p-0.5 drop-shadow-xs transition-transform hover:scale-110"
      />
    </div>
  );
}
