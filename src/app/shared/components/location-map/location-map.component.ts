import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, viewChild } from '@angular/core';
import * as L from 'leaflet';

/** Mapa pequeño y estático (OpenStreetMap) que marca un punto. No necesita clave de API. */
@Component({
  selector: 'app-location-map',
  template: `<div #map class="map"></div>`,
  styles: `
    :host { display: block; }
    .map { width: 220px; height: 140px; border-radius: 10px; overflow: hidden; }
  `,
})
export class LocationMapComponent {
  readonly lat = input.required<number>();
  readonly lng = input.required<number>();

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('map');
  private map?: L.Map;

  constructor() {
    afterNextRender(() => {
      const center = L.latLng(this.lat(), this.lng());
      this.map = L.map(this.container().nativeElement, {
        center,
        zoom: 15,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(this.map);
      L.circleMarker(center, {
        radius: 8,
        weight: 3,
        color: '#ffffff',
        fillColor: '#3880ff',
        fillOpacity: 1,
      }).addTo(this.map);

      // Si el mapa se creó durante la animación de entrada de la página, recalcula su tamaño.
      setTimeout(() => this.map?.invalidateSize(), 300);
    });

    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }
}
