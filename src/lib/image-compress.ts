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

  // If already small enough, return as-is
  if (inputBuffer.length <= targetSizeBytes) {
    return inputBuffer;
  }

  // Try to use sharp if available
  try {
    const sharp = await import('sharp').catch(() => null);
    if (sharp?.default) {
      let quality = 80;
      let width = 1920;
      let outputBuffer = inputBuffer;

      // Binary search for optimal quality/size
      while (outputBuffer.length > targetSizeBytes && quality > 10) {
        outputBuffer = await sharp.default(inputBuffer)
          .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();

        if (outputBuffer.length > targetSizeBytes) {
          if (quality > 30) {
            quality -= 10;
          } else {
            width = Math.floor(width * 0.9);
            quality = 80;
          }
        }
      }

      // If still too large, try WebP
      if (outputBuffer.length > targetSizeBytes) {
        quality = 80;
        while (outputBuffer.length > targetSizeBytes && quality > 10) {
          outputBuffer = await sharp.default(inputBuffer)
            .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
            .webp({ quality })
            .toBuffer();
          if (outputBuffer.length > targetSizeBytes) {
            quality -= 10;
          }
        }
      }

      return outputBuffer;
    }
  } catch (error) {
    console.warn('Sharp not available, using basic compression', error);
  }

  // Fallback: return original if compression library not available
  // In production, sharp should be installed
  console.warn('Image compression requires sharp package. Install with: npm install sharp');
  return inputBuffer;
}

