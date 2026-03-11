import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-reporte-anual',
  imports: [CommonModule],
  templateUrl: './reporte-anual.html',
  styleUrl: './reporte-anual.css'
})
export class ReporteAnual {
  datosExcel            = signal<any[]>([]);
  columnas              = signal<string[]>([]);
  cargando              = signal<boolean>(false);
  nombreArchivo         = signal<string>('');
  plantillaWord         = signal<ArrayBuffer | null>(null);
  nombrePlantilla       = signal<string>('');
  mostrarModalPlantilla = signal<boolean>(false);
  htmlPreview           = signal<SafeHtml>('');

  constructor(private sanitizer: DomSanitizer) {}

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    this.nombreArchivo.set(file.name);
    this.cargando.set(true);

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data     = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        const html        = XLSX.utils.sheet_to_html(sheet, { id: 'excel-preview' });

        this.htmlPreview.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.datosExcel.set(rows);
        this.columnas.set(rows.length > 0 ? Object.keys(rows[0]) : []);
      } catch (error) {
        console.error('Error al procesar Excel:', error);
        alert('Error al procesar el archivo Excel');
      } finally {
        this.cargando.set(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ─────────────────────────────────────────────
  //  CARGA PLANTILLA WORD
  // ─────────────────────────────────────────────
  onPlantillaChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    this.nombrePlantilla.set(file.name);
    this.cargando.set(true);

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.plantillaWord.set(e.target?.result as ArrayBuffer);
      this.cargando.set(false);
      this.procesarDocumentos();
    };
    reader.readAsArrayBuffer(file);
  }

  abrirModalPlantilla(): void { this.mostrarModalPlantilla.set(true);  }
  cerrarModal():         void { this.mostrarModalPlantilla.set(false); }

  // ─────────────────────────────────────────────
  //  PROCESAR TODOS LOS DOCUMENTOS
  // ─────────────────────────────────────────────
  async procesarDocumentos(): Promise<void> {
    const plantilla = this.plantillaWord();
    if (!plantilla) { alert('No se ha cargado una plantilla'); return; }

    this.cargando.set(true);
    this.cerrarModal();

    try {
      const zip   = new JSZip();
      const datos = this.datosExcel();

      for (let i = 0; i < datos.length; i++) {
        const persona  = datos[i];
        const docxBlob = await this.generarDOCX(plantilla, persona);

        const codigo = persona['Codigo'] || '0000';
        const nombre = String(persona['NombresC'] || 'SinNombre')
          .replace(/_/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        zip.file(`${codigo}-${nombre}.docx`, docxBlob);
        console.log(`✓ Procesado ${i + 1}/${datos.length}: ${codigo}-${nombre}.docx`);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'documentos_word.zip');
      alert(`✓ Se generaron ${datos.length} documentos WORD correctamente\n\n💡 Los archivos mantienen TODO el formato original.`);
    } catch (error) {
      console.error('Error al generar documentos:', error);
      alert('Error al generar los documentos: ' + (error as any).message);
    } finally {
      this.cargando.set(false);
    }
  }

  // ─────────────────────────────────────────────
  //  GENERAR DOCX INDIVIDUAL
  // ─────────────────────────────────────────────
  async generarDOCX(plantillaBuffer: ArrayBuffer, persona: any): Promise<Blob> {
    try {
      const imageModule = new ImageModule({
        centered: false,
        fileType: 'docx',
        getImage: (tagValue: string) => {
          const base64 = tagValue.replace(/^data:image\/png;base64,/, '');
          const binary  = atob(base64);
          const bytes   = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        },
        getSize: () => [500, 260],
      });

      const zip = new PizZip(plantillaBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks:    true,
        delimiters:    { start: '{{', end: '}}' },
        modules:       [imageModule],
      });

      const datos: any = {};
      const columnas   = this.columnas();

      for (const columna of columnas) {
        const key   = columna.trim();
        const valor = persona[columna];
        datos[key]  = valor !== null && valor !== undefined && String(valor).trim() !== ''
          ? String(valor)
          : undefined;
      }

      // ── Leer campos crudos ──
      const capacitacionesRaw = persona['Capacitaciones'];
      const horasRaw          = persona['Horas'];
      const fechasRaw         = persona['Fecha'];
      const tiposRaw          = persona['Tipo']        ?? null;
      // ✅ buscar con distintas variantes del nombre de columna
      const modalidadesRaw    = persona['modalidades'] ?? persona['Modalidad'] ?? persona['Modalidades'] ?? persona['modalidad'] ?? null;
      // ✅ buscar con distintas variantes del nombre de columna
      const inscripRaw        = persona['inscrip'] ?? persona['Inscripción'] ?? persona['Inscripcion'] ?? persona['inscripcion'] ?? null;
      const estadosRaw        = persona['Estado']      ?? null;
      const porcentajesRaw    = persona['porcentaje']  ?? null;

      const participacionRaw =
        persona['Participacion'] ??
        persona['participacion'] ??
        persona['Participación'] ??
        persona['participación'] ??
        null;

      // ── Convertir a arrays ──
      const nombres     = this.procesarCampoLista(capacitacionesRaw, 'Capacitaciones');
      const horas       = this.procesarCampoLista(horasRaw,          'Horas');
      const fechas      = this.procesarCampoLista(fechasRaw,         'Fechas');
      const tipos       = tiposRaw       ? this.procesarCampoLista(tiposRaw,       'Tipos')       : nombres.map(() => 'Generica');
      // ✅ default 'Modalidad Virtual' si no existe la columna modalidades
      const modalidades = modalidadesRaw ? this.procesarCampoLista(modalidadesRaw, 'Modalidades') : nombres.map(() => 'Modalidad Virtual');
      const estados     = estadosRaw     ? this.procesarCampoLista(estadosRaw,     'Estados')     : nombres.map(() => 'APROBADO');
      const porcentajes = porcentajesRaw ? this.procesarCampoLista(porcentajesRaw, 'Porcentaje')  : nombres.map(() => '100');

      // ✅ default 'Si' si no existe la columna inscrip
      const inscripciones = inscripRaw
        ? this.procesarCampoLista(inscripRaw, 'Inscripciones').map(v => v || 'Si')
        : nombres.map(() => 'Si');

      const participaciones = participacionRaw
        ? this.procesarCampoLista(participacionRaw, 'Participacion').map(v => v || 'Si')
        : nombres.map(() => 'Si');

      const minLength = Math.min(nombres.length, horas.length, fechas.length, tipos.length);
      let contador = 1;
      const listaCapacitaciones: any[] = [];

      for (let i = 0; i < minLength; i++) {
        listaCapacitaciones.push({
          contador:      contador++,
          nombre:        nombres[i]         || '',
          horas:         horas[i]           || '',
          fecha:         fechas[i]          || '',
          tipo:          tipos[i]           || 'Generica',
          modalidad:     modalidades[i]     || 'Modalidad Virtual',
          inscripcion:   inscripciones[i]   || 'Si',
          participacion: participaciones[i] || 'Si',
          estado:        estados[i]         || 'APROBADO',
          porcentaje:    porcentajes[i]     || '100',
        });
      }

      // ── Generar los dos gráficos de barras ──
      // grafico1 → Horas por capacitación      → {{%grafico1}} en Word
      // grafico2 → % de asistencia por cap.    → {{%grafico2}} en Word
      const grafico1 = await this.generarGraficoHoras(listaCapacitaciones);
      const grafico2 = await this.generarGraficoPorcentaje(listaCapacitaciones);

      datos['capacitaciones'] = listaCapacitaciones;
      datos['THoras']         = this.sumarHoras(horasRaw);
      datos['grafico1']       = grafico1;
      datos['grafico2']       = grafico2;

      doc.render(datos);

      const docxBuffer = doc.getZip().generate({
        type:               'arraybuffer',
        compression:        'DEFLATE',
        compressionOptions: { level: 9 },
      });

      return new Blob([docxBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    } catch (error) {
      console.error('Error al generar DOCX:', error);
      if ((error as any).properties?.errors) {
        throw new Error(`Error en la plantilla:\n${JSON.stringify((error as any).properties.errors, null, 2)}`);
      }
      throw new Error('Error al generar documento Word. Verifica la consola para más detalles.');
    }
  }


  private base64ToUint8Array(base64: string): Uint8Array {
    const clean  = base64.replace(/^data:image\/png;base64,/, '');
    const binary = atob(clean);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }


  private crearCanvas(w: number, h: number): HTMLCanvasElement {
    const canvas          = document.createElement('canvas');
    canvas.width          = w;
    canvas.height         = h;
    canvas.style.position = 'absolute';
    canvas.style.left     = '-9999px';
    document.body.appendChild(canvas);
    return canvas;
  }


  private generarGraficoHoras(lista: any[]): Promise<string> {
    return new Promise(resolve => {
      const canvas = this.crearCanvas(720, 360);

      const etiquetas = lista.map((_, i) => `Cap. ${i + 1}`);
      const valores   = lista.map(c => Number(c.horas) || 0);

      const colores = lista.map((_, i) => {
        const t = lista.length > 1 ? i / (lista.length - 1) : 0;
        const r = Math.round(30  + t * (56  - 30));
        const g = Math.round(64  + t * (189 - 64));
        const b = Math.round(175 + t * (248 - 175));
        return `rgba(${r},${g},${b},0.90)`;
      });

      const chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: etiquetas,
          datasets: [{
            label:           'Horas de capacitación',
            data:            valores,
            backgroundColor: colores,
            borderColor:     colores.map((c: string) => c.replace('0.90', '1')),
            borderWidth:     2,
            borderRadius:    8,
            borderSkipped:   false,
          }],
        },
        options: {
          responsive: false,
          animation:  false,
          plugins: {
            legend: {
              display:  true,
              position: 'top',
              labels: {
                font:     { size: 12, weight: 'bold' },
                color:    '#1e293b',
                padding:  12,
                boxWidth: 14,
              },
            },
            title: {
              display: true,
              text:    '📊 Horas de Capacitación',
              font:    { size: 15, weight: 'bold' },
              color:   '#0f172a',
              padding: { top: 6, bottom: 16 },
            },
          },
          scales: {
            x: {
              ticks: { color: '#334155', font: { size: 10 } },
              grid:  { display: false },
              border: { color: '#cbd5e1' },
            },
            y: {
              beginAtZero: true,
              ticks: {
                color:     '#334155',
                font:      { size: 10 },
                stepSize:  1,
              },
              grid:  { color: '#e2e8f0' },
              border: { color: '#cbd5e1' },
              title: {
                display: true,
                text:    'Horas',
                color:   '#64748b',
                font:    { size: 11, weight: 'bold' },
              },
            },
          },
        },
      });

      setTimeout(() => {
        const base64 = canvas.toDataURL('image/png');
        chart.destroy();
        document.body.removeChild(canvas);
        resolve(base64);
      }, 350);
    });
  }


  private generarGraficoPorcentaje(lista: any[]): Promise<string> {
    return new Promise(resolve => {
      const canvas = this.crearCanvas(720, 360);

      const etiquetas = lista.map((_, i) => `Cap. ${i + 1}`);
      const valores   = lista.map(c => Number(c.porcentaje) || 0);

      const colores = valores.map(v => {
        if (v >= 80) return 'rgba(34,197,94,0.88)';  
        if (v >= 60) return 'rgba(234,179,8,0.88)';   
        return         'rgba(239,68,68,0.88)';        
      });
      const bordes = valores.map(v => {
        if (v >= 80) return '#16a34a';
        if (v >= 60) return '#ca8a04';
        return         '#dc2626';
      });

      const chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: etiquetas,
          datasets: [{
            label:           '% Asistencia',
            data:            valores,
            backgroundColor: colores,
            borderColor:     bordes,
            borderWidth:     2,
            borderRadius:    8,
            borderSkipped:   false,
          }],
        },
        options: {
          indexAxis:  'y',   
          responsive: false,
          animation:  false,
          plugins: {
            legend: {
              display:  true,
              position: 'top',
              labels: {
                font:     { size: 12, weight: 'bold' },
                color:    '#1e293b',
                padding:  12,
                boxWidth: 14,
              },
            },
            title: {
              display: true,
              text:    '📈 Porcentaje de Asistencia por Capacitación',
              font:    { size: 15, weight: 'bold' },
              color:   '#0f172a',
              padding: { top: 6, bottom: 16 },
            },
          },
          scales: {
            x: {
              min:  0,
              max:  100,
              ticks: {
                color:    '#334155',
                font:     { size: 10 },
                callback: (val: any) => `${val}%`,
              },
              grid:   { color: '#e2e8f0' },
              border: { color: '#cbd5e1' },
              title: {
                display: true,
                text:    '% Asistencia',
                color:   '#64748b',
                font:    { size: 11, weight: 'bold' },
              },
            },
            y: {
              ticks: { color: '#334155', font: { size: 10 } },
              grid:  { display: false },
              border: { color: '#cbd5e1' },
            },
          },
        },
      });

      setTimeout(() => {
        const base64 = canvas.toDataURL('image/png');
        chart.destroy();
        document.body.removeChild(canvas);
        resolve(base64);
      }, 350);
    });
  }

  private procesarCampoLista(campo: any, nombreCampo: string): string[] {
    if (!campo) {
      console.warn(`Campo ${nombreCampo} está vacío o undefined`);
      return [];
    }
    const tipo = typeof campo;
    if (tipo === 'string') {
      return campo.split('-').map((item: string) => item.trim()).filter((item: string) => item !== '');
    } else if (Array.isArray(campo)) {
      return campo.map((item: any) => String(item).trim()).filter((item: string) => item !== '');
    } else {
      return [String(campo).trim()];
    }
  }

  private sumarHoras(campoHoras: any): number {
    if (!campoHoras) return 0;
    let horasArray: number[] = [];
    if (typeof campoHoras === 'string') {
      horasArray = campoHoras.split('-').map(h => Number(h.trim())).filter(h => !isNaN(h));
    } else if (Array.isArray(campoHoras)) {
      horasArray = campoHoras.map(h => Number(h)).filter(h => !isNaN(h));
    } else if (!isNaN(Number(campoHoras))) {
      horasArray = [Number(campoHoras)];
    }
    return horasArray.reduce((total, h) => total + h, 0);
  }

  limpiarDatos(): void {
    this.datosExcel.set([]);
    this.columnas.set([]);
    this.nombreArchivo.set('');
    this.plantillaWord.set(null);
    this.nombrePlantilla.set('');
    this.htmlPreview.set('');
  }

  exportarExcel(): void {
    const datos = this.datosExcel();
    if (!datos || datos.length === 0) { alert('No hay datos para exportar'); return; }

    const filas: any[] = datos.map(persona => {
      const nombreLimpio = String(persona['NombresC'] || 'SinNombre')
        .replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      return {
        NombreArchivoWord: `${persona['Codigo']}-${nombreLimpio}`,
        Codigo:   persona['Codigo']   || '',
        NombresC: nombreLimpio,
        Carrera:  persona['Carrera1'] || '',
        Cedula:   persona['Cedula1']  || '',
        NombreCA: persona['NombreCA'] || '',
        Fecha:    persona['Fecha1']   || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(filas);
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
    XLSX.writeFile(workbook, 'datos_exportados.xlsx');
  }
}