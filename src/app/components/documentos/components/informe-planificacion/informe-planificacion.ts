import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  PlanificacionService,
  CapacitacionUnificada,
  RegistroPlanificacion
} from '../../../../services/planificacion/planificacion';
import { IaService, CamposGenerados } from '../../../../services/IA/ia';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
// @ts-ignore - el paquete no trae tipos
import ImageModule from 'docxtemplater-image-module-free';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

@Component({
  selector: 'app-informe-planificacion',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './informe-planificacion.html',
  styleUrl: './informe-planificacion.css'
})
export class InformePlanificacion implements OnInit {

  // ==========================================
  // A partir de ahora solo existe una plantilla (la G)
  // ==========================================
  private readonly RUTA_PLANTILLA = 'assets/planificacion/document/Informe-Planificación-E.docx';

  constructor(
    private planificacionService: PlanificacionService,
    private iaService: IaService
  ) { }

  cargandoCapacitaciones = false;
  capacitaciones: CapacitacionUnificada[] = [];
  capacitacionSeleccionada: CapacitacionUnificada | null = null;

  codigoDocumento: string = ''; // se completa automáticamente al generar
  registroExistente: RegistroPlanificacion | null = null;

  estadoGeneracion: string = '';
  generando: boolean = false;

  hojaVida: File | null = null;
  capturas: File[] = [];

  promptIA: string = '';
  generandoIA: boolean = false;
  camposIA: CamposGenerados | null = null;

  async ngOnInit(): Promise<void> {
    await this.cargarCapacitaciones();
  }

  // ==========================================
  // CARGA LA LISTA UNIFICADA (ya sin distinción Plantilla E / G)
  // ==========================================
  async cargarCapacitaciones(): Promise<void> {
    this.cargandoCapacitaciones = true;
    try {
      this.capacitaciones = await this.planificacionService.obtenerCapacitacionesUnificadas();
    } catch (error) {
      console.error('Error al cargar capacitaciones:', error);
      alert('No se pudieron cargar las capacitaciones.');
    } finally {
      this.cargandoCapacitaciones = false;
    }
  }

  // ==========================================
  // SELECCIONAR CAPACITACIÓN Y VERIFICAR SI YA TIENE INFORME GENERADO
  // ==========================================
  async seleccionarCapacitacion(slug: string): Promise<void> {
    this.capacitacionSeleccionada = this.capacitaciones.find(c => c.slug === slug) ?? null;
    this.camposIA = null;
    this.hojaVida = null;
    this.capturas = [];
    this.registroExistente = null;

    if (!this.capacitacionSeleccionada) return;

    try {
      this.registroExistente = await this.planificacionService.obtenerRegistroPorSlug(
        this.capacitacionSeleccionada.slug
      );
      if (this.registroExistente) {
        this.codigoDocumento = this.registroExistente.codigo;
      }
    } catch (error) {
      console.error('Error al verificar si ya existe informe:', error);
    }
  }

  seleccionarHojaVida(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.hojaVida = input.files[0];
    }
  }

  seleccionarCapturas(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.capturas = Array.from(input.files);
    }
  }

  // ==========================================
  // VISTA PREVIA DEL AÑO-MES DEL CÓDIGO (un mes antes de fechaInicio)
  // ==========================================
  get previewAnioMesCodigo(): string {
    if (!this.capacitacionSeleccionada?.fechaInicio) return '';
    const { anio, mes } = this.calcularAnioMesCodigo(this.capacitacionSeleccionada.fechaInicio);
    return `${anio}-${mes}`;
  }

  // ==========================================
  // ARMA EL PROMPT PARA LA IA A PARTIR DE LA CAPACITACIÓN SELECCIONADA
  // Usa el textoCarrera ya calculado por el servicio.
  // ==========================================
  private construirPromptDescripcion(capacitacionTexto: string, textoCarrera: string): string {
    let prompt = `
Reescribe y adapta el siguiente texto de ejemplo para que esté orientado
específicamente a la capacitación "${capacitacionTexto}", ${textoCarrera}.
No copies literalmente el ejemplo: úsalo solo como referencia de tono, extensión
y estructura (introducción del problema, metodología, herramientas, cierre).
Cambia el contenido para que hable del tema real de esta capacitación.

TEXTO DE EJEMPLO (referencia de estilo):
"""
El desarrollo de contenidos de aprendizaje se ha consolidado como una competencia indispensable para garantizar la calidad de los procesos formativos, tanto en el ámbito escolar como universitario y profesional. Dominar esta práctica no solo asegura la creación de materiales claros, coherentes y pertinentes, sino que también fortalece la organización, la innovación pedagógica y la presentación formal de cualquier recurso educativo. Sin embargo, su enseñanza tradicionalmente se ha percibido como rígida, técnica y poco atractiva, lo que representa un desafío considerable en el proceso de capacitación de docentes, diseñadores instruccionales y profesionales en formación.
Frente a esta necesidad, el curso Desarrollador de Contenidos de Aprendizaje propone una metodología innovadora que combina la rigurosidad académica con el dinamismo de la gamificación, logrando así un aprendizaje práctico, significativo, entretenido y altamente motivador. A través de estrategias lúdicas estructuradas, se busca transformar la experiencia de formación en un proceso participativo, interactivo y centrado en el futuro creador de materiales educativos.
Este programa está diseñado específicamente para enseñar de manera efectiva y atractiva el manejo de técnicas, herramientas y metodologías que permitan diseñar, estructurar y adaptar contenidos de aprendizaje en diversos formatos: guías didácticas, módulos digitales, recursos multimedia, evaluaciones interactivas y actividades gamificadas. A lo largo del curso, los participantes aprenderán no solo a organizar la información de manera pedagógica, sino también a integrar recursos tecnológicos, aplicar principios de diseño instruccional y contextualizar los materiales a las necesidades reales de estudiantes y organizaciones educativas.
Durante el desarrollo del curso, se utilizarán diversas herramientas y técnicas innovadoras que incluyen trivias competitivas, escape rooms académicos, misiones temáticas, plataformas digitales interactivas, juegos de roles y dinámicas grupales. Estas actividades permiten a los asistentes aprender haciendo, promover el pensamiento crítico, la toma de decisiones autónoma y la reflexión colaborativa, elementos clave para consolidar el dominio en la creación de contenidos educativos en diferentes contextos.
Al mismo tiempo, el enfoque lúdico y motivacional del curso propicia un ambiente de aprendizaje más inclusivo, positivo y amigable, donde los errores no son penalizados de manera negativa, sino que se convierten en valiosas oportunidades de mejora y crecimiento profesional. El progreso individual y grupal se reconoce a través de sistemas de logros simbólicos, insignias digitales, medallas, rankings de avance y retroalimentaciones constructivas, fortaleciendo la autoestima, la responsabilidad, el sentido ético en el diseño de materiales y la autonomía intelectual de los participantes.
Este curso no solo enseña a desarrollar contenidos de aprendizaje de manera efectiva, sino que también cultiva habilidades transversales fundamentales para el éxito académico y profesional, como la organización, la disciplina intelectual, el trabajo en equipo, la resolución de problemas y la resiliencia ante los desafíos de la innovación educativa y la producción de recursos pedagógicos contemporáneos.
"""
`.trim();

    if (this.promptIA.trim()) {
      prompt += `\n\nInstrucciones adicionales del usuario:\n${this.promptIA.trim()}`;
    }

    return prompt;
  }

  async generarConIA(): Promise<void> {
    if (!this.capacitacionSeleccionada) {
      alert('Seleccione primero la capacitación.');
      return;
    }

    const cap = this.capacitacionSeleccionada;
    const promptFinal = this.construirPromptDescripcion(cap.capacitacion, cap.textoCarrera);

    this.generandoIA = true;
    try {
      this.camposIA = await this.iaService.generarContenidoInforme(promptFinal, cap.capacitacion, cap.textoCarrera);
    } catch (error: any) {
      console.error('Error al generar contenido con IA:', error);
      alert(error?.message ?? 'Error al generar contenido con IA.');
    } finally {
      this.generandoIA = false;
    }
  }

  private async extraerPrimeraHojaComoImagen(archivo: File): Promise<ArrayBuffer> {
    if (archivo.type !== 'application/pdf') {
      throw new Error('Para generar la imagen del facilitador, la hoja de vida debe ser un PDF.');
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
        if (!blob) { reject(new Error('No se pudo generar la imagen de la hoja de vida.')); return; }
        resolve(await blob.arrayBuffer());
      }, 'image/png');
    });
  }

  private repartirEnteros(total: number, partes: number): number[] {
    const pesos = Array.from({ length: partes }, () => Math.random());
    const sumaPesos = pesos.reduce((a, b) => a + b, 0);
    const valores = pesos.map(p => Math.floor((p / sumaPesos) * total));

    let residuo = total - valores.reduce((a, b) => a + b, 0);
    let i = 0;
    while (residuo > 0) {
      valores[i % partes]++;
      residuo--;
      i++;
    }
    return valores;
  }

  private generarDistribucionHoras(maxTotal: number = 40) {
    const minTotal = 24;
    const total = Math.floor(Math.random() * (maxTotal - minTotal + 1)) + minTotal;
    const valores = this.repartirEnteros(total, 12);

    const HorasT = valores.slice(0, 4);
    const HorasP = valores.slice(4, 8);
    const HorasA = valores.slice(8, 12);

    return {
      HorasT1: HorasT[0], HorasT2: HorasT[1], HorasT3: HorasT[2], HorasT4: HorasT[3],
      HorasP1: HorasP[0], HorasP2: HorasP[1], HorasP3: HorasP[2], HorasP4: HorasP[3],
      HorasA1: HorasA[0], HorasA2: HorasA[1], HorasA3: HorasA[2], HorasA4: HorasA[3],
      TotalT: HorasT.reduce((a, b) => a + b, 0),
      TotalP: HorasP.reduce((a, b) => a + b, 0),
      TotalA: HorasA.reduce((a, b) => a + b, 0)
    };
  }

  private formatearFechaLarga(fecha: string): string {
    if (!fecha) return '';

    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    let dia: number, mes: number, anio: number;

    if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
      [anio, mes, dia] = fecha.split('-').map(Number);
    } else if (fecha.includes('/')) {
      [dia, mes, anio] = fecha.split('/').map(Number);
    } else {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      dia = d.getDate();
      mes = d.getMonth() + 1;
      anio = d.getFullYear();
    }

    return `${dia} de ${meses[mes - 1]} de ${anio}`;
  }

  private obtenerAnioMesDeFecha(fecha: string): { anio: number; mes: number } {
    if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
      const [anio, mes] = fecha.split('-').map(Number);
      return { anio, mes };
    } else if (fecha.includes('/')) {
      const [, mes, anio] = fecha.split('/').map(Number);
      return { anio, mes };
    } else {
      const d = new Date(fecha);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    }
  }

  // Sigue siendo UN MES ANTES del mes de fechaInicio (se mantiene esa regla)
  private calcularAnioMesCodigo(fechaInicio: string): { anio: string; mes: string } {
    const { anio, mes } = this.obtenerAnioMesDeFecha(fechaInicio);

    let mesCalculado = mes - 1;
    let anioCalculado = anio;

    if (mesCalculado < 1) {
      mesCalculado = 12;
      anioCalculado -= 1;
    }

    return {
      anio: String(anioCalculado),
      mes: String(mesCalculado).padStart(2, '0')
    };
  }

  private formatearFechaCorta(d: Date): string {
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${dia}/${mes}/${d.getFullYear()}`;
  }

  private formatearHora(d: Date): string {
    return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }

  // ==========================================
  // GENERAR INFORME (mismo patrón que InformeFinal: código por conteo
  // mensual, registro por slug, bloqueo de duplicados con re-descarga)
  // ==========================================
  async generarInforme(): Promise<void> {
    if (!this.capacitacionSeleccionada) {
      alert('Seleccione una capacitación.');
      return;
    }
    if (!this.capacitacionSeleccionada.fechaInicio) {
      alert('La capacitación seleccionada no tiene una fecha de inicio registrada. No se puede calcular el código del documento.');
      return;
    }
    if (!this.hojaVida) {
      alert('Debe subir la hoja de vida del capacitador.');
      return;
    }
    if (this.capturas.length < 3) {
      alert('Debe subir mínimo 3 capturas del aula virtual.');
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
        const anioMes = this.calcularAnioMesCodigo(cap.fechaInicio);
        anioTexto = anioMes.anio;
        mesTexto = anioMes.mes;

        const totalDelMes = await this.planificacionService.contarInformesDelMes(anioTexto, mesTexto);
        const numeroCodigo = String(totalDelMes + 1).padStart(2, '0');
        codigoAUsar = `UGPA-RGI1-${numeroCodigo}-PRO-134-${anioTexto}-${mesTexto}`;
        this.codigoDocumento = codigoAUsar;
      }

      if (!this.camposIA) {
        this.estadoGeneracion = 'Redactando descripción y objetivos con IA...';
        const promptFinal = this.construirPromptDescripcion(cap.capacitacion, cap.textoCarrera);
        try {
          this.camposIA = await this.iaService.generarContenidoInforme(promptFinal, cap.capacitacion, cap.textoCarrera);
        } catch (iaError: any) {
          console.error('Error al generar contenido con IA:', iaError);
          const continuar = confirm(
            (iaError?.message ?? 'Error al generar contenido con IA.') +
            '\n\n¿Desea continuar generando el informe con esos campos vacíos?'
          );
          if (!continuar) {
            this.generando = false;
            this.estadoGeneracion = '';
            return;
          }
        }
      }

      this.estadoGeneracion = 'Procesando hoja de vida del facilitador...';
      const imagenFacilitador = await this.extraerPrimeraHojaComoImagen(this.hojaVida);

      this.estadoGeneracion = 'Procesando capturas del aula virtual...';
      const anexo1 = await this.capturas[0].arrayBuffer();
      const anexo2 = await this.capturas[1].arrayBuffer();
      const anexo3 = await this.capturas[2].arrayBuffer();

      const horas = this.generarDistribucionHoras();
      const fechaInicioTexto = this.formatearFechaLarga(cap.fechaInicio ?? '');
      const fechaFinTexto = this.formatearFechaLarga(cap.fechaFin ?? '');

      this.estadoGeneracion = 'Generando documento Word...';

      const response = await fetch(this.RUTA_PLANTILLA);
      if (!response.ok) {
        throw new Error(`No se pudo cargar la plantilla (HTTP ${response.status} - ${response.statusText}).`);
      }
      const templateArrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(templateArrayBuffer);

      const imageModule = new ImageModule({
        getImage: (tagValue: string): ArrayBuffer => {
          switch (tagValue) {
            case 'Foto': return imagenFacilitador;
            case 'Anexos1': return anexo1;
            case 'Anexos2': return anexo2;
            case 'Anexos3': return anexo3;
            default: return new ArrayBuffer(0);
          }
        },
        getSize: (img: ArrayBuffer, tagValue: string): [number, number] => {
          if (tagValue === 'Foto') return [550, 700];
          return [580, 330];
        }
      });

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        delimiters: { start: '{{', end: '}}' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
      });

      doc.render({
        capacitacion: cap.capacitacion,
        carrera: cap.textoCarrera,
        Codigo: codigoAUsar,
        fechaI: fechaInicioTexto,
        fechaF: fechaFinTexto,

        Descripcion: this.camposIA?.Descripcion ?? '',
        Objectivos: this.camposIA?.Objectivos ?? '',
        dirigido: this.camposIA?.dirigido ?? '',
        Contenido1: this.camposIA?.Contenido1 ?? '',
        Contenido2: this.camposIA?.Contenido2 ?? '',
        Contenido3: this.camposIA?.Contenido3 ?? '',
        Contenido4: this.camposIA?.Contenido4 ?? '',
        Unidad1: this.camposIA?.Unidad1 ?? '',
        Unidad2: this.camposIA?.Unidad2 ?? '',
        Unidad3: this.camposIA?.Unidad3 ?? '',
        Unidad4: this.camposIA?.Unidad4 ?? '',
        LAprendizaje1: this.camposIA?.LAprendizaje1 ?? '',
        LAprendizaje2: this.camposIA?.LAprendizaje2 ?? '',
        LAprendizaje3: this.camposIA?.LAprendizaje3 ?? '',
        LAprendizaje4: this.camposIA?.LAprendizaje4 ?? '',

        ...horas,

        Foto: 'Foto',
        Anexos1: 'Anexos1',
        Anexos2: 'Anexos2',
        Anexos3: 'Anexos3'
      });

      const out = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // Guarda el registro SOLO si es la primera vez que se genera
      if (!esRegeneracion) {
        this.estadoGeneracion = 'Guardando registro en la base de datos...';
        try {
          const ahora = new Date();
          const datosGuardado: RegistroPlanificacion = {
            codigo: codigoAUsar,
            anio: anioTexto,
            mes: mesTexto,
            capacitacionSlug: cap.slug,
            capacitacion: cap.capacitacion,
            carrera: cap.textoCarrera,
            fechaCreacion: `${this.formatearFechaCorta(ahora)} ${this.formatearHora(ahora)}`
          };

          await this.planificacionService.guardarRegistro(datosGuardado);
          this.registroExistente = datosGuardado;
        } catch (dbError) {
          console.error('Error al guardar el registro en la base de datos:', dbError);
          alert('El informe se generó, pero no se pudo guardar el registro en la base de datos.');
        }
      }

      const nombreArchivo = `${codigoAUsar}-${cap.capacitacion || 'Planificacion'}.docx`
        .replace(/[\\/:*?"<>|]/g, '-');

      saveAs(out, nombreArchivo);

    } catch (error: any) {
      console.error('Error al generar el informe:', error);
      alert(error?.message ?? 'Ocurrió un error al generar el informe.');
    } finally {
      this.generando = false;
      this.estadoGeneracion = '';
    }
  }
}