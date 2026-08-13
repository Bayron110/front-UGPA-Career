import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  InformeFinalService,
  CapacitacionConDocentes,
  DocenteInforme,
  RegistroInformeFinal
} from '../../../../services/Informe-Final/informe-final'; // <-- ajusta esta ruta a la real

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
// @ts-ignore - el paquete no trae tipos
import ImageModule from 'docxtemplater-image-module-free';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';

// Worker de pdf.js (vía CDN para evitar configurar el bundler)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// ==========================================
// CONTENIDO REDACTADO POR LA IA (Cerebras)
// Estas son las 5 claves que la plantilla espera como texto de redacción.
// ==========================================
interface ContenidoIAInforme {
  objetivoGeneral: string;
  especifico1: string;
  especifico2: string;
  especifico3: string;
  cumplimientoObj: string;
}

@Component({
  selector: 'app-informe-final',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './informe-final.html',
  styleUrl: './informe-final.css'
})
export class InformeFinal implements OnInit {

  // ==========================================
  // RUTA DE LA PLANTILLA A UTILIZAR
  // ==========================================
  private readonly RUTA_PLANTILLA = 'assets/planificacion/document-final/Informe-Final-E.docx';

  // ==========================================
  // ⚠️ TODO: mueve esto a tu backend (Express) o a un servicio compartido.
  // ==========================================
  private readonly CEREBRAS_API_KEY = 'csk-frk8k2wwvkd6xy2vtj2ctntkfjepxdnrdkj2yxy5t46eejmc';
  private readonly CEREBRAS_MODEL = 'gpt-oss-120b';

  constructor(private informeFinalService: InformeFinalService) { }

  // ==========================================
  // ESTADO GENERAL
  // ==========================================
  cargandoCapacitaciones = false;
  capacitaciones: CapacitacionConDocentes[] = [];
  capacitacionSeleccionada: CapacitacionConDocentes | null = null;

  // ==========================================
  // CÓDIGO DEL DOCUMENTO
  // Ya NO se piden año/mes manualmente: se calculan automáticamente
  // a partir del año-mes de "fechaFin" de la capacitación seleccionada.
  // ==========================================
  codigoDocumento: string = ''; // se completa automáticamente al generar

  // ==========================================
  // CAMPOS QUE PIDE LA PLANTILLA
  // ==========================================
  facilitador: string = '';
  fechaInicio: string = ''; // 'YYYY-MM-DD' (se precarga automáticamente al seleccionar la capacitación)
  fechaFin: string = '';    // 'YYYY-MM-DD' (se precarga automáticamente al seleccionar la capacitación)

  // ==========================================
  // FILTRO DE BÚSQUEDA (por nombre o cédula)
  // ==========================================
  filtroTexto: string = '';

  registroExistente: RegistroInformeFinal | null = null;

  get docentesFiltrados(): DocenteInforme[] {
    if (!this.capacitacionSeleccionada) return [];

    const texto = this.filtroTexto.trim().toLowerCase();
    if (!texto) return this.capacitacionSeleccionada.docentes;

    return this.capacitacionSeleccionada.docentes.filter(d =>
      d.nombre.toLowerCase().includes(texto) ||
      d.cedula.toLowerCase().includes(texto)
    );
  }

  // ==========================================
  // VISTA PREVIA DEL AÑO-MES QUE TENDRÁ EL CÓDIGO (para mostrar en el HTML)
  // Se calcula directamente del año-mes de fechaFin.
  // ==========================================
  get previewAnioMesCodigo(): string {
    if (!this.fechaFin) return '';
    const { anio, mes } = this.obtenerAnioMesDeFecha(this.fechaFin);
    return `${anio}-${String(mes).padStart(2, '0')}`;
  }

  // ==========================================
  // CERTIFICADOS PDF
  // ==========================================
  certificadosSinAsignar: File[] = [];

  // ==========================================
  // GENERACIÓN DE INFORME
  // ==========================================
  generando = false;
  estadoGeneracion = '';

  async ngOnInit(): Promise<void> {
    await this.cargarCapacitaciones();
  }

  // ==========================================
  // CARGA TODAS LAS CAPACITACIONES CON SUS DOCENTES (patrociniosGenerados)
  // ==========================================
  async cargarCapacitaciones(): Promise<void> {
    this.cargandoCapacitaciones = true;
    try {
      this.capacitaciones = await this.informeFinalService.obtenerCapacitacionesConDocentes();

      // Todos los docentes inician como Aprobado por defecto
      for (const cap of this.capacitaciones) {
        for (const docente of cap.docentes) {
          if (docente.aprobado === undefined) {
            docente.aprobado = true;
          }
        }
      }
    } catch (error) {
      console.error('Error al cargar capacitaciones con docentes:', error);
      alert('No se pudieron cargar las capacitaciones.');
    } finally {
      this.cargandoCapacitaciones = false;
    }
  }

  // ==========================================
  // SELECCIONAR CAPACITACIÓN Y PRECARGAR SUS FECHAS
  // Las fechas se buscan cruzando con los nodos de Planificación
  // (carreras/{id}/capacitaciones y capacitacionesGenericas), ya que
  // patrociniosGenerados no las guarda.
  // ==========================================
async seleccionarCapacitacion(slug: string): Promise<void> {
  this.capacitacionSeleccionada = this.capacitaciones.find(c => c.slug === slug) ?? null;
  this.certificadosSinAsignar = [];
  this.filtroTexto = '';
  this.facilitador = '';
  this.fechaInicio = '';
  this.fechaFin = '';
  this.registroExistente = null;

  if (!this.capacitacionSeleccionada) return;

  try {
    const fechas = await this.informeFinalService.obtenerFechasCapacitacion(
      this.capacitacionSeleccionada.capacitacion,
      this.capacitacionSeleccionada.carrera
    );

    if (fechas) {
      this.fechaInicio = fechas.fechaInicio;
      this.fechaFin = fechas.fechaFin;
    }
  } catch (error) {
    console.error('Error al buscar las fechas de la capacitación:', error);
  }

  // Verifica si esta capacitación ya tiene un informe generado
  try {
    this.registroExistente = await this.informeFinalService.obtenerRegistroPorSlug(
      this.capacitacionSeleccionada.slug
    );
    if (this.registroExistente) {
      this.facilitador = this.registroExistente.facilitador;
      this.codigoDocumento = this.registroExistente.codigo;
    }
  } catch (error) {
    console.error('Error al verificar si ya existe informe:', error);
  }
}

  // ==========================================
  // CAMBIAR ESTADO APROBADO / REPROBADO
  // ==========================================
  toggleAprobado(docente: DocenteInforme): void {
    docente.aprobado = !docente.aprobado;
  }

  // ==========================================
  // CORREGIR GÉNERO MANUALMENTE
  // La detección automática (API + heurística) puede fallar en casos raros;
  // esto permite corregirlo con un clic directo en la tabla.
  // ==========================================
  toggleGenero(docente: DocenteInforme): void {
    docente.genero = docente.genero === 'M' ? 'F' : 'M';
  }

  // ==========================================
  // CARGA DE CERTIFICADOS PDF (intenta emparejar por cédula en el nombre del archivo)
  // ==========================================
  onCertificadosSeleccionados(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !this.capacitacionSeleccionada) return;

    const archivos = Array.from(input.files);
    this.certificadosSinAsignar = [];

    for (const archivo of archivos) {
      const docenteEncontrado = this.capacitacionSeleccionada.docentes.find(d =>
        archivo.name.includes(d.cedula)
      );

      if (docenteEncontrado) {
        docenteEncontrado.certificado = archivo;
      } else {
        this.certificadosSinAsignar.push(archivo);
      }
    }

    if (this.certificadosSinAsignar.length > 0) {
      alert(
        `${this.certificadosSinAsignar.length} certificado(s) no se pudieron emparejar automáticamente ` +
        `(el nombre del archivo debe contener la cédula del docente). Asígnelos manualmente.`
      );
    }
  }

  asignarCertificadoManual(docente: DocenteInforme, archivo: File): void {
    docente.certificado = archivo;
    this.certificadosSinAsignar = this.certificadosSinAsignar.filter(a => a !== archivo);
  }

  // ==========================================
  // ESTADÍSTICAS
  // ==========================================
  get totalAprobados(): number {
    return this.capacitacionSeleccionada?.docentes.filter(d => d.aprobado).length ?? 0;
  }

  get totalReprobados(): number {
    return this.capacitacionSeleccionada?.docentes.filter(d => d.aprobado === false).length ?? 0;
  }

  get totalHombres(): number {
    return this.capacitacionSeleccionada?.docentes.filter(d => d.genero === 'M').length ?? 0;
  }

  get totalMujeres(): number {
    return this.capacitacionSeleccionada?.docentes.filter(d => d.genero === 'F').length ?? 0;
  }

  private calcularPorcentaje(parte: number, total: number): string {
    if (!total) return '0%';
    return `${Math.round((parte / total) * 100)}%`;
  }

  private generoTexto(g: string): string {
    if (g === 'M') return 'Masculino';
    if (g === 'F') return 'Femenino';
    return '';
  }

  // ==========================================
  // TEXTO DE "CARRERA" PARA LA PLANTILLA
  // IMPORTANTE: cap.carrera NO es confiable para capacitaciones genéricas,
  // porque el servicio agrupa por slug de capacitación y solo guarda la
  // carrera del PRIMER docente que se proceso (patrociniosGenerados).
  // Por eso aquí se calculan las carreras reales a partir de cap.docentes.
  // ==========================================
  private obtenerTextoCarrera(cap: CapacitacionConDocentes): string {
    // Carreras distintas de los docentes que en verdad participan en ESTA capacitación
    const carrerasEnEstaCap = Array.from(new Set(cap.docentes.map(d => d.carrera)));

    // Universo total de carreras que existen entre TODOS los docentes cargados
    const carrerasUnicasTotal = Array.from(
      new Set(this.capacitaciones.flatMap(c => c.docentes.map(d => d.carrera)))
    );

    // Caso 1: la capacitación la tienen TODAS las carreras existentes -> genérica
    if (carrerasUnicasTotal.length > 1 && carrerasEnEstaCap.length === carrerasUnicasTotal.length) {
      return 'Dirigido A Todas Las Carreras';
    }

    // Caso 2: la comparten dos o más carreras, pero no todas
    if (carrerasEnEstaCap.length > 1) {
      return `Dirigido A Las Carreras ${this.formatearListaCarreras(carrerasEnEstaCap)}`;
    }

    // Caso 3: es de una sola carrera
    return carrerasEnEstaCap[0] ?? cap.carrera;
  }

  // "Mecanica" | "Mecanica y Motos" | "Mecanica, Motos y Desarrollo"
  private formatearListaCarreras(carreras: string[]): string {
    if (carreras.length === 1) return carreras[0];
    if (carreras.length === 2) return `${carreras[0]} y ${carreras[1]}`;
    return `${carreras.slice(0, -1).join(', ')} y ${carreras[carreras.length - 1]}`;
  }

  // ==========================================
  // FECHAS
  // ==========================================
  private formatearFechaCorta(d: Date): string {
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${dia}/${mes}/${d.getFullYear()}`;
  }

  private formatearHora(d: Date): string {
    return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }

  // 'YYYY-MM-DD' (o Date) -> "29 de julio de 2026"
  private formatearFechaLarga(fecha: string | Date): string {
    const d = typeof fecha === 'string' ? new Date(fecha + 'T00:00:00') : fecha;
    return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ==========================================
  // EXTRAE {anio, mes} NUMÉRICOS DE UNA FECHA EN CUALQUIERA DE LOS FORMATOS
  // SOPORTADOS (ISO 'yyyy-mm-dd', 'dd/mm/yyyy' u otro parseable por Date)
  // ==========================================
  private obtenerAnioMesDeFecha(fecha: string): { anio: number; mes: number } {
    if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
      // formato ISO: yyyy-mm-dd
      const [anio, mes] = fecha.split('-').map(Number);
      return { anio, mes };
    } else if (fecha.includes('/')) {
      // formato dd/mm/yyyy
      const [, mes, anio] = fecha.split('/').map(Number);
      return { anio, mes };
    } else {
      const d = new Date(fecha);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    }
  }

  // ==========================================
  // CALCULA EL AÑO-MES QUE SE USARÁ PARA EL CÓDIGO DEL DOCUMENTO:
  // el mismo año-mes de "fechaFin" de la capacitación.
  // ==========================================
  private calcularAnioMesCodigo(fechaFin: string): { anio: string; mes: string } {
    const { anio, mes } = this.obtenerAnioMesDeFecha(fechaFin);
    return {
      anio: String(anio),
      mes: String(mes).padStart(2, '0')
    };
  }

  // ==========================================
  // RENDERIZA LA 1RA PÁGINA DE UN PDF (certificado) COMO IMAGEN PNG
  // ==========================================
  private async extraerPrimeraHojaComoImagen(archivo: File): Promise<ArrayBuffer> {
    if (archivo.type !== 'application/pdf') {
      throw new Error('El certificado debe ser un archivo PDF.');
    }

    const arrayBuffer = await archivo.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo obtener el contexto 2D.');
    }

    const renderTask = page.render({ canvas, viewport });
    await renderTask.promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) { reject(new Error('No se pudo generar la imagen del certificado.')); return; }
        resolve(await blob.arrayBuffer());
      }, 'image/png');
    });
  }

  // ==========================================
  // REDACCIÓN CON IA (Cerebras) — ObjetivoGeneral, Específicos y Cumplimiento
  // ==========================================
  private async generarContenidoConIA(cap: CapacitacionConDocentes): Promise<ContenidoIAInforme> {
    const schema = {
      type: 'object',
      properties: {
        objetivoGeneral: { type: 'string' },
        especifico1: { type: 'string' },
        especifico2: { type: 'string' },
        especifico3: { type: 'string' },
        cumplimientoObj: { type: 'string' }
      },
      required: ['objetivoGeneral', 'especifico1', 'especifico2', 'especifico3', 'cumplimientoObj'],
      additionalProperties: false
    };

    const prompt = `
Eres un asistente que redacta secciones de un informe final de capacitación universitaria en español formal (Ecuador).
Capacitación: "${cap.capacitacion}"
Carrera destinataria: "${cap.carrera}"
Facilitador: "${this.facilitador}"
Número de docentes participantes: ${cap.docentes.length}

Redacta:
- objetivoGeneral: un párrafo con el objetivo general del curso.
- especifico1, especifico2, especifico3: tres objetivos específicos, cada uno como una oración/párrafo corto.
- cumplimientoObj: 2 a 3 párrafos describiendo cómo se cumplieron los objetivos durante la capacitación.

Responde SOLO con el JSON pedido, sin texto adicional.
    `.trim();

    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.CEREBRAS_API_KEY}`
      },
      body: JSON.stringify({
        model: this.CEREBRAS_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'contenido_informe_final', strict: true, schema }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`La IA no pudo redactar el contenido (HTTP ${response.status}).`);
    }

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content;
    if (!texto) {
      throw new Error('La IA no devolvió contenido.');
    }

    return JSON.parse(texto) as ContenidoIAInforme;
  }

  // ==========================================
  // GENERAR INFORME
  // ==========================================
async generarInforme(): Promise<void> {
  if (!this.capacitacionSeleccionada) {
    alert('Seleccione una capacitación.');
    return;
  }
  if (!this.facilitador.trim()) {
    alert('Debe indicar el nombre del facilitador.');
    return;
  }
  if (!this.fechaInicio || !this.fechaFin) {
    alert('Debe indicar la fecha de inicio y la fecha final del curso.');
    return;
  }

  this.generando = true;

  try {
    const cap = this.capacitacionSeleccionada;
    let codigoAUsar: string;
    let anioTexto: string;
    let mesTexto: string;
    const esRegeneracion = !!this.registroExistente;

    if (esRegeneracion) {
      // Ya existe informe para esta capacitación: solo se re-descarga,
      // se reutiliza el mismo código, no se crea un registro nuevo.
      codigoAUsar = this.registroExistente!.codigo;
      anioTexto = this.registroExistente!.anio;
      mesTexto = this.registroExistente!.mes;
      this.codigoDocumento = codigoAUsar;
    } else {
      this.estadoGeneracion = 'Generando código del documento...';
      const anioMes = this.calcularAnioMesCodigo(this.fechaFin);
      anioTexto = anioMes.anio;
      mesTexto = anioMes.mes;

      const totalDelMes = await this.informeFinalService.contarInformesDelMes(anioTexto, mesTexto);
      const numeroCodigo = String(totalDelMes + 1).padStart(2, '0');
      codigoAUsar = `UGPA-INF-${numeroCodigo}-PRO-134-${anioTexto}-${mesTexto}`;
      this.codigoDocumento = codigoAUsar;
    }

    // ==========================================
    // Redacción con IA
    // ==========================================
    this.estadoGeneracion = 'Redactando contenido con IA...';
    const contenidoIA = await this.generarContenidoConIA(cap);

    // ==========================================
    // Certificados (PDF -> imagen)
    // ==========================================
    this.estadoGeneracion = 'Procesando certificados...';
    const docentesAprobadosArr = cap.docentes.filter(d => d.aprobado);
    const imagenesCertificados = new Map<string, ArrayBuffer>();

    for (let i = 0; i < docentesAprobadosArr.length; i++) {
      const docente = docentesAprobadosArr[i];
      if (docente.certificado) {
        try {
          const imagen = await this.extraerPrimeraHojaComoImagen(docente.certificado);
          imagenesCertificados.set(`cert-${i}`, imagen);
        } catch (err) {
          console.error(`No se pudo procesar el certificado de ${docente.nombre}:`, err);
        }
      }
    }

    // ==========================================
    // Armar el documento Word
    // ==========================================
    this.estadoGeneracion = 'Generando documento Word...';

    const response = await fetch(this.RUTA_PLANTILLA);
    if (!response.ok) {
      throw new Error(`No se pudo cargar la plantilla (HTTP ${response.status} - ${response.statusText}).`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('La ruta de la plantilla devolvió HTML en lugar del archivo .docx.');
    }
    const templateArrayBuffer = await response.arrayBuffer();
    if (templateArrayBuffer.byteLength === 0) {
      throw new Error('La plantilla se descargó vacía (0 bytes).');
    }

    const zip = new PizZip(templateArrayBuffer);

    const imageModule = new ImageModule({
      getImage: (tagValue: string): ArrayBuffer => imagenesCertificados.get(tagValue) ?? new ArrayBuffer(0),
      getSize: (): [number, number] => [580, 400]
    });

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => ''
    });

    const docentesAprobados = docentesAprobadosArr.map((d, i) => ({
      contador: i + 1,
      nombre: d.nombre,
      certificadoImg: imagenesCertificados.has(`cert-${i}`) ? `cert-${i}` : ''
    }));

    doc.render({
      Codigo: codigoAUsar,
      fecha: this.formatearFechaLarga(this.fechaFin),
      'capacitación': cap.capacitacion,
      carrera: this.obtenerTextoCarrera(cap),
      facilitador: this.facilitador,
      fechaI: this.formatearFechaLarga(this.fechaInicio),
      fechaF: this.formatearFechaLarga(this.fechaFin),
      ObjectivoGeneral: contenidoIA.objetivoGeneral,
      Especifico1: contenidoIA.especifico1,
      Especifico2: contenidoIA.especifico2,
      Especifico3: contenidoIA.especifico3,
      CumplimientoObj: contenidoIA.cumplimientoObj,
      docentes: cap.docentes.map((d, i) => ({
        contador: i + 1,
        nombre: d.nombre,
        cedula: d.cedula,
        genero: this.generoTexto(d.genero)
      })),
      contadorH: this.totalHombres,
      ContadorF: this.totalMujeres,
      porcentajeH: this.calcularPorcentaje(this.totalHombres, cap.docentes.length),
      porcentajeF: this.calcularPorcentaje(this.totalMujeres, cap.docentes.length),
      docentesAprobados: docentesAprobados,
      Tdocentes: cap.docentes.length,
      TAprobados: this.totalAprobados,
      TReprobados: this.totalReprobados
    });

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    // ==========================================
    // Guardar registro SOLO si es la primera vez que se genera
    // ==========================================
    if (!esRegeneracion) {
      this.estadoGeneracion = 'Guardando registro en la base de datos...';
      try {
        const ahora = new Date();
        const datosGuardado: RegistroInformeFinal = {
          codigo: codigoAUsar,
          anio: anioTexto,
          mes: mesTexto,
          capacitacionSlug: cap.slug,
          capacitacion: cap.capacitacion,
          carrera: cap.carrera,
          facilitador: this.facilitador,
          fechaCreacion: `${this.formatearFechaCorta(ahora)} ${this.formatearHora(ahora)}`,
          totalDocentes: cap.docentes.length,
          totalAprobados: this.totalAprobados,
          totalReprobados: this.totalReprobados
        };

        await this.informeFinalService.guardarRegistro(datosGuardado);
        this.registroExistente = datosGuardado;
      } catch (dbError) {
        console.error('Error al guardar el registro en la base de datos:', dbError);
        alert('El informe se generó, pero no se pudo guardar el registro en la base de datos.');
      }
    }

    const nombreArchivo = `${codigoAUsar}-${cap.capacitacion || 'InformeFinal'}.docx`
      .replace(/[\\/:*?"<>|]/g, '-');

    saveAs(out, nombreArchivo);

  } catch (error: any) {
    console.error('Error al generar el informe:', error);
    if (error?.properties?.errors?.length) {
      const mensajes = error.properties.errors
        .map((e: any, i: number) => `${i + 1}. ${e.properties?.explanation ?? e.message}`)
        .join('\n');
      alert(`Error(es) en la plantilla Word:\n\n${mensajes}`);
    } else {
      alert(error?.message ?? 'Ocurrió un error al generar el informe.');
    }
  } finally {
    this.generando = false;
    this.estadoGeneracion = '';
  }
}
}