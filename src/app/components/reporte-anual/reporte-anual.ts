import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import Chart from 'chart.js/auto';
import ImageModule from 'docxtemplater-image-module-free';



@Component({
  selector: 'app-reporte-anual',
  imports: [CommonModule],
  templateUrl: './reporte-anual.html',
  styleUrl: './reporte-anual.css'
})
export class ReporteAnual {
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

    const imageModule = new (ImageModule as any)({
  getImage: (tagValue: string) => {
    if (!tagValue) return null;
    const base64 = tagValue.replace(/^data:image\/png;base64,/, '');
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  },
  getSize: () => [600, 350]
});

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      modules: [imageModule]
    });

    const datos: any = {};
    const columnas = this.columnas();

    console.log('Procesando persona:', persona);

    for (const columna of columnas) {
      const key = columna.trim();
      const valor = persona[columna];
      datos[key] =
        valor !== null && valor !== undefined && String(valor).trim() !== ''
          ? String(valor)
          : undefined;
    }

    const capacitacionesRaw = persona['Capacitaciones'];
    const horasRaw = persona['Horas'];
    const fechasRaw = persona['Fecha'];
    const modalidadesRaw = persona['modalidades'];
    const participacionRaw = persona['participacion'];
    const porcentajeRaw = persona['porcentaje'];
    
    const nombres = this.procesarCampoLista(capacitacionesRaw, 'Capacitaciones');
    const horas = this.procesarCampoLista(horasRaw, 'Horas');
    const fechas = this.procesarCampoLista(fechasRaw, 'Fechas');
    const modalidades = this.procesarCampoLista(modalidadesRaw, 'Modalidades');
    const participacion = this.procesarCampoLista(participacionRaw, 'Participacion');
    const porcentaje = this.procesarCampoLista(porcentajeRaw, 'Porcentaje');

    const tiposRaw = persona.hasOwnProperty('Tipo') ? persona['Tipo'] : null;
    const tipos = tiposRaw
      ? this.procesarCampoLista(tiposRaw, 'Tipos')
      : nombres.map(() => 'Aprobación');
    const inscripRaw = persona.hasOwnProperty('inscrip') ? persona['inscrip'] : null;
    const inscrip = inscripRaw
    ? this.procesarCampoLista(inscripRaw, "inscrip")
    :nombres.map(() => 'Si');
    const apoyoRaw = persona.hasOwnProperty('apoyo') ? persona['apoyo']: null;
    const apoyo = apoyoRaw
    ? this.procesarCampoLista(apoyoRaw, "apoyo")
    : nombres.map(()=>'Apoyo Institucional');
    const cumplimientoRaw = persona.hasOwnProperty('cumplimiento') ? persona['cumplimiento']: null;
    const cumplimiento = cumplimientoRaw
    ? this.procesarCampoLista(cumplimientoRaw, "cumplimiento")
    : nombres.map(()=>'Cumplido');


    
    const estadoRaw = persona.hasOwnProperty('estado') ? persona['estado'] : null;
    const estado = estadoRaw ? this.procesarCampoLista(estadoRaw, "estado"): nombres.map(()=> 'Aprobación')

    const minLength = Math.min(
      nombres.length,
      horas.length,
      fechas.length,
      modalidades.length,
      tipos.length,
      participacion.length,
      porcentaje.length,
      inscrip.length,
      estado.length,
      apoyo.length,
      cumplimiento.length,
    );

    let contador = 1;
    let totalHoras = 0;
    const listaCapacitaciones: any[] = [];

    for (let i = 0; i < minLength; i++) {
      const horaNumerica = Number(horas[i]) || 0;
      totalHoras += horaNumerica;

      listaCapacitaciones.push({
        contador: contador++,
        nombre: nombres[i] || '',
        horas: horas[i] || '',
        fecha: fechas[i] || '',
        modalidades: modalidades[i] || '',
        tipo: tipos[i] || 'Aprobación',
        participacion: participacion[i] || '',
        porcentaje: porcentaje[i] || '' ,
        inscrip: inscrip[i] || '',
        estado: estado[i] || '',
        apoyo: apoyo[i] || '',
        cumplimiento: cumplimiento[i] || '',
        imagen: this.buscarImagen(
    persona['NombresC'],
    nombres[i]
  )
      });
    }

    datos['capacitaciones'] = listaCapacitaciones;
    datos['THoras'] = totalHoras;

    const graficoBase64 = await this.generarGrafico(listaCapacitaciones);
    datos['grafico'] = graficoBase64;

    const graficoBase641 = await this.generarGrafico2(listaCapacitaciones);
    datos['grafico2'] = graficoBase641;
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
    console.error('❌ Error al generar DOCX:', error);

    if ((error as any).properties?.errors) {
      throw new Error(
        'Error en la plantilla Word:\n' +
        JSON.stringify((error as any).properties.errors, null, 2)
      );
    }

    throw new Error('Error al generar documento Word. Revisa la consola.');
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

      let nombreLimpio = String(persona['NombresC'] || 'SinNombre')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let nombreArchivoWord = `${persona['Codigo']}-${nombreLimpio}`;

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

  async generarGrafico(lista: any[]): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // 🎨 Fondo degradado elegante
    const bgGradient = ctx.createLinearGradient(0, 0, 0, 600);
    bgGradient.addColorStop(0, '#f8f9fa');
    bgGradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1000, 600);

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: lista.map(c => c.nombre),
        datasets: [{
          label: 'Horas de capacitación',
          data: lista.map(c => Number(c.horas) || 0),
          
          // 🎨 PALETA ELEGANTE Y PROFESIONAL
          backgroundColor: [
            'rgba(99, 102, 241, 0.85)',   // Índigo elegante
            'rgba(59, 130, 246, 0.85)',   // Azul corporativo
            'rgba(16, 185, 129, 0.85)',   // Verde esmeralda
            'rgba(245, 158, 11, 0.85)',   // Ámbar
            'rgba(139, 92, 246, 0.85)',   // Púrpura
            'rgba(236, 72, 153, 0.85)',   // Rosa fucsia
            'rgba(20, 184, 166, 0.85)',   // Turquesa
            'rgba(251, 146, 60, 0.85)',   // Naranja
          ],
          
          borderColor: [
            'rgba(99, 102, 241, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(139, 92, 246, 1)',
            'rgba(236, 72, 153, 1)',
            'rgba(20, 184, 166, 1)',
            'rgba(251, 146, 60, 1)',
          ],
          
          borderWidth: 2,
          borderRadius: 12,
          borderSkipped: false,
          barThickness: 32,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              font: {
                size: 13,
                weight: 600,
                family: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
              },
              color: '#334155',
              padding: 20,
              usePointStyle: true,
              pointStyle: 'rectRounded',
              boxWidth: 10,
              boxHeight: 10
            }
          },
          title: {
            display: true,
            text: 'Resumen de Capacitaciones',
            font: {
              size: 24,
              weight: 700,
              family: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
            },
            color: '#1e293b',
            padding: {
              top: 20,
              bottom: 30
            }
          }
        },
        
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.15)',
              lineWidth: 1,
              drawTicks: false
            },
            border: {
              display: false
            },
            ticks: {
              font: {
                size: 12,
                weight: 500,
                family: "'Segoe UI', Arial, sans-serif"
              },
              color: '#64748b',
              padding: 8,
              callback: function(value) {
                return value + ' hrs';
              }
            }
          },
          y: {
            grid: {
              display: false
            },
            border: {
              display: false
            },
            ticks: {
              font: {
                size: 12,
                weight: 500,
                family: "'Segoe UI', Arial, sans-serif"
              },
              color: '#475569',
              padding: 12
            }
          }
        },
        
        layout: {
          padding: {
            left: 20,
            right: 40,
            top: 10,
            bottom: 20
          }
        },
        
        animation: false
      },
      plugins: [{
        id: 'customShadow',
        beforeDatasetsDraw: (chart: any) => {
          const ctx = chart.ctx;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;
        },
        afterDatasetsDraw: (chart: any) => {
          const ctx = chart.ctx;
          ctx.shadowColor = 'transparent';
        }
      }]
    });

    setTimeout(() => {
      const base64 = canvas.toDataURL('image/png');
      resolve(base64);
    }, 500);
  });
}


// 🎨 ALTERNATIVA 1: MINIMALISTA PREMIUM
async generarGraficoCorporativo(lista: any[]): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // Fondo blanco limpio
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 600);

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: lista.map(c => c.nombre),
        datasets: [{
          label: 'Horas de capacitación',
          data: lista.map(c => Number(c.horas) || 0),
          backgroundColor: 'rgba(30, 64, 175, 0.9)', // Azul oscuro elegante
          borderColor: 'rgba(30, 64, 175, 1)',
          borderWidth: 0,
          borderRadius: 8,
          barThickness: 28,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        plugins: {
          legend: { 
            display: true,
            labels: {
              font: { size: 12, weight: 600, family: "'Inter', sans-serif" },
              color: '#334155',
              usePointStyle: true,
              pointStyle: 'rect',
              padding: 15
            }
          },
          title: {
            display: true,
            text: 'Capacitaciones',
            font: { size: 22, weight: 700, family: "'Inter', sans-serif" },
            color: '#0f172a',
            padding: { top: 20, bottom: 25 }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(226, 232, 240, 0.8)',
              lineWidth: 1,
              drawTicks: false
            },
            border: { display: false },
            ticks: {
              font: { size: 11, weight: 500 },
              color: '#64748b',
              padding: 8,
              callback: (value) => value + ' hrs'
            }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 11, weight: 500 },
              color: '#475569',
              padding: 10
            }
          }
        },
        layout: {
          padding: { left: 20, right: 40, top: 10, bottom: 20 }
        },
        animation: false
      }
    });

    setTimeout(() => resolve(canvas.toDataURL('image/png')), 500);
  });
}

// 🎨 ALTERNATIVA 2: MODERNO CON GRADIENTE
async generarGraficoGradiente(lista: any[]): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // Fondo elegante
    const bgGradient = ctx.createLinearGradient(0, 0, 0, 600);
    bgGradient.addColorStop(0, '#fafafa');
    bgGradient.addColorStop(1, '#f0f4f8');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1000, 600);

    // Gradiente para las barras
    const barGradient = ctx.createLinearGradient(0, 0, 1000, 0);
    barGradient.addColorStop(0, 'rgba(99, 102, 241, 0.9)');
    barGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.9)');
    barGradient.addColorStop(1, 'rgba(236, 72, 153, 0.9)');

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: lista.map(c => c.nombre),
        datasets: [{
          label: 'Horas de capacitación',
          data: lista.map(c => Number(c.horas) || 0),
          backgroundColor: barGradient,
          borderWidth: 0,
          borderRadius: 10,
          barThickness: 30,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        plugins: {
          legend: { 
            display: true,
            labels: {
              font: { size: 13, weight: 600 },
              color: '#334155',
              padding: 18
            }
          },
          title: {
            display: true,
            text: 'Reporte de Capacitaciones',
            font: { size: 24, weight: 700 },
            color: '#1e293b',
            padding: { top: 20, bottom: 28 }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.2)', drawTicks: false },
            border: { display: false },
            ticks: {
              font: { size: 11, weight: 500 },
              color: '#64748b',
              padding: 8
            }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 11, weight: 500 },
              color: '#475569',
              padding: 12
            }
          }
        },
        layout: {
          padding: { left: 20, right: 40, top: 10, bottom: 20 }
        },
        animation: false
      }
    });

    setTimeout(() => resolve(canvas.toDataURL('image/png')), 500);
  });
}

// 🎨 ALTERNATIVA 3: EJECUTIVO OSCURO
async generarGraficoProfesional(lista: any[]): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // Fondo oscuro elegante
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1000, 600);

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: lista.map(c => c.nombre),
        datasets: [{
          label: 'Horas',
          data: lista.map(c => Number(c.horas) || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.85)',
          borderColor: 'rgba(96, 165, 250, 1)',
          borderWidth: 2,
          borderRadius: 10,
          barThickness: 28,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              font: { size: 13, weight: 600 },
              color: '#e2e8f0',
              padding: 18
            }
          },
          title: {
            display: true,
            text: 'Dashboard de Capacitaciones',
            font: { size: 24, weight: 700 },
            color: '#f1f5f9',
            padding: { top: 20, bottom: 28 }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.15)', drawTicks: false },
            border: { display: false },
            ticks: {
              font: { size: 11, weight: 500 },
              color: '#94a3b8',
              padding: 8
            }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 11, weight: 500 },
              color: '#cbd5e1',
              padding: 12
            }
          }
        },
        layout: {
          padding: { left: 20, right: 40, top: 10, bottom: 20 }
        },
        animation: false
      }
    });

    setTimeout(() => resolve(canvas.toDataURL('image/png')), 500);
  });
}


async generarGrafico2(lista: any[]): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // 🎨 Fondo degradado elegante
    const bgGradient = ctx.createLinearGradient(0, 0, 0, 600);
    bgGradient.addColorStop(0, '#f8f9fa');
    bgGradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1000, 600);

    // 🔹 OBTENER PORCENTAJES (limpiando el símbolo % si existe)
    const porcentajes = lista.map(c => {
      const porcentajeStr = String(c.porcentaje || '0').replace('%', '').trim();
      return Number(porcentajeStr) || 0;
    });

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: lista.map(c => c.nombre),
        datasets: [{
          label: 'Porcentaje de asistencia',
          data: porcentajes, // ⭐ USAR PORCENTAJES
          
          // 🎨 PALETA ELEGANTE Y PROFESIONAL
          backgroundColor: [
            'rgba(99, 102, 241, 0.85)',   // Índigo elegante
            'rgba(59, 130, 246, 0.85)',   // Azul corporativo
            'rgba(16, 185, 129, 0.85)',   // Verde esmeralda
            'rgba(245, 158, 11, 0.85)',   // Ámbar
            'rgba(139, 92, 246, 0.85)',   // Púrpura
            'rgba(236, 72, 153, 0.85)',   // Rosa fucsia
            'rgba(20, 184, 166, 0.85)',   // Turquesa
            'rgba(251, 146, 60, 0.85)',   // Naranja
          ],
          
          borderColor: [
            'rgba(99, 102, 241, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(139, 92, 246, 1)',
            'rgba(236, 72, 153, 1)',
            'rgba(20, 184, 166, 1)',
            'rgba(251, 146, 60, 1)',
          ],
          
          borderWidth: 2,
          borderRadius: 12,
          borderSkipped: false,
          barThickness: 32,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              font: {
                size: 13,
                weight: 600,
                family: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
              },
              color: '#334155',
              padding: 20,
              usePointStyle: true,
              pointStyle: 'rectRounded',
              boxWidth: 10,
              boxHeight: 10
            }
          },
          title: {
            display: true,
            text: 'Asistencia a Capacitaciones',
            font: {
              size: 24,
              weight: 700,
              family: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
            },
            color: '#1e293b',
            padding: {
              top: 20,
              bottom: 30
            }
          }
        },
        
        scales: {
          x: {
            beginAtZero: true,
            max: 105, // ⭐ MÁXIMO 100% + espacio para etiquetas
            grid: {
              color: 'rgba(148, 163, 184, 0.15)',
              lineWidth: 1,
              drawTicks: false
            },
            border: {
              display: false
            },
            ticks: {
              font: {
                size: 12,
                weight: 500,
                family: "'Segoe UI', Arial, sans-serif"
              },
              color: '#64748b',
              padding: 8,
              callback: function(value) {
                return value + '%';
              },
              stepSize: 5
            }
          },
          y: {
            grid: {
              display: false
            },
            border: {
              display: false
            },
            ticks: {
              font: {
                size: 12,
                weight: 500,
                family: "'Segoe UI', Arial, sans-serif"
              },
              color: '#475569',
              padding: 12
            }
          }
        },
        
        layout: {
          padding: {
            left: 20,
            right: 60,
            top: 10,
            bottom: 20
          }
        },
        
        animation: false
      },
      plugins: [{
        id: 'customShadow',
        beforeDatasetsDraw: (chart: any) => {
          const ctx = chart.ctx;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;
        },
        afterDatasetsDraw: (chart: any) => {
          const ctx = chart.ctx;
          ctx.shadowColor = 'transparent';
          
          // ⭐ DIBUJAR ETIQUETAS DE PORCENTAJE AL FINAL DE CADA BARRA
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          
          ctx.save();
          ctx.fillStyle = '#1e293b';
          ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          
          meta.data.forEach((bar: any, index: number) => {
            const data = dataset.data[index];
            ctx.fillText(data + '%', bar.x + 8, bar.y);
          });
          
          ctx.restore();
        }
      }]
    });
    setTimeout(() => {
      const base64 = canvas.toDataURL('image/png');
      resolve(base64);
    }, 500);
  });
}


imagenesZip = new Map<string, string>();
async onZipImagenes(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const zip = await JSZip.loadAsync(file);

  for (const nombreArchivo in zip.files) {
    const archivo = zip.files[nombreArchivo];
    if (archivo.dir) continue;

    if (nombreArchivo.match(/\.(jpg|jpeg|png)$/i)) {
      const base64 = await archivo.async('base64');
      this.imagenesZip.set(
        nombreArchivo.toLowerCase(),
        `data:image/png;base64,${base64}`
      );
    }
  }

  console.log('Imágenes cargadas:', this.imagenesZip.size);
}
buscarImagen(nombreDocente: string, capacitacion: string): string | null {
  if (!nombreDocente || !capacitacion) {
    console.warn('⚠️ Datos incompletos para buscar imagen');
    return null;
  }

  // Normalizar nombres (quitar espacios extras, minúsculas)
  const docenteNormalizado = nombreDocente.trim().toLowerCase();
  const capacitacionNormalizada = capacitacion.trim().toLowerCase();

  console.log(`🔍 Buscando imagen para: "${docenteNormalizado} - ${capacitacionNormalizada}"`);

  // Buscar por coincidencia parcial
  for (const [nombreArchivo, base64] of this.imagenesZip.entries()) {
    const archivoNormalizado = nombreArchivo.toLowerCase();

    // Verificar si el archivo contiene tanto el nombre del docente como la capacitación
    if (
      archivoNormalizado.includes(docenteNormalizado) &&
      archivoNormalizado.includes(capacitacionNormalizada)
    ) {
      console.log(`✅ Imagen encontrada: ${nombreArchivo}`);
      return base64;
    }
  }

  console.warn(`⚠️ No se encontró imagen para: ${nombreDocente} - ${capacitacion}`);
  return null;
}

}
