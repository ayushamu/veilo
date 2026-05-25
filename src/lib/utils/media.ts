/**
 * Client-side utility for optimizing images before secure upload.
 * Natively strips all EXIF location, device, and timestamp metadata via Canvas drawing,
 * and compresses the binary asset into WebP format to save user bandwidth.
 */
export async function optimizeAndStripImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // 1. If not an image, reject
    if (!file.type.startsWith("image/")) {
      reject(new Error("Selected file must be an image."));
      return;
    }

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

        // 2. Downscale if image exceeds full mobile HD dimensions (max 1200px)
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

        // 3. Draw image onto offscreen canvas
        // This drops all metadata headers (GPS tags, timestamp, device identifier) by mapping raw pixels only
        ctx.drawImage(img, 0, 0, width, height);

        // 4. Compress to WebP binary blob (quality: 80%)
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
