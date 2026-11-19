import { Injectable, inject } from '@angular/core';
import { safeFileName } from '../utils/files';
import { SupabaseService } from './supabase.service';

const BUCKET = 'chat-media';
const URL_TTL_SECONDS = 60 * 60;

/** Archivos del chat en Supabase Storage (bucket privado: se leen con URLs firmadas). */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly storage = inject(SupabaseService).client.storage;
  private readonly urlCache = new Map<string, { url: string; expiresAt: number }>();

  async upload(roomId: string, data: Blob, originalName: string, contentType: string): Promise<string> {
    const path = `${roomId}/${crypto.randomUUID()}-${safeFileName(originalName)}`;
    const { error } = await this.storage.from(BUCKET).upload(path, data, { contentType, upsert: false });
    if (error) throw new Error(this.uploadErrorMessage(error.message));
    return path;
  }

  /** URL temporal para mostrar una imagen. Se reutiliza mientras le quede al menos 5 minutos. */
  async viewUrl(path: string): Promise<string> {
    const cached = this.urlCache.get(path);
    if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) return cached.url;

    const { data, error } = await this.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECONDS);
    if (error) throw error;
    this.urlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + URL_TTL_SECONDS * 1000 });
    return data.signedUrl;
  }

  /** URL temporal (1 minuto) que obliga al navegador a descargar con el nombre original. */
  async downloadUrl(path: string, fileName: string): Promise<string> {
    const { data, error } = await this.storage.from(BUCKET).createSignedUrl(path, 60, { download: fileName });
    if (error) throw error;
    return data.signedUrl;
  }

  async remove(path: string): Promise<void> {
    this.urlCache.delete(path);
    const { error } = await this.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  }

  private uploadErrorMessage(raw: string): string {
    const text = raw.toLowerCase();
    if (text.includes('mime') || text.includes('type')) return 'Ese tipo de archivo no está permitido.';
    if (text.includes('size') || text.includes('large')) return 'El archivo supera el límite de 10 MB.';
    if (text.includes('security') || text.includes('policy')) return 'No tienes permiso para subir archivos a esta sala.';
    return 'No se pudo subir el archivo.';
  }
}
