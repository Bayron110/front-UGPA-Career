import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

@Component({
  selector: 'app-acuerdo-pd',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './acuerdo-pd.html',
  styleUrls: ['./acuerdo-pd.css']
})
export class AcuerdoPD {
  datosExcel = signal<any[]>([]);
  columnas = signal<string[]>([]);
  cargando = signal<boolean>(false);
  nombreArchivo = signal<string>('');
  plantillaWord = signal<ArrayBuffer | null>(null);
  nombrePlantilla = signal<string>('');
  mostrarModalPlantilla = signal<boolean>(false);
  htmlPreview = signal<string>('');

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.nombreArchivo.set(file.name);
    this.cargando.set(true);

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        const html = XLSX.utils.sheet_to_html(sheet, { id: 'excel-preview' });

        this.htmlPreview.set(html);
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

  onPlantillaChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
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

  abrirModalPlantilla(): void {
    this.mostrarModalPlantilla.set(true);
  }

  cerrarModal(): void {
    this.mostrarModalPlantilla.set(false);
  }

  async procesarDocumentos(): Promise<void> {
    const plantilla = this.plantillaWord();
    if (!plantilla) {
      alert('No se ha cargado una plantilla');
      return;
    }

    this.cargando.set(true);
    this.cerrarModal();

    try {
      const zip = new JSZip();
      const datos = this.datosExcel();

      for (let i = 0; i < datos.length; i++) {
        const persona = datos[i];
        
        const docxBlob = await this.generarDOCX(plantilla, persona);
        const codigo = persona['Codigo'] || '0000';
        const nombre = persona['NombresC'] || 'SinNombre';
        const nombreArchivo = `${codigo}-${nombre}.docx`;
        zip.file(nombreArchivo, docxBlob);

        console.log(`✓ Procesado ${i + 1}/${datos.length}: ${nombreArchivo}`);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'documentos_word.zip');
      alert(`✓ Se generaron ${datos.length} documentos WORD correctamente

💡 Los archivos mantienen TODO el formato original.
Puedes abrirlos en Word y exportar a PDF si lo necesitas.`);
    } catch (error) {
      console.error('Error al generar documentos:', error);
      alert('Error al generar los documentos: ' + (error as any).message);
    } finally {
      this.cargando.set(false);
    }
  }

  async generarDOCX(plantillaBuffer: ArrayBuffer, persona: any): Promise<Blob> {
    try {
      const zip = new PizZip(plantillaBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' }
      });

      const datos: any = {};
      const columnas = this.columnas();
      
      for (const columna of columnas) {
  const key = columna.trim();
  const valor = persona[columna];

  // ✅ Si el valor está vacío, se pasa como undefined para que Docxtemplater lo oculte
  datos[key] = valor !== null && valor !== undefined && String(valor).trim() !== ''
    ? String(valor)
    : undefined;
}
const capacitacionesRaw = persona['Capacitaciones'];
const listaCapacitaciones = typeof capacitacionesRaw === 'string'
  ? capacitacionesRaw.split('-').map(c => c.trim()).filter(c => c !== '')
  : [];

datos['capacitaciones'] = listaCapacitaciones;

      doc.render(datos);

      const docxBuffer = doc.getZip().generate({ 
        type: 'arraybuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

      return new Blob([docxBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
    } catch (error) {
      console.error('Error al generar DOCX:', error);
      
      if ((error as any).properties?.errors) {
        const errores = (error as any).properties.errors;
        throw new Error(`Error en la plantilla:\n${JSON.stringify(errores, null, 2)}`);
      }
      
      throw new Error('Error al generar documento Word. Verifica que:\n1. La plantilla use variables como {{NombreVariable}}\n2. Los nombres coincidan con las columnas del Excel');
    }
  }

  limpiarDatos(): void {
    this.datosExcel.set([]);
    this.columnas.set([]);
    this.nombreArchivo.set('');
    this.plantillaWord.set(null);
    this.nombrePlantilla.set('');
    this.htmlPreview.set('');
  }
}
