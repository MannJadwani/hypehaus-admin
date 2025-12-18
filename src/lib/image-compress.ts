/**
 * Compress image to target size (30KB or less)
 * Uses sharp if available, otherwise falls back to basic compression
 */
export async function compressImage(
  buffer: Buffer | ArrayBuffer,
  targetSizeKB: number = 30
): Promise<Buffer> {
  const targetSizeBytes = targetSizeKB * 1024;
  const inputBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // Try to use sharp if available
  try {
    const sharp = await import('sharp').catch(() => null);
    if (sharp?.default) {
      let quality = 80;
      let width = 1920;
      let outputBuffer: Buffer | null = null;
      let currentWidth = width;

      // First pass: Convert to WebP
      // We start with a reasonable quality and size
      const process = async (q: number, w: number) => {
        return await sharp.default(inputBuffer)
          .resize(w, null, { withoutEnlargement: true, fit: 'inside' })
          .webp({ quality: q })
          .toBuffer();
      };

      outputBuffer = await process(quality, currentWidth);

      // Loop to reduce size if needed
      while (outputBuffer.length > targetSizeBytes && (quality > 10 || currentWidth > 500)) {
        if (quality > 30) {
          quality -= 10;
        } else {
          currentWidth = Math.floor(currentWidth * 0.8);
          quality = 80; // Reset quality when resizing down significantly
        }
        outputBuffer = await process(quality, currentWidth);
      }

      return outputBuffer;
    }
  } catch (error) {
    console.warn('Sharp not available or error during compression, using basic fallback', error);
  }

  // Fallback: return original if compression library not available
  // In production, sharp should be installed
  console.warn('Image compression requires sharp package. Install with: npm install sharp');
  return inputBuffer;
}

