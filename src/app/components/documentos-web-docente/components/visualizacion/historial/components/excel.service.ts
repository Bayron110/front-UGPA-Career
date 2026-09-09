import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { HistorialRegistro } from './interface/HistorialRegistro';

@Injectable({ providedIn: 'root' })
export class ExcelService {

  /**
   * Genera y descarga un Excel a partir de los registros del historial.
   * Lanza un Error si no hay datos para exportar.
   */
  exportarHistorial(datos: HistorialRegistro[]): void {
    if (!datos || datos.length === 0) {
      throw new Error('⚠️ No hay registros para exportar');
    }

    const filas = datos.map((item) => ({
      'Tipo': item.tipoLabel,
      'Cédula': item.cedula || '—',
      'Nombres completos': item.docente || '—',
      'Carrera': item.carrera || '—',
      'Código documento': item.codigo || '—',
      'Estado de entrega': item.entregado ? 'Entregado' : 'Pendiente'
    }));

    const worksheet = XLSX.utils.json_to_sheet(filas);

    // Ancho de columnas
    worksheet['!cols'] = [
      { wch: 16 }, // Tipo
      { wch: 14 }, // Cédula
      { wch: 32 }, // Nombres completos
      { wch: 28 }, // Carrera
      { wch: 20 }, // Código documento
      { wch: 18 }, // Estado de entrega
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial');

    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `historial-documentos-${fecha}.xlsx`;

    XLSX.writeFile(workbook, nombreArchivo);
  }
}