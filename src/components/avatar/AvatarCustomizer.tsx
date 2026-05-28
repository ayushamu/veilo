"use client";

import React, { useState } from "react";
import { VeiloAvatar, AvatarConfig } from "./VeiloAvatar";

// Static Trait Choice Pools matching `@dicebear/lorelei` enums
export const HAIR_OPTIONS = [
  { value: "variant01", label: "Classic Crop" },
  { value: "variant02", label: "Messy Curtains" },
  { value: "variant03", label: "Textured Fringe" },
  { value: "variant04", label: "Sleek Parting" },
  { value: "variant05", label: "Short Crop" },
  { value: "variant06", label: "Dreadlocks" },
  { value: "variant07", label: "Curly Bob" },
  { value: "variant08", label: "Chic Cut" },
  { value: "variant09", label: "High Bun" },
  { value: "variant10", label: "Loose Waves" },
  { value: "variant11", label: "Flowing Waves" },
  { value: "variant12", label: "Shaved Undercut" },
  { value: "variant13", label: "Messy Bunch" },
  { value: "variant14", label: "Textured Crop" },
  { value: "variant15", label: "Sleek Sidepart" },
  { value: "variant16", label: "Curly Bob II" },
];

export const HAIR_COLORS = [
  { value: "2c1b18", label: "Deep Charcoal", hex: "#2c1b18" },
  { value: "4a3728", label: "Classic Wood", hex: "#4a3728" },
  { value: "b58143", label: "Sandy Gold", hex: "#b58143" },
  { value: "d7603c", label: "Auburn Glow", hex: "#d7603c" },
  { value: "c83030", label: "Cyber Crimson", hex: "#c83030" },
  { value: "e5668b", label: "Sakura Pink", hex: "#e5668b" },
  { value: "00f0a0", label: "Veilo Teal", hex: "#00f0a0" },
  { value: "8a2be2", label: "Hyper Violet", hex: "#8a2be2" },
  { value: "00bfff", label: "Sky Cyan", hex: "#00bfff" },
];

export const EYES_OPTIONS = [
  { value: "variant01", label: "Calm Standard" },
  { value: "variant02", label: "Happy Curve" },
  { value: "variant03", label: "Playful Wink" },
  { value: "variant04", label: "Dreaming Closed" },
  { value: "variant05", label: "Skeptical Roll" },
  { value: "variant06", label: "Cheerful Spark" },
  { value: "variant07", label: "Determined Focus" },
  { value: "variant08", label: "Soft Blink" },
  { value: "variant09", label: "Starry-eyed" },
];

export const EYEBROWS_OPTIONS = [
  { value: "variant01", label: "Natural Thin" },
  { value: "variant02", label: "Natural Thick" },
  { value: "variant03", label: "Curved Soft" },
  { value: "variant04", label: "Arched Sharp" },
  { value: "variant05", label: "Focused Thick" },
  { value: "variant06", label: "Concerned Soft" },
];

export const MOUTH_OPTIONS = [
  { value: "happy01", label: "Subtle Smile" },
  { value: "happy02", label: "Joyous Open" },
  { value: "happy03", label: "Stoic Neutral" },
  { value: "happy04", label: "Playful Smile" },
  { value: "happy05", label: "Big Laugh" },
  { value: "happy09", label: "Cheeky Tongue" },
  { value: "sad01", label: "Sad Frown" },
  { value: "sad02", label: "Astonished Open" },
  { value: "sad03", label: "Melancholic Curve" },
];

export const NOSE_OPTIONS = [
  { value: "variant01", label: "Standard Cute" },
  { value: "variant02", label: "Button Nose" },
  { value: "variant03", label: "Straight Sharp" },
  { value: "variant04", label: "Soft Curved" },
  { value: "variant05", label: "Wide Cute" },
];

export const GLASSES_OPTIONS = [
  { value: "none", label: "No Glasses" },
  { value: "variant01", label: "Classic Round" },
  { value: "variant02", label: "Retro Square" },
  { value: "variant03", label: "Slim Metal" },
  { value: "variant04", label: "Thick Frame" },
];

export const EARRINGS_OPTIONS = [
  { value: "none", label: "No Earrings" },
  { value: "variant01", label: "Simple Stud" },
  { value: "variant02", label: "Silver Loop" },
  { value: "variant03", label: "Cyber Hang" },
];

// Legacy backward-compatibility aliases
export const CLOTHING_OPTIONS = [{ value: "hoodie", label: "Street Hoodie" }];
export const CLOTHING_COLORS = [{ value: "12121a", label: "Obsidian", hex: "#12121a" }];
export const ACCESSORIES_OPTIONS = [{ value: "", label: "None" }];

interface AvatarCustomizerProps {
  seed: string; // Deterministic default fallback seed
  initialConfig?: AvatarConfig | string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newConfig: AvatarConfig) => Promise<void> | void;
  isSaving?: boolean;
}

type TabType = "hair" | "eyes" | "mouth" | "accessories";

export function AvatarCustomizer({
  seed,
  initialConfig,
  isOpen,
  onClose,
  onSave,
  isSaving = false,
}: AvatarCustomizerProps) {
  // Parse initial config
  const parsedInitial = React.useMemo((): AvatarConfig => {
    if (!initialConfig) return {};
    if (typeof initialConfig === "string") {
      try {
        return JSON.parse(initialConfig);
      } catch {
        return {};
      }
    }
    return initialConfig;
  }, [initialConfig]);

  // Editor states
  const [config, setConfig] = useState<AvatarConfig>({
    hair: parsedInitial.hair || HAIR_OPTIONS[0].value,
    hairColor: parsedInitial.hairColor || HAIR_COLORS[0].value,
    eyes: parsedInitial.eyes || EYES_OPTIONS[0].value,
    eyebrows: parsedInitial.eyebrows || EYEBROWS_OPTIONS[0].value,
    mouth: parsedInitial.mouth || MOUTH_OPTIONS[0].value,
    nose: parsedInitial.nose || NOSE_OPTIONS[0].value,
    glasses: parsedInitial.glasses || "none",
    earrings: parsedInitial.earrings || "none",
  });

  const [activeTab, setActiveTab] = useState<TabType>("hair");

  // Sync state if initial config changes
  React.useEffect(() => {
    setConfig({
      hair: parsedInitial.hair || HAIR_OPTIONS[0].value,
      hairColor: parsedInitial.hairColor || HAIR_COLORS[0].value,
      eyes: parsedInitial.eyes || EYES_OPTIONS[0].value,
      eyebrows: parsedInitial.eyebrows || EYEBROWS_OPTIONS[0].value,
      mouth: parsedInitial.mouth || MOUTH_OPTIONS[0].value,
      nose: parsedInitial.nose || NOSE_OPTIONS[0].value,
      glasses: parsedInitial.glasses || "none",
      earrings: parsedInitial.earrings || "none",
    });
  }, [parsedInitial]);

  if (!isOpen) return null;

  const updateTrait = (key: keyof AvatarConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleShuffle = () => {
    const randomHair = HAIR_OPTIONS[Math.floor(Math.random() * HAIR_OPTIONS.length)].value;
    const randomHairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].value;
    const randomEyes = EYES_OPTIONS[Math.floor(Math.random() * EYES_OPTIONS.length)].value;
    const randomEyebrows = EYEBROWS_OPTIONS[Math.floor(Math.random() * EYEBROWS_OPTIONS.length)].value;
    const randomMouth = MOUTH_OPTIONS[Math.floor(Math.random() * MOUTH_OPTIONS.length)].value;
    const randomNose = NOSE_OPTIONS[Math.floor(Math.random() * NOSE_OPTIONS.length)].value;
    const randomGlasses = GLASSES_OPTIONS[Math.floor(Math.random() * GLASSES_OPTIONS.length)].value;
    const randomEarrings = EARRINGS_OPTIONS[Math.floor(Math.random() * EARRINGS_OPTIONS.length)].value;

    setConfig({
      hair: randomHair,
      hairColor: randomHairColor,
      eyes: randomEyes,
      eyebrows: randomEyebrows,
      mouth: randomMouth,
      nose: randomNose,
      glasses: randomGlasses,
      earrings: randomEarrings,
    });
  };

  const handleReset = () => {
    // Clear custom settings to let seed handle everything deterministically
    setConfig({
      hair: "variant01",
      hairColor: "2c1b18",
      eyes: "variant01",
      eyebrows: "variant01",
      mouth: "happy01",
      nose: "variant01",
      glasses: "none",
      earrings: "none",
    });
  };

  const handleSaveClick = () => {
    onSave(config);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      {/* Tap outside backdrop */}
      <div className="absolute inset-0 -z-10 cursor-pointer" onClick={onClose} />

      {/* Editor Main Drawer */}
      <div className="w-full max-h-[88vh] bg-[#0A0A0F] border-t border-zinc-900 rounded-t-3xl flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Drag handle line decoration */}
        <div className="flex justify-center py-3 shrink-0">
          <div className="w-12 h-1 rounded-full bg-zinc-800" />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 pb-2 border-b border-zinc-900/60 shrink-0">
          <h3 className="text-lg font-bold font-heading text-white">
            Design Your Avatar
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-900/80 active:scale-95 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Dynamic Preview Section */}
        <div className="flex flex-col items-center py-4 bg-[#08080C]/40 border-b border-zinc-900/40 relative shrink-0">
          <div className="absolute top-4 right-6 flex gap-2">
            {/* Reset Defaults button */}
            <button
              onClick={handleReset}
              className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 hover:text-white px-2.5 py-1.5 rounded bg-zinc-900/30 border border-zinc-800/40"
            >
              Reset Default
            </button>
          </div>

          <div className="relative">
            {/* Background Decorative Glow Ring */}
            <div className="absolute inset-0 bg-[#00F0A0]/5 blur-3xl rounded-full scale-125" />
            <VeiloAvatar
              seed={seed}
              config={config}
              size="xl"
              className="border-2 border-zinc-800 shadow-[0_0_30px_rgba(0,240,160,0.1)]"
            />
          </div>

          {/* Quick controls */}
          <button
            onClick={handleShuffle}
            className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#00F0A0] bg-[#00F0A0]/10 hover:bg-[#00F0A0]/15 px-3.5 py-1.5 rounded-full border border-[#00F0A0]/20 active:scale-95 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Shuffle Trait Combinations
          </button>
        </div>

        {/* Navigation Categories Tabs */}
        <div className="flex border-b border-zinc-900 bg-[#0A0A0F] overflow-x-auto scrollbar-none px-4 shrink-0">
          {([
            { id: "hair", label: "Hair" },
            { id: "eyes", label: "Eyes" },
            { id: "mouth", label: "Face" },
            { id: "accessories", label: "Extras" },
          ] as { id: TabType; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 text-center py-3.5 text-xs font-bold uppercase tracking-wider font-sans border-b-2 transition-all cursor-pointer whitespace-nowrap px-4 ${
                activeTab === tab.id
                  ? "border-[#00F0A0] text-[#00F0A0]"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Trait Selection Scroll Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#08080C] min-h-[220px]">
          {/* HAIR CONFIGURATION */}
          {activeTab === "hair" && (
            <div className="space-y-5">
              {/* Hairstyle Selection Grid */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
                  Choose Hair Style
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {HAIR_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => updateTrait("hair", item.value)}
                      className={`py-3 px-4 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer active:scale-[0.98] ${
                        config.hair === item.value
                          ? "border-[#00F0A0] bg-[#00F0A0]/5 text-white"
                          : "border-zinc-900/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hair Color Selection Flex */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
                  Choose Hair Color
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {HAIR_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => updateTrait("hairColor", color.value)}
                      title={color.label}
                      style={{ backgroundColor: color.hex }}
                      className={`w-10 h-10 rounded-full border-2 transition-all cursor-pointer active:scale-90 relative ${
                        config.hairColor === color.value
                          ? "border-[#00F0A0] scale-110 shadow-[0_0_12px_rgba(0,240,160,0.4)]"
                          : "border-zinc-950 hover:border-zinc-800"
                      }`}
                    >
                      {config.hairColor === color.value && (
                        <span className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-white shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* EYES & EXPRESSIONS */}
          {activeTab === "eyes" && (
            <div className="space-y-5">
              {/* Eyes Expression Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
                  Eye Expression
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {EYES_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => updateTrait("eyes", item.value)}
                      className={`py-3.5 px-2 rounded-xl text-center text-xs font-semibold border transition-all cursor-pointer active:scale-[0.98] ${
                        config.eyes === item.value
                          ? "border-[#00F0A0] bg-[#00F0A0]/5 text-white"
                          : "border-zinc-900/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eyebrows expression selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
                  Eyebrows Style
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {EYEBROWS_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => updateTrait("eyebrows", item.value)}
                      className={`py-3 px-4 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer active:scale-[0.98] ${
                        config.eyebrows === item.value
                          ? "border-[#00F0A0] bg-[#00F0A0]/5 text-white"
                          : "border-zinc-900/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MOUTH & NOSE */}
          {activeTab === "mouth" && (
            <div className="space-y-5">
              {/* Mouth expression selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
                  Mouth Expression
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {MOUTH_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => updateTrait("mouth", item.value)}
                      className={`py-3.5 px-2 rounded-xl text-center text-xs font-semibold border transition-all cursor-pointer active:scale-[0.98] ${
                        config.mouth === item.value
                          ? "border-[#00F0A0] bg-[#00F0A0]/5 text-white"
                          : "border-zinc-900/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nose Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
                  Nose Shape
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {NOSE_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => updateTrait("nose", item.value)}
                      className={`py-3 px-4 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer active:scale-[0.98] ${
                        config.nose === item.value
                          ? "border-[#00F0A0] bg-[#00F0A0]/5 text-white"
                          : "border-zinc-900/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* GLASSES & EARRINGS */}
          {activeTab === "accessories" && (
            <div className="space-y-5">
              {/* Glasses selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
                  Glasses Style
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {GLASSES_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => updateTrait("glasses", item.value)}
                      className={`py-3.5 px-4 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer active:scale-[0.98] ${
                        config.glasses === item.value
                          ? "border-[#00F0A0] bg-[#00F0A0]/5 text-white"
                          : "border-zinc-900/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Earrings Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
                  Earrings Style
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {EARRINGS_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => updateTrait("earrings", item.value)}
                      className={`py-3.5 px-4 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer active:scale-[0.98] ${
                        config.earrings === item.value
                          ? "border-[#00F0A0] bg-[#00F0A0]/5 text-white"
                          : "border-zinc-900/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-[#0A0A0F] border-t border-zinc-900/60 w-full shrink-0">
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className="w-full bg-[#00F0A0] hover:bg-[#00D090] text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed select-none shadow-[0_4px_16px_rgba(0,240,160,0.15)] font-sans"
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-black"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving Customizations...
              </>
            ) : (
              <>
                Confirm Visual Persona
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
