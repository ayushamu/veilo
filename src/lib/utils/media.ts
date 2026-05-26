/**
 * Client-side utility for optimizing images before secure upload.
 * Natively strips all EXIF location, device, and timestamp metadata,
 * and compresses the binary asset into WebP format in a background worker.
 */
export async function optimizeAndStripImage(file: File): Promise<Blob> {
  // 1. Verify file type
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file must be an image.");
  }

  // 2. Offload to Web Worker if OffscreenCanvas is supported (standard in Modern/Android Chrome)
  if (typeof window !== "undefined" && typeof window.OffscreenCanvas !== "undefined" && typeof Worker !== "undefined") {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker("/workers/image-worker.js");

        worker.onmessage = (event) => {
          const { success, blob, error } = event.data;
          worker.terminate();
          if (success && blob) {
            resolve(blob);
          } else {
            reject(new Error(error || "Worker failed to compress image."));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(err);
        };

        worker.postMessage({ file, quality: 0.80, maxDim: 1200 });
      } catch (err) {
        console.warn("Worker initialization failed, falling back to main thread:", err);
        resolve(optimizeAndStripImageMainThread(file));
      }
    });
  }

  // 3. Fallback to main thread canvas drawing for older runtimes
  return optimizeAndStripImageMainThread(file);
}

function optimizeAndStripImageMainThread(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Offscreen canvas rendering context failed to initialize."));
          return;
        }

        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas failed to compress binary to WebP format."));
            }
          },
          "image/webp",
          0.80
        );
      };
      img.onerror = () => reject(new Error("Failed to compile image binary payload."));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read raw image file."));
    reader.readAsDataURL(file);
  });
}
