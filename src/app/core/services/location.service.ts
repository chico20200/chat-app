import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { MessageLocation } from '../models/message';

/** Ubicación del dispositivo. En la web usa la API del navegador; en Android, el GPS nativo. */
@Injectable({ providedIn: 'root' })
export class LocationService {
  async getCurrentPosition(): Promise<MessageLocation> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
      };
    } catch (error) {
      throw new Error(this.errorMessage(error));
    }
  }

  /** Enlace universal: en Android abre la app de mapas; en la web, Google Maps. */
  mapsUrl(location: MessageLocation): string {
    return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  }

  private errorMessage(error: unknown): string {
    const text = String((error as { message?: string })?.message ?? error).toLowerCase();
    if (text.includes('denied') || text.includes('permission')) {
      return 'Necesitas permitir el acceso a tu ubicación para compartirla.';
    }
    if (text.includes('timeout') || text.includes('expired')) {
      return 'No se pudo obtener la ubicación a tiempo. Intenta de nuevo.';
    }
    if (text.includes('unavailable') || text.includes('disabled') || text.includes('not enabled')) {
      return 'La ubicación del dispositivo está desactivada.';
    }
    return 'No se pudo obtener tu ubicación.';
  }
}
