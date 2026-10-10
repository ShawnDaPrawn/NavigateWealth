/**
 * Centre-crop an image file to a square and downscale it to a JPEG.
 *
 * Phone photos are several MB and arbitrary aspect ratios; an avatar needs
 * neither. Doing this in the browser keeps uploads small and fast and means
 * the server only ever stores a ~20–40KB square.
 */
export const AVATAR_OUTPUT_SIZE = 384;
const AVATAR_JPEG_QUALITY = 0.88;

export async function resizeAvatarImage(file: File, size = AVATAR_OUTPUT_SIZE): Promise<Blob> {
  // `imageOrientation: 'from-image'` applies EXIF rotation, so portrait phone
  // shots are not stored sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not supported in this browser');

    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process image'))),
        'image/jpeg',
        AVATAR_JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}
