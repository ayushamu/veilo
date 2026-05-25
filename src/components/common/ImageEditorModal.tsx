"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface ImageEditorModalProps {
  file: File;
  onSave: (editedBlob: Blob) => void;
  onCancel: () => void;
}

type StrokePoint = { x: number; y: number };
type Stroke = {
  points: StrokePoint[];
  color: string;
  width: number;
};

export default function ImageEditorModal({ file, onSave, onCancel }: ImageEditorModalProps) {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [activeTool, setActiveTool] = useState<"crop" | "draw" | "redact">("draw");
  const [brushColor, setBrushColor] = useState<string>("#00F0A0"); // Neon Green default
  const [brushWidth, setBrushWidth] = useState<number>(6);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);

  // Crop coordinates (percentages 0-100 of the image container)
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [isDraggingCrop, setIsDraggingCrop] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStartBox, setCropStartBox] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load File into DataURL
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageSrc(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }, [file]);

  // Handle Canvas Drawing Loop
  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;

    const img = new window.Image();
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      drawCanvas();
    };
  }, [imageSrc, strokes, currentStroke, activeTool]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas internal dimensions to match the loaded image size
    canvas.width = img.width;
    canvas.height = img.height;

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base image
    ctx.drawImage(img, 0, 0);

    // Draw all completed strokes
    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke);
    });

    // Draw current stroke in progress
    if (currentStroke.length > 0) {
      drawStroke(ctx, {
        points: currentStroke,
        color: activeTool === "redact" ? "#000000" : brushColor,
        width: activeTool === "redact" ? 24 : brushWidth,
      });
    }
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  // Translate mouse/touch event screen coordinates to canvas pixels
  const getCanvasCoords = (clientX: number, clientY: number): StrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Drawing event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === "crop") return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (coords) {
      setIsDrawing(true);
      setCurrentStroke([coords]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (coords) {
      setCurrentStroke((prev) => [...prev, coords]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    canvasRef.current?.releasePointerCapture(e.pointerId);

    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes((prev) => [
        ...prev,
        {
          points: currentStroke,
          color: activeTool === "redact" ? "#000000" : brushColor,
          width: activeTool === "redact" ? 24 : brushWidth,
        },
      ]);
    }
    setCurrentStroke([]);
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
  };

  // Crop Drag Handlers
  const handleCropMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    setIsDraggingCrop(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setCropStartBox({ ...cropBox });
  };

  const handleCropMouseMove = (e: MouseEvent) => {
    if (!isDraggingCrop || !containerRef.current) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    const rect = containerRef.current.getBoundingClientRect();
    const percentDeltaX = (deltaX / rect.width) * 100;
    const percentDeltaY = (deltaY / rect.height) * 100;

    setCropBox((prev) => {
      let { x, y, w, h } = cropStartBox;

      if (isDraggingCrop === "move") {
        x = Math.max(0, Math.min(100 - w, x + percentDeltaX));
        y = Math.max(0, Math.min(100 - h, y + percentDeltaY));
      } else {
        if (isDraggingCrop.includes("n")) {
          const newY = Math.max(0, Math.min(y + h - 10, y + percentDeltaY));
          h = h + (y - newY);
          y = newY;
        }
        if (isDraggingCrop.includes("s")) {
          h = Math.max(10, Math.min(100 - y, h + percentDeltaY));
        }
        if (isDraggingCrop.includes("w")) {
          const newX = Math.max(0, Math.min(x + w - 10, x + percentDeltaX));
          w = w + (x - newX);
          x = newX;
        }
        if (isDraggingCrop.includes("e")) {
          w = Math.max(10, Math.min(100 - x, w + percentDeltaX));
        }
      }

      return { x, y, w, h };
    });
  };

  const handleCropMouseUp = () => {
    setIsDraggingCrop(null);
  };

  useEffect(() => {
    if (isDraggingCrop) {
      window.addEventListener("mousemove", handleCropMouseMove);
      window.addEventListener("mouseup", handleCropMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleCropMouseMove);
      window.removeEventListener("mouseup", handleCropMouseUp);
    };
  }, [isDraggingCrop, dragStart, cropStartBox]);

  // Apply crop and send final blob
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cropCanvas = document.createElement("canvas");
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;

    // Calculate crop box coordinates relative to original canvas pixel size
    const cropPixelX = (cropBox.x / 100) * canvas.width;
    const cropPixelY = (cropBox.y / 100) * canvas.height;
    const cropPixelW = (cropBox.w / 100) * canvas.width;
    const cropPixelH = (cropBox.h / 100) * canvas.height;

    cropCanvas.width = cropPixelW;
    cropCanvas.height = cropPixelH;

    // Draw cropped region from source canvas
    cropCtx.drawImage(
      canvas,
      cropPixelX,
      cropPixelY,
      cropPixelW,
      cropPixelH,
      0,
      0,
      cropPixelW,
      cropPixelH
    );

    // Output raw PNG/WebP blob
    cropCanvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
      }
    }, "image/png");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 animate-fadeIn font-sans text-white">
      {/* Top action bar */}
      <header className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 text-sm font-semibold transition-all active:scale-95 cursor-pointer"
          >
            Cancel
          </button>
          <span className="text-zinc-500">|</span>
          <span className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">
            Image Editor
          </span>
        </div>

        <div className="flex items-center gap-2">
          {strokes.length > 0 && (
            <>
              <button
                onClick={handleClear}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 border border-zinc-850"
              >
                Clear
              </button>
              <button
                onClick={handleUndo}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition-all cursor-pointer active:scale-95 border border-zinc-850"
                title="Undo stroke"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#00F0A0] text-black rounded-xl text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(0,240,160,0.25)] hover:shadow-[0_0_20px_rgba(0,240,160,0.4)] active:scale-95 transition-all cursor-pointer"
          >
            Apply & Send
          </button>
        </div>
      </header>

      {/* Main editor viewport */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 bg-[#08080C]">
        <div
          ref={containerRef}
          className="relative max-w-full max-h-[60vh] object-contain flex items-center justify-center shadow-lg"
          style={{ userSelect: "none" }}
        >
          {/* Main Drawing Canvas */}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`max-w-full max-h-[60vh] object-contain rounded-lg border border-zinc-800/50 ${
              activeTool === "crop" ? "cursor-default" : "cursor-crosshair"
            }`}
          />

          {/* Crop Boundary Box Overlay */}
          {activeTool === "crop" && (
            <div
              className="absolute border-2 border-dashed border-[#00F0A0] shadow-[0_0_20px_rgba(0,240,160,0.15)] bg-black/20"
              style={{
                left: `${cropBox.x}%`,
                top: `${cropBox.y}%`,
                width: `${cropBox.w}%`,
                height: `${cropBox.h}%`,
              }}
            >
              {/* Drag handles */}
              <div
                className="absolute inset-0 cursor-move"
                onMouseDown={(e) => handleCropMouseDown(e, "move")}
              />
              {/* Corners */}
              <div
                className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-[#00F0A0] border border-black rounded-full cursor-nwse-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "nw")}
              />
              <div
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-[#00F0A0] border border-black rounded-full cursor-nesw-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "ne")}
              />
              <div
                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-[#00F0A0] border border-black rounded-full cursor-nesw-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "sw")}
              />
              <div
                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-[#00F0A0] border border-black rounded-full cursor-nwse-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "se")}
              />
              {/* Edges */}
              <div
                className="absolute -top-1 inset-x-4 h-2 cursor-n-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "n")}
              />
              <div
                className="absolute -bottom-1 inset-x-4 h-2 cursor-s-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "s")}
              />
              <div
                className="absolute -left-1 inset-y-4 w-2 cursor-w-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "w")}
              />
              <div
                className="absolute -right-1 inset-y-4 w-2 cursor-e-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "e")}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Tool selection and brush color controls */}
      <footer className="p-6 border-t border-zinc-900 bg-zinc-950 flex flex-col gap-4 select-none">
        {/* Color Palette (only visible if drawing) */}
        {activeTool === "draw" && (
          <div className="flex items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {["#00F0A0", "#FF4B72", "#8B5CF6", "#FFB800", "#FFFFFF"].map((color) => (
              <button
                key={color}
                onClick={() => setBrushColor(color)}
                className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                  brushColor === color ? "border-white scale-110 shadow-md" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <span className="text-zinc-700 mx-1">|</span>
            {/* Brush sizes */}
            <div className="flex items-center gap-2">
              {[3, 6, 12].map((size) => (
                <button
                  key={size}
                  onClick={() => setBrushWidth(size)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    brushWidth === size
                      ? "bg-white text-black border-white"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                >
                  {size === 3 ? "S" : size === 6 ? "M" : "L"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toolkit mode selectors */}
        <div className="flex items-center justify-center gap-2 w-full max-w-sm mx-auto">
          <button
            onClick={() => setActiveTool("draw")}
            className="flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 bg-zinc-900 text-[#00F0A0] border border-zinc-850"
            style={activeTool !== "draw" ? { backgroundColor: "transparent", color: "#71717a", borderColor: "transparent" } : undefined}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Draw
          </button>

          <button
            onClick={() => setActiveTool("redact")}
            className="flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 bg-zinc-900 text-[#FF4B72] border border-zinc-850"
            style={activeTool !== "redact" ? { backgroundColor: "transparent", color: "#71717a", borderColor: "transparent" } : undefined}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            Censor
          </button>

          <button
            onClick={() => setActiveTool("crop")}
            className="flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 bg-zinc-900 text-[#00D2FF] border border-zinc-850"
            style={activeTool !== "crop" ? { backgroundColor: "transparent", color: "#71717a", borderColor: "transparent" } : undefined}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
              <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
            </svg>
            Crop
          </button>
        </div>
      </footer>
    </div>
  );
}
