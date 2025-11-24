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
      
      console.log('Datos crudos de Excel:', sheet);
      
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      
      console.log('Datos procesados:', rows);
      
      if (rows.length > 0) {
        const primeraFila = rows[0];
        console.log('Estructura de la primera fila:', primeraFila);
        
        if (primeraFila['Capacitaciones']) {
          console.log('Campo Capacitaciones:', primeraFila['Capacitaciones'], typeof primeraFila['Capacitaciones']);
        }
        if (primeraFila['Horas']) {
          console.log('Campo Horas:', primeraFila['Horas'], typeof primeraFila['Horas']);
        }
        if (primeraFila['Fecha']) {
          console.log('Campo Fecha:', primeraFila['Fecha'], typeof primeraFila['Fecha']);
        }
      }

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
        let nombre = persona['NombresC'] || 'SinNombre';
        nombre = String(nombre).replace(/_/g, "");
        nombre = nombre.replace(/\s+/g, ' ').trim();
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

    console.log('Procesando persona:', persona);

    for (const columna of columnas) {
      const key = columna.trim();
      const valor = persona[columna];
      datos[key] = valor !== null && valor !== undefined && String(valor).trim() !== ''
        ? String(valor)
        : undefined;
    }

    const capacitacionesRaw = persona['Capacitaciones'];
    const horasRaw = persona['Horas'];
    const fechasRaw = persona['Fecha'];

    console.log('Datos crudos - Capacitaciones:', capacitacionesRaw);
    console.log('Datos crudos - Horas:', horasRaw);
    console.log('Datos crudos - Fechas:', fechasRaw);

    const nombres = this.procesarCampoLista(capacitacionesRaw, 'Capacitaciones');
    const horas = this.procesarCampoLista(horasRaw, 'Horas');
    const fechas = this.procesarCampoLista(fechasRaw, 'Fechas');

    console.log('Nombres procesados:', nombres);
    console.log('Horas procesadas:', horas);
    console.log('Fechas procesadas:', fechas);

    if (nombres.length !== horas.length || nombres.length !== fechas.length) {
      console.warn(`⚠️ Discrepancia en longitudes: 
        Capacitaciones: ${nombres.length} 
        Horas: ${horas.length} 
        Fechas: ${fechas.length}`);
      
      const minLength = Math.min(nombres.length, horas.length, fechas.length);
      console.log(`Usando longitud mínima: ${minLength}`);
    }

    const tiposRaw = persona.hasOwnProperty('Tipo') ? persona['Tipo'] : null;
    const tipos = tiposRaw ? this.procesarCampoLista(tiposRaw, 'Tipos') : nombres.map(() => 'APROBACIÓN');

    const minLength = Math.min(nombres.length, horas.length, fechas.length, tipos.length);
    let contador = 1;
    const listaCapacitaciones = [];
    
    for (let i = 0; i < minLength; i++) {
      listaCapacitaciones.push({
        contador: contador++,
        nombre: nombres[i] || '',
        horas: horas[i] || '',
        fecha: fechas[i] || '',
        tipo: tipos[i] || 'APROBACIÓN'
      });
    }

    datos['capacitaciones'] = listaCapacitaciones;

    const teoriasRaw = persona['Teoria'];
    const practicasRaw = persona['Practica'];

    console.log('Datos crudos - Teoria:', teoriasRaw);
    console.log('Datos crudos - Practica:', practicasRaw);

    const teorias = this.procesarCampoLista(teoriasRaw, 'Teorias');
    const practicas = this.procesarCampoLista(practicasRaw, 'Practicas');

    console.log('Teorias procesadas:', teorias);
    console.log('Practicas procesadas:', practicas);

    datos['Teoria'] = teorias;
    datos['Practica'] = practicas;

    console.log('📋 DATOS FINALES PARA PLANTILLA:', {
      capacitaciones: datos['capacitaciones'],
      teorias: datos['Teoria'],
      practicas: datos['Practica']
    });

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

    throw new Error('Error al generar documento Word. Verifica la consola para más detalles.');
  }
}

private procesarCampoLista(campo: any, nombreCampo: string): string[] {
  if (!campo) {
    console.warn(`Campo ${nombreCampo} está vacío o undefined`);
    return [];
  }
  
  const tipo = typeof campo;
  console.log(`Procesando ${nombreCampo}:`, campo, `Tipo: ${tipo}`);
  
  if (tipo === 'string') {
    return campo.split('-').map((item: string) => item.trim()).filter((item: string) => item !== '');
  } else if (Array.isArray(campo)) {
    return campo.map(item => String(item).trim()).filter(item => item !== '');
  } else {
    console.warn(`Tipo inesperado para ${nombreCampo}: ${tipo}`);
    return [String(campo).trim()];
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
  exportarExcel(): void {
  const datos = this.datosExcel();

  if (!datos || datos.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  const filas: any[] = [];

  for (const persona of datos) {

    // Limpiar nombre (Naranjo Armijo Paulina Cumandá)
    let nombreLimpio = String(persona['NombresC'] || 'SinNombre')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Nombre del archivo Word igual que en la exportación
    let nombreArchivoWord = `${persona['Codigo']}-${nombreLimpio}`;

    // Agregar fila al Excel
    filas.push({
      NombreArchivoWord: nombreArchivoWord,
      Codigo: persona['Codigo'] || '',
      NombresC: nombreLimpio,
      Carrera: persona['Carrera1'] || '',
      Cedula: persona['Cedula1'] || '',
      NombreCA: persona['NombreCA'] || '',
      Fecha: persona['Fecha1'] || ''
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(filas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');

  XLSX.writeFile(workbook, 'datos_exportados.xlsx');
}


}
