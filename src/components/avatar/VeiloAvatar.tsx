"use client";

import React, { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import * as lorelei from "@dicebear/lorelei";

export interface AvatarConfig {
  hair?: string;
  hairColor?: string;
  clothing?: string;
  clothingColor?: string;
  eyes?: string;
  mouth?: string;
  accessories?: string;
  accessoriesColor?: string;
  eyebrows?: string;
  skinColor?: string;
  glasses?: string;
  earrings?: string;
  nose?: string;
}

interface VeiloAvatarProps {
  seed: string; // Nickname or user ID used for deterministic fallback
  config?: AvatarConfig | string | null; // Customized options
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number; // Sizing presets or custom pixel value
  isTyping?: boolean; // Typing state glow modifier
  isOnline?: boolean; // Online indicator badge
  className?: string; // Additional classes
  onClick?: () => void; // Click handler
}

// Map sizing presets to pixels
const SIZE_MAP = {
  xs: 28,  // Chat bubble compact
  sm: 36,  // Message items / Inbox list
  md: 48,  // Top headers / Peerview card
  lg: 64,  // Profile page preview
  xl: 96,  // Customizer main preview
};

export function VeiloAvatar({
  seed,
  config,
  size = "md",
  isTyping = false,
  isOnline = false,
  className = "",
  onClick,
}: VeiloAvatarProps) {
  // 1. Parse configuration safely
  const parsedConfig = useMemo((): AvatarConfig => {
    if (!config) return {};
    if (typeof config === "string") {
      try {
        return JSON.parse(config);
      } catch (e) {
        console.error("Failed to parse avatar config string:", e);
        return {};
      }
    }
    return config;
  }, [config]);

  // 2. Generate SVG inline using DiceBear
  const avatarSvg = useMemo(() => {
    // Map user configuration choices to DiceBear Lorelei options:
    const avatar = createAvatar(lorelei, {
      seed: seed || "veilo-default",
      ...(parsedConfig.hair ? { hair: [parsedConfig.hair] } : {}),
      ...(parsedConfig.hairColor ? { hairColor: [parsedConfig.hairColor] } : {}),
      ...(parsedConfig.eyes ? { eyes: [parsedConfig.eyes] } : {}),
      ...(parsedConfig.eyebrows ? { eyebrows: [parsedConfig.eyebrows] } : {}),
      ...(parsedConfig.mouth ? { mouth: [parsedConfig.mouth] } : {}),
      ...(parsedConfig.nose ? { nose: [parsedConfig.nose] } : {}),
      ...(parsedConfig.skinColor ? { skinColor: [parsedConfig.skinColor] } : {}),
      // Handle glasses and earrings probabilities properly
      ...(parsedConfig.glasses && parsedConfig.glasses !== "none" 
        ? { glasses: [parsedConfig.glasses], glassesProbability: 100 } 
        : { glasses: [], glassesProbability: 0 }),
      ...(parsedConfig.earrings && parsedConfig.earrings !== "none" 
        ? { earrings: [parsedConfig.earrings], earringsProbability: 100 } 
        : { earrings: [], earringsProbability: 0 }),
    } as any);

    return avatar.toString();
  }, [seed, parsedConfig]);

  // Determine actual width/height in pixels
  const pxSize = typeof size === "number" ? size : SIZE_MAP[size] || 48;

  return (
    <div
      onClick={onClick}
      style={{ width: pxSize, height: pxSize }}
      className={`relative rounded-full select-none shrink-0 flex items-center justify-center bg-[#12121A] border border-zinc-800/80 transition-all duration-300 ${
        onClick ? "cursor-pointer active:scale-95 hover:border-[#00F0A0]/40" : ""
      } ${
        isTyping
          ? "animate-pulse border-[#00F0A0] shadow-[0_0_12px_rgba(0,240,160,0.35)]"
          : ""
      } ${className}`}
    >
      {/* Inline SVG Renderer */}
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
        dangerouslySetInnerHTML={{ __html: avatarSvg }}
      />

      {/* Online Status Green Pill badge */}
      {isOnline && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00F0A0] border-2 border-[#08080C] rounded-full shadow-sm animate-bounce" />
      )}
    </div>
  );
}
