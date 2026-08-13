import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  InformeInstrumento as InformeInstrumentoService,
  RegistroInformeInstrumento
} from '../../../../services/informe-Instrumento/informe-instrumento'; // <-- ajusta esta ruta a la real
import {
  CapacitacionConDocentes,
  RegistroInformeFinal
} from '../../../../services/Informe-Final/informe-final'; // <-- ajusta esta ruta a la real

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-informe-instrumentos',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './informe-instrumentos.html',
  styleUrl: './informe-instrumentos.css'
})
export class InformeInstrumentos implements OnInit {

  // ==========================================
  // RUTA DE LA PLANTILLA A UTILIZAR
  // ==========================================
  private readonly RUTA_PLANTILLA = 'assets/planificacion/document-Instrumento/Informe-Instrumento.docx';

  constructor(private informeInstrumentoService: InformeInstrumentoService) { }

  // ==========================================
  // ESTADO GENERAL
  // ==========================================
  cargandoCapacitaciones = false;
  capacitaciones: CapacitacionConDocentes[] = [];
  capacitacionSeleccionada: CapacitacionConDocentes | null = null;

  // ==========================================
  // DATOS TOMADOS DEL INFORME FINAL YA GENERADO
  // ==========================================
  registroFinal: RegistroInformeFinal | null = null;
  cargandoRegistroFinal = false;

  // ==========================================
  // CAMPO MANUAL
  // ==========================================
  periodo: string = '';

  // ==========================================
  // CÓDIGO / REGISTRO DE ESTE INSTRUMENTO
  // ==========================================
  codigoDocumento: string = '';
  registroExistente: RegistroInformeInstrumento | null = null;

  // ==========================================
  // GENERACIÓN
  // ==========================================
  generando = false;
  estadoGeneracion = '';

  fechaFin: string = '';

  async ngOnInit(): Promise<void> {
    await this.cargarCapacitaciones();
  }

  // ==========================================
  // CARGA TODAS LAS CAPACITACIONES CON SUS DOCENTES
  // (misma fuente que informe final: patrociniosGenerados)
  // ==========================================
  async cargarCapacitaciones(): Promise<void> {
    this.cargandoCapacitaciones = true;
    try {
      this.capacitaciones = await this.informeInstrumentoService.obtenerCapacitacionesConDocentes();
    } catch (error) {
      console.error('Error al cargar capacitaciones:', error);
      alert('No se pudieron cargar las capacitaciones.');
    } finally {
      this.cargandoCapacitaciones = false;
    }
  }

  // ==========================================
  // SELECCIONAR CAPACITACIÓN
  // Trae el registro del informe final ya generado (facilitador,
  // fechas, Tdocentes, TAprobados, TReprobados) y verifica si ya
  // existe un instrumento generado para esta capacitación.
  // ==========================================
  async seleccionarCapacitacion(slug: string): Promise<void> {
    this.capacitacionSeleccionada = this.capacitaciones.find(c => c.slug === slug) ?? null;
    this.registroFinal = null;
    this.registroExistente = null;
    this.periodo = '';
    this.codigoDocumento = '';
    this.fechaFin = '';

    if (!this.capacitacionSeleccionada) return;

    this.cargandoRegistroFinal = true;
    try {
      this.registroFinal = await this.informeInstrumentoService.obtenerRegistroInformeFinal(
        this.capacitacionSeleccionada.slug
      );

      if (!this.registroFinal) {
        alert(
          'Esta capacitación aún no tiene un Informe Final generado. ' +
          'Debe generar primero el Informe Final antes de crear el instrumento.'
        );
        return;
      }

      // Trae la fecha de fin real de la capacitación (para usarla como
      // fecha de elaboración del instrumento)
      const fechas = await this.informeInstrumentoService.obtenerFechasCapacitacion(
        this.capacitacionSeleccionada.capacitacion,
        this.capacitacionSeleccionada.carrera
      );
      if (fechas) {
        this.fechaFin = fechas.fechaFin;
      }

      this.registroExistente = await this.informeInstrumentoService.obtenerRegistroInstrumentoPorSlug(
        this.capacitacionSeleccionada.slug
      );

      if (this.registroExistente) {
        // Precarga el período ya guardado en vez de dejarlo vacío,
        // para que al re-descargar se vea el mismo valor usado antes.
        this.periodo = this.registroExistente.periodo ?? '';
        this.codigoDocumento = this.registroExistente.codigo;
      }
    } catch (error) {
      console.error('Error al verificar el informe final / instrumento:', error);
    } finally {
      this.cargandoRegistroFinal = false;
    }
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

  private formatearFechaLarga(fecha: string | Date): string {
    const d = typeof fecha === 'string' ? new Date(fecha + 'T00:00:00') : fecha;
    return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ==========================================
  // GENERAR INSTRUMENTO
  // ==========================================
  async generarInstrumento(): Promise<void> {
    if (!this.capacitacionSeleccionada) {
      alert('Seleccione una capacitación.');
      return;
    }
    if (!this.registroFinal) {
      alert('Esta capacitación no tiene Informe Final generado.');
      return;
    }
    if (!this.periodo.trim()) {
      alert('Debe indicar el período de la capacitación.');
      return;
    } if (!this.fechaFin) {
      alert('No se encontró la fecha de fin de la capacitación. Verifique la planificación.');
      return;
    }

    this.generando = true;

    try {
      const cap = this.capacitacionSeleccionada;
      const registroFinal = this.registroFinal;
      let codigoAUsar: string;
      let anioTexto: string;
      let mesTexto: string;
      let notaAleatoria: number;
      const esRegeneracion = !!this.registroExistente;

      if (esRegeneracion) {
        // Ya existe instrumento para esta capacitación: se reutiliza
        // el mismo código y la misma nota aleatoria, sin crear registro nuevo.
        codigoAUsar = this.registroExistente!.codigo;
        anioTexto = this.registroExistente!.anio;
        mesTexto = this.registroExistente!.mes;
        notaAleatoria = this.registroExistente!.notaAleatoria;
        this.codigoDocumento = codigoAUsar;
        // Respalda el período con el guardado en BD por si el input
        // quedó vacío o se perdió el estado al navegar.
        this.periodo = this.registroExistente!.periodo || this.periodo;
      } else {
        this.estadoGeneracion = 'Generando código del documento...';
        // Reutiliza el mismo año-mes del informe final para mantener
        // consistencia, aunque el consecutivo (XX) es propio de este informe.
        anioTexto = registroFinal.anio;
        mesTexto = registroFinal.mes;

        const totalDelMes = await this.informeInstrumentoService.contarInstrumentosDelMes(anioTexto, mesTexto);
        const numeroCodigo = String(totalDelMes + 1).padStart(2, '0');
        codigoAUsar = `UGPA-RGI1-${numeroCodigo}-PRO-135-${anioTexto}-${mesTexto}`;
        this.codigoDocumento = codigoAUsar;

        notaAleatoria = this.informeInstrumentoService.generarNotaAleatoria();
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

      const doc = new Docxtemplater(zip, {
        delimiters: { start: '{{', end: '}}' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
      });

      const ahora = new Date();

      doc.render({
        Codigo: codigoAUsar,
        'capacitación': cap.capacitacion,
        carrera: cap.carrera,
        fecha: this.formatearFechaLarga(this.fechaFin),
        periodo: this.periodo,
        facilitador: registroFinal.facilitador,
        fechaF: this.formatearFechaLarga(this.fechaFin),
        docentes: cap.docentes.map((d, i) => ({
          contador: i + 1,
          nombre: d.nombre,
          cedula: d.cedula,
          genero: this.informeInstrumentoService.generoTexto(d.genero)
        })),
        Tdocentes: registroFinal.totalDocentes,
        TAprobados: registroFinal.totalAprobados,
        TReprobados: registroFinal.totalReprobados,
        aleatori: notaAleatoria
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
          const datosGuardado: RegistroInformeInstrumento = {
            codigo: codigoAUsar,
            anio: anioTexto,
            mes: mesTexto,
            capacitacionSlug: cap.slug,
            capacitacion: cap.capacitacion,
            carrera: cap.carrera,
            facilitador: registroFinal.facilitador,
            periodo: this.periodo,
            fechaCreacion: `${this.formatearFechaCorta(ahora)} ${this.formatearHora(ahora)}`,
            notaAleatoria: notaAleatoria,
            totalDocentes: registroFinal.totalDocentes,
            totalAprobados: registroFinal.totalAprobados,
            totalReprobados: registroFinal.totalReprobados
          };

          await this.informeInstrumentoService.guardarRegistroInstrumento(datosGuardado);
          this.registroExistente = datosGuardado;
        } catch (dbError) {
          console.error('Error al guardar el registro en la base de datos:', dbError);
          alert('El instrumento se generó, pero no se pudo guardar el registro en la base de datos.');
        }
      }

      const nombreArchivo = `${codigoAUsar}-${cap.capacitacion || 'InformeInstrumento'}.docx`
        .replace(/[\\/:*?"<>|]/g, '-');

      saveAs(out, nombreArchivo);

    } catch (error: any) {
      console.error('Error al generar el instrumento:', error);
      if (error?.properties?.errors?.length) {
        const mensajes = error.properties.errors
          .map((e: any, i: number) => `${i + 1}. ${e.properties?.explanation ?? e.message}`)
          .join('\n');
        alert(`Error(es) en la plantilla Word:\n\n${mensajes}`);
      } else {
        alert(error?.message ?? 'Ocurrió un error al generar el instrumento.');
      }
    } finally {
      this.generando = false;
      this.estadoGeneracion = '';
    }
  }
}