"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface ImageViewerModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  imageUrl,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dismissOffset, setDismissOffset] = useState(0); // Vertical drag for swipe-to-dismiss when scale = 1
  const [isDismissDragging, setIsDismissDragging] = useState(false);
  const [dismissStart, setDismissStart] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset zoom states when closed or when image changes
  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setDismissOffset(0);
      setIsDragging(false);
      setIsDismissDragging(false);
    }
  }, [isOpen, imageUrl]);

  // Handle double click/tap to zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      // Zoom in towards cursor if possible
      setScale(2.5);
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Pointer interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Avoid dragging on buttons
    if ((e.target as HTMLElement).closest("button")) return;

    if (scale > 1) {
      // Pan mode
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    } else {
      // Swipe down to dismiss mode
      setIsDismissDragging(true);
      setDismissStart(e.clientY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging && scale > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Constrain panning bounds to keep image visible
      const maxPanX = (scale - 1) * 200;
      const maxPanY = (scale - 1) * 300;

      setPosition({
        x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
      });
    } else if (isDismissDragging && scale === 1) {
      const deltaY = e.clientY - dismissStart;
      // Only allow pulling downwards
      if (deltaY > 0) {
        setDismissOffset(deltaY);
      }
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);

    if (isDismissDragging) {
      setIsDismissDragging(false);
      // If pulled down sufficiently, dismiss the image
      if (dismissOffset > 105) {
        onClose();
      } else {
        // Bounce back
        setDismissOffset(0);
      }
    }
  };

  // Download functionality
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      
      // Derive a nice file name
      const parts = imageUrl.split("/");
      const fileName = parts[parts.length - 1] || "veilo-image.webp";
      link.download = fileName.endsWith(".webp") || fileName.endsWith(".jpg") || fileName.endsWith(".png")
        ? fileName 
        : `${fileName}.webp`;
        
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // Fallback: Open in new tab
      window.open(imageUrl, "_blank");
    }
  };

  if (!isOpen || !imageUrl) return null;

  // Background opacity fades as user drags down to dismiss
  const dragOpacity = Math.max(0.3, 1 - dismissOffset / 400);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ 
        backgroundColor: `rgba(0, 0, 0, ${dragOpacity * 0.92})`,
        touchAction: scale > 1 ? "none" : "pan-y"
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-2xl transition-all duration-300 ease-out select-none animate-in fade-in duration-200"
    >
      {/* Top action controls */}
      <div className="absolute top-6 right-6 z-[110] flex items-center gap-3.5">
        <button
          onClick={handleDownload}
          title="Download image"
          className="w-10 h-10 rounded-full bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/40 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-90 cursor-pointer shadow-md"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        <button
          onClick={onClose}
          title="Close viewer"
          className="w-10 h-10 rounded-full bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/40 flex items-center justify-center text-zinc-300 hover:text-[#FF4B72] transition-all active:scale-90 cursor-pointer shadow-md"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Image containment area */}
      <div 
        className="w-full h-full flex items-center justify-center p-4 relative"
        onClick={scale === 1 ? onClose : undefined}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Expanded Media View"
          onDoubleClick={handleDoubleClick}
          style={{
            transform: `translate3d(${position.x}px, ${position.y + dismissOffset}px, 0) scale(${scale})`,
            transition: isDragging || isDismissDragging ? "none" : "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            maxHeight: "85vh",
            maxWidth: "95vw",
          }}
          className="object-contain rounded-lg shadow-2xl origin-center cursor-zoom-in active:cursor-grabbing will-change-transform animate-in zoom-in-95 duration-200"
          draggable={false}
        />
      </div>

      {/* Bottom hint helper overlay */}
      {scale === 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans flex items-center gap-1.5 opacity-60 pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
          >
            <polyline points="7 13 12 18 17 13" />
            <polyline points="7 6 12 11 17 6" />
          </svg>
          Swipe down to close
        </div>
      )}
    </div>
  );
};
