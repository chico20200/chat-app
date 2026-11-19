/** Límite por archivo. Debe coincidir con file_size_limit del bucket chat-media y con firestore.rules. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Quita tildes, espacios y símbolos para usar el nombre dentro de una ruta de Storage. */
export function safeFileName(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_');
  return clean.slice(-80) || 'archivo';
}
