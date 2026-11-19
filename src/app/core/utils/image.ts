export async function resizeImageToSquare(file: File, size = 256, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  ctx.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))),
      'image/webp',
      quality,
    );
  });
}