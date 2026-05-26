// public/workers/image-worker.js
// Runs on a background thread to prevent UI thread blocking during image scaling and WebP conversion.

self.onmessage = async (event) => {
  const { file, quality = 0.80, maxDim = 1200 } = event.data;

  try {
    // 1. Convert File/Blob into ImageBitmap (asynchronous, non-blocking decoding)
    const img = await createImageBitmap(file);

    // 2. Calculate downscaled dimensions
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

    // 3. Create OffscreenCanvas and draw pixels (strips EXIF metadata headers)
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to initialize OffscreenCanvas 2D context.");
    }

    ctx.drawImage(img, 0, 0, width, height);

    // 4. Compress to WebP binary Blob
    const compressedBlob = await canvas.convertToBlob({
      type: "image/webp",
      quality: quality,
    });

    // 5. Send back to main thread
    self.postMessage({ success: true, blob: compressedBlob });
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};
