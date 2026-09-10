import { Injectable } from '@angular/core';
import { imagenPlaceholder1x1 } from './historial.utils';

export interface ResultadoImagen {
  bytes: Uint8Array;
  ok: boolean;
}

@Injectable({ providedIn: 'root' })
export class ImagenService {

 
  async obtenerImagenSeguimiento(url?: string | null): Promise<ResultadoImagen> {
    if (!url) return { bytes: imagenPlaceholder1x1(), ok: false };

    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
      if (!response.ok) return { bytes: imagenPlaceholder1x1(), ok: false };

      const blob = await response.blob();
      const bytesJpg = await this.convertirImagenAJpegBytes(blob);

      if (!bytesJpg || bytesJpg.length < 8) return { bytes: imagenPlaceholder1x1(), ok: false };
      return { bytes: bytesJpg, ok: true };
    } catch {
      return { bytes: imagenPlaceholder1x1(), ok: false };
    }
  }

  /**
   * Convierte un Blob de imagen (cualquier formato soportado por el navegador)
   * a bytes JPEG, usando un canvas intermedio con fondo blanco.
   */
  private convertirImagenAJpegBytes(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('No se pudo crear el canvas'); return; }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(async (jpgBlob) => {
          if (!jpgBlob) { reject('No se pudo convertir la imagen'); return; }
          resolve(new Uint8Array(await jpgBlob.arrayBuffer()));
        }, 'image/jpeg', 0.92);
      };

      img.onerror = () => reject('No se pudo cargar la imagen');
      img.src = URL.createObjectURL(blob);
    });
  }
}