import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get, off, onValue, ref, update } from 'firebase/database';

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { dbDocente } from '../../../../../firebase/firebase-docente';

type TipoDocumento = 'patrocinio' | 'plan' | 'seguimiento' | 'sinFormación';

interface HistorialRegistro {
  id: string;
  tipo: TipoDocumento;
  tipoLabel: string;
  cedula: string;
  docente: string;
  carrera: string;
  codigo: string;
  fechaGuardado: string;
  timestamp: number;
  datosDocumento: any | null;
  entregado: boolean;
  rutaDb: string;
  actualizandoEstado?: boolean;
}

interface GenStep {
  id: string;
  txt: string;
  pct: number;
}

// Configuración de reintentos automáticos
const RETRY_CONFIG = {
  maxIntentos: 3,
  delayBase: 4000,
  delayMax: 15000,
  multiplicador: 2
};

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial.html',
  styleUrl: './historial.css'
})
export class Historial implements OnInit, OnDestroy {
  cargando = true;
  mensaje = '';
  modalObservacionAbierto = false;
  observacionSeleccionada = '';
  filtroTexto = '';
  filtroTipo: 'todos' | TipoDocumento = 'todos';
  registros: HistorialRegistro[] = [];

  // Animación generación
  mostrandoAnimacion = false;
  genProgressPct = 0;
  genProgressTxt = 'Iniciando…';
  genSubtitulo = 'Por favor espere, esto puede tomar unos segundos…';
  genFooterTxt = 'La conversión puede tardar hasta 30 segundos en servidores gratuitos';
  mostrandoReintento = false;
  reintentoTexto = '';

  // Modal de éxito
  modalExitoAbierto = false;
  exitoCodigo = '';
  exitoNombre = '';
  exitoFecha = '';
  private _ultimoItemDescargado: HistorialRegistro | null = null;

  readonly GEN_STEPS: GenStep[] = [
    { id: 'gstep1', txt: 'Validando datos…', pct: 10 },
    { id: 'gstep2', txt: 'Consultando base de datos…', pct: 28 },
    { id: 'gstep3', txt: 'Generando código del plan…', pct: 46 },
    { id: 'gstep4', txt: 'Construyendo documento…', pct: 64 },
    { id: 'gstep5', txt: 'Convirtiendo a PDF…', pct: 82 },
    { id: 'gstep6', txt: 'Descargando…', pct: 95 }
  ];

  stepStates: Record<string, 'idle' | 'active' | 'done'> = {};

  private _genTimer: any = null;
  private readonly API_BASE = 'https://backen-pdf-trabajo.onrender.com';

  private refPatrocinio = ref(dbDocente, 'patrociniosGenerados');
  private refPlan = ref(dbDocente, 'planesGenerados');
  private refSeguimiento = ref(dbDocente, 'seguimientoGenerados');
  private refDocentesSinFormacion = ref(dbDocente, 'docentesSinFormacion');

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.cargarHistorial();
    this.escucharCambios();
    this.resetStepStates();
  }

  ngOnDestroy(): void {
    off(this.refPatrocinio);
    off(this.refPlan);
    off(this.refSeguimiento);
    off(this.refDocentesSinFormacion);
    clearTimeout(this._genTimer);
  }

  // ─────────────────────────────────────────────
  // ANIMACIÓN DE GENERACIÓN
  // ─────────────────────────────────────────────
  private resetStepStates(): void {
    this.GEN_STEPS.forEach(s => (this.stepStates[s.id] = 'idle'));
  }

  mostrarAnimacionGenerando(): void {
    clearTimeout(this._genTimer);
    this.resetStepStates();
    this.genProgressPct = 0;
    this.genProgressTxt = 'Iniciando…';
    this.genSubtitulo = 'Por favor espere, esto puede tomar unos segundos…';
    this.genFooterTxt = 'La conversión puede tardar hasta 30 segundos en servidores gratuitos';
    this.mostrandoReintento = false;
    this.reintentoTexto = '';
    this.mostrandoAnimacion = true;
    this.cdr.detectChanges();

    let idx = 0;
    const avanzar = () => {
      if (idx > 0) {
        this.stepStates[this.GEN_STEPS[idx - 1].id] = 'done';
      }
      if (idx < this.GEN_STEPS.length) {
        const cur = this.GEN_STEPS[idx];
        this.stepStates[cur.id] = 'active';
        this.genProgressPct = cur.pct;
        this.genProgressTxt = cur.txt;
        this.cdr.detectChanges();
        idx++;
        this._genTimer = setTimeout(avanzar, idx < this.GEN_STEPS.length ? 1800 : 2200);
      }
    };
    avanzar();
  }

  private actualizarMensajeReintento(intento: number, maxIntentos: number): void {
    this.mostrandoReintento = true;
    this.reintentoTexto = `Reintento ${intento} de ${maxIntentos} — reconectando con el servidor…`;
    // Reactivar step 5 (Convirtiendo a PDF)
    this.stepStates['gstep5'] = 'active';
    this.genProgressPct = 82;
    this.genProgressTxt = `Reintentando conversión a PDF (intento ${intento}/${maxIntentos})…`;
    this.cdr.detectChanges();
  }

  private actualizarMensajeEsperando(intento: number, maxIntentos: number, segundos: number): void {
    this.genSubtitulo = `Esperando ${segundos}s antes del reintento ${intento + 1} de ${maxIntentos}…`;
    this.genFooterTxt = 'El servidor puede estar iniciando — los reintentos automáticos garantizan la descarga';
    this.genProgressTxt = `Servidor respondiendo lento, reintentando en ${segundos}s…`;
    this.cdr.detectChanges();
  }

  ocultarAnimacionGenerando(exito: boolean): void {
    clearTimeout(this._genTimer);
    this.mostrandoReintento = false;

    if (exito) {
      this.genProgressPct = 100;
      this.genProgressTxt = '¡Documento listo!';
      this.GEN_STEPS.forEach(s => (this.stepStates[s.id] = 'done'));
      this.cdr.detectChanges();
      setTimeout(() => {
        this.mostrandoAnimacion = false;
        this.cdr.detectChanges();
      }, 700);
    } else {
      this.mostrandoAnimacion = false;
      this.cdr.detectChanges();
    }
  }

  // ─────────────────────────────────────────────
  // MODAL DE ÉXITO
  // ─────────────────────────────────────────────
  private abrirModalExito(item: HistorialRegistro): void {
    const ahora = new Date();
    this.exitoCodigo = item.codigo || '---';
    this.exitoNombre = item.docente || '---';
    this.exitoFecha = ahora.toLocaleDateString('es-EC') + ' · ' +
      ahora.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    this._ultimoItemDescargado = item;
    this.modalExitoAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalExito(): void {
    this.modalExitoAbierto = false;
    this._ultimoItemDescargado = null;
    this.cdr.detectChanges();
  }

  async reDescargarDesdeExito(): Promise<void> {
    const item = this._ultimoItemDescargado;
    this.cerrarModalExito();
    if (item) {
      await this.descargarDocumento(item);
    }
  }

  // ─────────────────────────────────────────────
  // MODAL DE OBSERVACIÓN
  // ─────────────────────────────────────────────
  abrirModalObservacion(texto: string): void {
    this.observacionSeleccionada = texto || 'Sin observación';
    this.modalObservacionAbierto = true;
  }

  cerrarModalObservacion(): void {
    this.modalObservacionAbierto = false;
    this.observacionSeleccionada = '';
  }

  // ─────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────
  private formatoFecha(fechaISO: string): string {
    if (!fechaISO) return '';
    const p = String(fechaISO).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fechaISO;
  }

  private limpiarNombreArchivo(texto: string): string {
    return String(texto || '')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizarTexto(texto: string): string {
    return String(texto || '').trim().toLowerCase();
  }

  private esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─────────────────────────────────────────────
  // IMAGEN
  // ─────────────────────────────────────────────
  private async obtenerImagenSeguimiento(url?: string | null): Promise<{ bytes: Uint8Array; ok: boolean }> {
    if (!url) return { bytes: this.imagenPlaceholder1x1(), ok: false };
    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
      if (!response.ok) return { bytes: this.imagenPlaceholder1x1(), ok: false };
      const blob = await response.blob();
      const bytesJpg = await this.convertirImagenAJpegBytes(blob);
      if (!bytesJpg || bytesJpg.length < 8) return { bytes: this.imagenPlaceholder1x1(), ok: false };
      return { bytes: bytesJpg, ok: true };
    } catch {
      return { bytes: this.imagenPlaceholder1x1(), ok: false };
    }
  }

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

  private imagenPlaceholder1x1(): Uint8Array {
    return new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
  }

  // ─────────────────────────────────────────────
  // RECONSTRUIR DATA SEGUIMIENTO
  // ─────────────────────────────────────────────
  private reconstruirDataSeguimiento(registro: HistorialRegistro, imagenBytes: Uint8Array, tieneFoto: boolean): any {
    const dd = registro.datosDocumento || {};
    const formacion = String(dd.formacion || '').trim();
    const modalidad = String(dd.modalidad || '').trim();
    const financ = String(dd.financiamiento || '').trim();
    const tipoApoyo = String(dd.tipoApoyo || '').trim();
    const acuerdo = String(dd.acuerdoPatrocinio || 'Si').trim();
    const avance = String(dd.avance || '0%');
    const restante = String(dd.restante || '100%');

    let fechaActual = String(dd.fechaActual || registro.fechaGuardado || '');
    if (fechaActual && fechaActual.includes('-') && !fechaActual.includes('/')) {
      fechaActual = this.formatoFecha(fechaActual);
    }

    let Finicio = String(dd.Finicio || dd.Einicio || dd._Einicio || '');
    let Ffin = String(dd.Ffin || dd.Efin || dd._Efin || '');
    if (Finicio && Finicio.includes('-') && !Finicio.includes('/')) Finicio = this.formatoFecha(Finicio);
    if (Ffin && Ffin.includes('-') && !Ffin.includes('/')) Ffin = this.formatoFecha(Ffin);

    return {
      Codigo: String(dd.Codigo || registro.codigo || ''),
      NombresC: String(dd.NombresC || registro.docente || ''),
      Cedula1: String(dd.Cedula1 || registro.cedula || ''),
      Carrera1: String(dd.Carrera1 || registro.carrera || ''),
      Titulo: String(dd.Titulo || ''),
      Tecnologia: formacion === 'Tecnología Universitaria',
      Licenciatura: formacion === 'Licenciatura',
      Ingenieria: formacion === 'Ingeniería',
      Maestria: formacion === 'Maestría',
      Doctorado: formacion === 'Doctorado',
      CarreraCursando: String(dd.CarreraCursando || registro.carrera || ''),
      instituacion: String(dd.instituacion || ''),
      Presencial: modalidad === 'Presencial',
      Virtual: modalidad === 'Virtual',
      Hibrida: modalidad === 'Híbrida',
      Finicio,
      Ffin,
      Total: financ === 'Total',
      Parcial: financ === 'Parcial',
      NoAplica: financ === 'No aplica',
      Si: acuerdo === 'Si',
      No: acuerdo === 'No',
      Economico: tipoApoyo === 'Economico',
      Tiempo: tipoApoyo === 'Tiempo',
      Tdos: String(dd.Tdos || ''),
      Estado: String(dd.Estado || ''),
      avance,
      restante,
      observaciones: String(dd.observaciones || ''),
      fechaActual,
      evidencia: String(dd.evidencia || ''),
      observaciones2: String(dd.observaciones2 || ''),
      añoActual: String(dd.añoActual || new Date().getFullYear()),
      image: imagenBytes,
      imageMeta: { esPlaceholder: !tieneFoto }
    };
  }

  // ─────────────────────────────────────────────
  // CAPACITACIONES DE CARRERA
  // ─────────────────────────────────────────────
  private async obtenerCapacitacionesDeCarrera(nombreCarrera: string): Promise<{
    capacitaciones: any[];
    teoria: string[];
    practica: string[];
  }> {
    try {
      const snapCarreras = await get(ref(dbDocente, 'carreras'));
      if (!snapCarreras.exists()) return { capacitaciones: [], teoria: [], practica: [] };

      let carreraData: any = null;
      snapCarreras.forEach((child) => {
        const d = child.val();
        if (this.normalizarTexto(d?.nombre) === this.normalizarTexto(nombreCarrera)) carreraData = d;
      });

      if (!carreraData?.capacitaciones) return { capacitaciones: [], teoria: [], practica: [] };

      const capsRaw = Object.entries(carreraData.capacitaciones as Record<string, any>)
        .map(([key, value]: [string, any]) => ({ key, ...value }))
        .filter((cap: any) => cap?.capacitacion)
        .sort((a: any, b: any) => Number(a.key) - Number(b.key));

      const capacitaciones = capsRaw.map((cap: any, index: number) => ({
        contador: index + 1,
        nombre: cap.capacitacion || '',
        horas: Number(cap.horas || 0),
        fechaInicio: this.formatoFecha(cap.fechaInicio || ''),
        fechaFin: this.formatoFecha(cap.fechaFin || ''),
        tipo: cap.tipo || 'Aprobación',
        estado: cap.estado || '-',
        fecha: this.construirRangoFechaTexto(cap.fechaInicio || '', cap.fechaFin || '')
      }));

      const teoriaSet = new Set<string>();
      const practicaSet = new Set<string>();
      capsRaw.forEach((cap: any) => {
        (Array.isArray(cap.teoriaTemas) ? cap.teoriaTemas : []).forEach((t: any) => { const s = String(t?.titulo || '').trim(); if (s) teoriaSet.add(s); });
        (Array.isArray(cap.practicaTemas) ? cap.practicaTemas : []).forEach((t: any) => { const s = String(t?.titulo || '').trim(); if (s) practicaSet.add(s); });
      });

      return { capacitaciones, teoria: Array.from(teoriaSet), practica: Array.from(practicaSet) };
    } catch {
      return { capacitaciones: [], teoria: [], practica: [] };
    }
  }

  private construirRangoFechaTexto(fechaInicio: string, fechaFin: string): string {
    const inicio = this.formatearFechaLarga(fechaInicio);
    const fin = this.formatearFechaLarga(fechaFin);
    if (inicio && fin) return `desde el ${inicio} hasta el ${fin}`;
    if (inicio) return `desde el ${inicio}`;
    if (fin) return `hasta el ${fin}`;
    return '';
  }

  private formatearFechaLarga(fechaISO: string): string {
    if (!fechaISO) return '';
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const partes = String(fechaISO).split('-');
    if (partes.length !== 3) return '';
    const anio = partes[0];
    const mes = meses[Number(partes[1]) - 1] || '';
    const dia = Number(partes[2]);
    if (!anio || !mes || !dia) return '';
    return `${dia} de ${mes} de ${anio}`;
  }

  // ─────────────────────────────────────────────
  // HISTORIAL — ESCUCHAR Y CARGAR
  // ─────────────────────────────────────────────
  escucharCambios(): void {
    onValue(this.refPatrocinio, () => this.cargarHistorial());
    onValue(this.refPlan, () => this.cargarHistorial());
    onValue(this.refSeguimiento, () => this.cargarHistorial());
    onValue(this.refDocentesSinFormacion, () => this.cargarHistorial());
  }

  async cargarHistorial(): Promise<void> {
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const [snapPat, snapPlan, snapSeg, snapSinFormacion] = await Promise.all([
        get(this.refPatrocinio),
        get(this.refPlan),
        get(this.refSeguimiento),
        get(this.refDocentesSinFormacion),
      ]);

      const registros: HistorialRegistro[] = [];

      // ── Patrocinios ──
      if (snapPat.exists()) {
        snapPat.forEach((snapCedula) => {
          const cedulaKey = snapCedula.key || '';
          snapCedula.forEach((snapDoc) => {
            const data = snapDoc.val() || {};
            const nombreDocente = data.docente || data.nombre || data.NombresC || '';
            const carrera = data.carrera || data.Carrera1 || '';
            const cedula = data.cedula || data.Cedula1 || cedulaKey;
            const codigo = data.codigo || data.Codigo || '';

            registros.push({
              id: `${cedulaKey}_${snapDoc.key}`,
              tipo: 'patrocinio',
              tipoLabel: 'Patrocinio',
              cedula,
              docente: nombreDocente,
              carrera,
              codigo,
              fechaGuardado: data.fechaGuardado || data.fecha || '',
              timestamp: Number(data.timestamp || 0),
              datosDocumento: {
                NombresC: nombreDocente,
                Carrera1: carrera,
                Cedula1: cedula,
                NombreCA: data.capacitacion || data.NombreCA || '',
                Codigo: codigo,
                Fecha1: data.fechaTexto || data.fecha || data.Fecha1 || ''
              },
              entregado: Boolean(data.entregado),
              rutaDb: `patrociniosGenerados/${cedulaKey}/${snapDoc.key}`,
              actualizandoEstado: false
            });
          });
        });
      }

      // ── Planes ──
      if (snapPlan.exists()) {
        snapPlan.forEach((snapCedula) => {
          const cedulaKey = snapCedula.key || '';
          snapCedula.forEach((snapDoc) => {
            const data = snapDoc.val() || {};
            const nombreDocente = data.docente || data.nombre || data.NombresC || '';
            const carreraDoc = data.carrera || data.CarreraDocente || '';
            const cedula = data.cedula || cedulaKey;
            const codigo = data.codigo || data.Codigo || '';

            registros.push({
              id: `${cedulaKey}_${snapDoc.key}`,
              tipo: 'plan',
              tipoLabel: 'Plan Individual',
              cedula,
              docente: nombreDocente,
              carrera: carreraDoc,
              codigo,
              fechaGuardado: data.fechaGuardado || data.fecha || '',
              timestamp: Number(data.timestamp || 0),
              datosDocumento: {
                Codigo: codigo,
                NombresC: nombreDocente,
                Nombresc: nombreDocente,
                CarreraDocente: carreraDoc,
                Carreradocente: carreraDoc,
                Respuesta1: data.respuesta1 || '',
                Respuesta2: data.respuesta2 || '',
                Respuesta3: data.respuesta3 || '',
                Respuesta4: data.respuesta4 || '',
                Respuesta5: data.respuesta5 || '',
                Respuesta6: data.respuesta6 || '',
                Respuesta7: data.respuesta7 || '',
                Respuesta8: data.respuesta8 || '',
                capacitaciones: [],
                Teoria: [],
                Practica: [],
                NombreFormacionEspecifica: data.nombreFormacionEspecifica || '',
                NivelFormacionEspecifica: data.nivelFormacionEspecifica || '',
                FechaInicioE: this.formatoFecha(data.fechaInicioE || ''),
                FechaFinE: this.formatoFecha(data.fechaFinE || ''),
                NombreFormacionGenerica: data.nombreFormacionGenerica || '',
                NivelFormacionGenerica: data.nivelFormacionGenerica || '',
                FechaInicioG: this.formatoFecha(data.fechaInicioG || ''),
                FechaFinG: this.formatoFecha(data.fechaFinG || ''),
                'NombreFormaciónEspecifica': data.nombreFormacionEspecifica || '',
                'NivelFormaciónEspecifica': data.nivelFormacionEspecifica || '',
                'NombreFormaciónGenerica': data.nombreFormacionGenerica || '',
                'NivelFormaciónGenerica': data.nivelFormacionGenerica || '',
                _carreraNombre: carreraDoc
              },
              entregado: Boolean(data.entregado),
              rutaDb: `planesGenerados/${cedulaKey}/${snapDoc.key}`,
              actualizandoEstado: false
            });
          });
        });
      }

      // ── Seguimientos ──
      if (snapSeg.exists()) {
        snapSeg.forEach((snapDoc) => {
          const data = snapDoc.val() || {};
          const datosDoc = data.datosDocumento || {};

          const nombreDocente = data.nombre || data.docente || datosDoc.NombresC || datosDoc.Nombresc || '';
          const carrera = data.carrera || datosDoc.Carrera1 || datosDoc.CarreraCursando || '';
          const cedula = data.cedula || datosDoc.Cedula1 || '';
          const codigo = data.codigo || datosDoc.Codigo || '';
          const imagenURL = datosDoc.imagenURL || datosDoc.imageURL || data.imagenURL || data.imageURL || null;

          registros.push({
            id: snapDoc.key || '',
            tipo: 'seguimiento',
            tipoLabel: 'Seguimiento',
            cedula,
            docente: nombreDocente,
            carrera,
            codigo,
            fechaGuardado: data.fechaGuardado || data.fecha || datosDoc.fechaActual || '',
            timestamp: Number(data.timestamp || 0),
            datosDocumento: {
              ...datosDoc,
              Codigo: codigo,
              NombresC: nombreDocente,
              Cedula1: cedula,
              Carrera1: carrera,
              CarreraCursando: data.CarreraCursando || datosDoc.CarreraCursando || carrera,
              Einicio: data.Einicio || datosDoc.Einicio || '',
              Efin: data.Efin || datosDoc.Efin || '',
              _Einicio: data.Einicio || datosDoc.Einicio || '',
              _Efin: data.Efin || datosDoc.Efin || '',
              imagenURL
            },
            entregado: Boolean(data.entregado),
            rutaDb: `seguimientoGenerados/${snapDoc.key}`,
            actualizandoEstado: false
          });
        });
      }

      // ── Sin Formación ──
      if (snapSinFormacion.exists()) {
        snapSinFormacion.forEach((snapDoc) => {
          const data = snapDoc.val() || {};
          const cedula = data.cedula || '';
          const nombre = data.nombre || '';
          const carrera = data.carrera || '';
          const anio = data.anio || '';
          const mes = data.mes || '';

          registros.push({
            id: snapDoc.key || `${cedula}_${anio}_${mes}`,
            tipo: 'sinFormación',
            tipoLabel: 'Sin Formación',
            cedula,
            docente: nombre,
            carrera,
            codigo: 'SIN FORMACIÓN',
            fechaGuardado: data.fecha || '',
            timestamp: data.registradoEn ? new Date(data.registradoEn).getTime() : 0,
            datosDocumento: {
              cedula, nombre, carrera, anio, mes,
              fecha: data.fecha || '',
              hora: data.hora || '',
              observacion: data.observacion || '',
              titulo: data.titulo || '',
              enProcesoFormacion: Boolean(data.enProcesoFormacion)
            },
            entregado: Boolean(data.entregado),
            rutaDb: `docentesSinFormacion/${snapDoc.key}`,
            actualizandoEstado: false
          });
        });
      }

      this.registros = registros.sort((a, b) => {
        const ta = Number(a.timestamp || 0);
        const tb = Number(b.timestamp || 0);
        if (tb !== ta) return tb - ta;
        return String(b.codigo || '').localeCompare(String(a.codigo || ''));
      });

    } catch (error) {
      console.error('Error cargando historial:', error);
      this.mostrarMensaje('❌ Error al cargar el historial');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // ─────────────────────────────────────────────
  // FILTROS
  // ─────────────────────────────────────────────
  get registrosFiltrados(): HistorialRegistro[] {
    const texto = this.filtroTexto.trim().toLowerCase();
    return this.registros.filter((r) => {
      const cumpleTipo =
        this.filtroTipo === 'todos'
          ? r.tipo !== 'sinFormación'
          : r.tipo === this.filtroTipo;
      const cumpleTexto =
        !texto ||
        String(r.cedula || '').toLowerCase().includes(texto) ||
        String(r.docente || '').toLowerCase().includes(texto) ||
        String(r.carrera || '').toLowerCase().includes(texto) ||
        String(r.codigo || '').toLowerCase().includes(texto);
      return cumpleTipo && cumpleTexto;
    });
  }

  cambiarFiltro(tipo: 'todos' | TipoDocumento): void {
    this.filtroTipo = tipo;
  }

  contarPorTipo(tipo: TipoDocumento): number {
    return this.registros.filter((r) => r.tipo === tipo).length;
  }

  obtenerClaseTipo(tipo: TipoDocumento): string {
    if (tipo === 'patrocinio') return 'tag-patrocinio';
    if (tipo === 'plan') return 'tag-plan';
    if (tipo === 'seguimiento') return 'tag-seguimiento';
    return 'tag-sin-formacion';
  }

  // ─────────────────────────────────────────────
  // CAMBIAR ESTADO ENTREGA
  // ─────────────────────────────────────────────
  async cambiarEstadoEntrega(item: HistorialRegistro, nuevoEstado: boolean): Promise<void> {
    if (item.actualizandoEstado || item.entregado === nuevoEstado) return;
    item.actualizandoEstado = true;
    this.cdr.detectChanges();
    try {
      await update(ref(dbDocente, item.rutaDb), { entregado: nuevoEstado });
      item.entregado = nuevoEstado;
      this.mostrarMensaje(nuevoEstado ? '✅ Documento marcado como entregado' : '✅ Documento marcado como pendiente');
    } catch {
      this.mostrarMensaje('❌ No se pudo actualizar el estado');
    } finally {
      item.actualizandoEstado = false;
      this.cdr.detectChanges();
    }
  }

  // ─────────────────────────────────────────────
  // DESCARGAR DOCUMENTO
  // ─────────────────────────────────────────────
  async descargarDocumento(item: HistorialRegistro): Promise<void> {
    if (!item.datosDocumento) {
      this.mostrarMensaje('⚠️ Este registro no tiene datos suficientes para regenerar el documento');
      return;
    }

    if (item.tipo === 'sinFormación') {
      this.mostrarMensaje('⚠️ Este registro no tiene documento para descargar');
      return;
    }

    this.mostrarAnimacionGenerando();

    try {
      const plantillas: Record<TipoDocumento, string> = {
        patrocinio: 'assets/docs/patrocinio.docx',
        plan: 'assets/docs/individual.docx',
        seguimiento: 'assets/docs/seguimiento.docx',
        sinFormación: ''
      };

      let dataFinal = { ...item.datosDocumento };

      if (item.tipo === 'plan') {
        const carreraNombre = dataFinal._carreraNombre || dataFinal.CarreraDocente || item.carrera || '';
        if (carreraNombre) {
          const { capacitaciones, teoria, practica } = await this.obtenerCapacitacionesDeCarrera(carreraNombre);
          dataFinal = { ...dataFinal, capacitaciones, Teoria: teoria, Practica: practica };
        }
        delete dataFinal['_carreraNombre'];
        await this.generarPdfDesdePlantilla(plantillas[item.tipo], dataFinal, item);

      } else if (item.tipo === 'seguimiento') {
        const imagenURL = dataFinal.imagenURL || dataFinal.imageURL || dataFinal.ImagenURL || dataFinal.imagen || null;
        const resultado = await this.obtenerImagenSeguimiento(imagenURL);
        dataFinal = this.reconstruirDataSeguimiento(item, resultado.bytes, resultado.ok);
        await this.generarPdfDesdePlantilla(plantillas[item.tipo], dataFinal, item);

      } else {
        await this.generarPdfDesdePlantilla(plantillas[item.tipo], dataFinal, item);
      }

      this.ocultarAnimacionGenerando(true);
      // Mostrar modal de éxito
      this.abrirModalExito(item);

    } catch (error: any) {
      this.ocultarAnimacionGenerando(false);
      console.error('Error descargando PDF:', error);
      this.mostrarMensaje(error?.message || '❌ No se pudo descargar el PDF. Use el botón Re-descargar para intentarlo nuevamente.');
    }
  }

  // ─────────────────────────────────────────────
  // GENERAR PDF DESDE PLANTILLA
  // ─────────────────────────────────────────────
  private async generarPdfDesdePlantilla(rutaPlantilla: string, data: any, item: HistorialRegistro): Promise<void> {
    const response = await fetch(rutaPlantilla);
    if (!response.ok) throw new Error(`No se pudo cargar la plantilla: ${rutaPlantilla}`);

    const content = await response.arrayBuffer();
    const bytes = new Uint8Array(content.slice(0, 8));
    if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error(`La plantilla no es un .docx válido: ${rutaPlantilla}`);

    const zip = new PizZip(content);
    const dataFinal = { ...data };
    const modules: any[] = [];

    if (item.tipo === 'seguimiento') {
      const ImageModuleImport: any = await import('docxtemplater-image-module-free');
      const ImageModule = ImageModuleImport.default || ImageModuleImport;

      const imagenBytes: Uint8Array = dataFinal.image instanceof Uint8Array
        ? dataFinal.image : this.imagenPlaceholder1x1();

      const esPlaceholder: boolean = dataFinal.imageMeta?.esPlaceholder === true;
      const bytesFinales: Uint8Array = imagenBytes instanceof Uint8Array && imagenBytes.length >= 8
        ? imagenBytes : this.imagenPlaceholder1x1();

      modules.push(new ImageModule({
        centered: true,
        getImage: (_tagValue: string) => bytesFinales,
        getSize: (_img: Uint8Array, _tagValue: string) => esPlaceholder ? [1, 1] : [480, 320]
      }));

      dataFinal['image'] = 'ok';
    }

    const doc = new Docxtemplater(zip, { modules, paragraphLoop: true, linebreaks: true });
    try {
      doc.render(dataFinal);
    } catch (error: any) {
      throw new Error('Error en la plantilla Word. Revisa las variables {{ }} o {%image}.');
    }

    const blobDocx = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const nombreBase = this.limpiarNombreArchivo(`${item.codigo || 'documento'}-${item.docente || 'docente'}`);
    await this.convertirDocxAPdfConReintentos(blobDocx, nombreBase, item.tipo);
  }

  // ─────────────────────────────────────────────
  // CONVERTIR DOCX → PDF CON REINTENTOS AUTOMÁTICOS
  // ─────────────────────────────────────────────
  private async convertirDocxAPdfConReintentos(blobDocx: Blob, nombreBase: string, tipoDocumento: TipoDocumento): Promise<void> {
    const { maxIntentos, delayBase, delayMax, multiplicador } = RETRY_CONFIG;
    let ultimoError: Error | null = null;

    for (let intento = 1; intento <= maxIntentos; intento++) {
      try {
        if (intento > 1) {
          this.actualizarMensajeReintento(intento, maxIntentos);
        }

        const formData = new FormData();
        formData.append('file', blobDocx, `${nombreBase}.docx`);
        formData.append('tipo_documento', tipoDocumento);

        const response = await fetch(`${this.API_BASE}/convertir-pdf`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          let msg = `Error del servidor (${response.status})`;
          try { const err = await response.json(); msg = err.detail || msg; } catch { }
          throw new Error(msg);
        }

        const blobPdf = await response.blob();
        if (!blobPdf || blobPdf.size === 0) throw new Error('El servidor devolvió un PDF vacío');

        saveAs(blobPdf, `${nombreBase}.pdf`);
        return; // ✅ Éxito

      } catch (error: any) {
        ultimoError = error;
        console.warn(`Intento ${intento}/${maxIntentos} fallido:`, error.message);

        if (intento < maxIntentos) {
          const delay = Math.min(delayBase * Math.pow(multiplicador, intento - 1), delayMax);
          this.actualizarMensajeEsperando(intento, maxIntentos, Math.round(delay / 1000));
          await this.esperar(delay);
        }
      }
    }

    throw new Error(
      `No se pudo generar el PDF después de ${maxIntentos} intentos. ` +
      `Último error: ${ultimoError?.message || 'Error desconocido'}.`
    );
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  getStepLabel(index: number): string {
    const labels = [
      'Validando datos del formulario',
      'Consultando base de datos',
      'Generando código del plan',
      'Construyendo documento Word',
      'Convirtiendo a PDF',
      'Descargando documento'
    ];
    return labels[index] ?? '';
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    this.cdr.detectChanges();
    setTimeout(() => { this.mensaje = ''; this.cdr.detectChanges(); }, 5000);
  }
}