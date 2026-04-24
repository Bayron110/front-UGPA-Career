import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get, off, onValue, ref, update } from 'firebase/database';

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { dbDocente } from '../../../../../firebase/firebase-docente';

type TipoDocumento = 'patrocinio' | 'plan' | 'seguimiento';

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
  filtroTexto = '';
  filtroTipo: 'todos' | TipoDocumento = 'todos';
  registros: HistorialRegistro[] = [];

  // ── Animación generando ──
  mostrandoAnimacion = false;
  genProgressPct = 0;
  genProgressTxt = 'Iniciando…';

  readonly GEN_STEPS: GenStep[] = [
    { id: 'gstep1', txt: 'Validando datos…',             pct: 10 },
    { id: 'gstep2', txt: 'Consultando base de datos…',   pct: 28 },
    { id: 'gstep3', txt: 'Generando código del plan…',   pct: 46 },
    { id: 'gstep4', txt: 'Construyendo documento…',      pct: 64 },
    { id: 'gstep5', txt: 'Convirtiendo a PDF…',          pct: 82 },
    { id: 'gstep6', txt: 'Descargando…',                 pct: 95 }
  ];

  stepStates: Record<string, 'idle' | 'active' | 'done'> = {};

  private _genTimer: any = null;
  private readonly API_BASE = 'https://backen-pdf-trabajo.onrender.com';

  private refPatrocinio = ref(dbDocente, 'patrociniosGenerados');
  private refPlan       = ref(dbDocente, 'planesGenerados');
  private refSeguimiento = ref(dbDocente, 'seguimientoGenerados');

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarHistorial();
    this.escucharCambios();
    this.resetStepStates();
  }

  ngOnDestroy(): void {
    off(this.refPatrocinio);
    off(this.refPlan);
    off(this.refSeguimiento);
    clearTimeout(this._genTimer);
  }

  // ─────────────────────────────────────────────────────────
  // ANIMACIÓN GENERANDO
  // ─────────────────────────────────────────────────────────

  private resetStepStates(): void {
    this.GEN_STEPS.forEach(s => (this.stepStates[s.id] = 'idle'));
  }

  mostrarAnimacionGenerando(): void {
    clearTimeout(this._genTimer);
    this.resetStepStates();
    this.genProgressPct = 0;
    this.genProgressTxt = 'Iniciando…';
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

  ocultarAnimacionGenerando(exito: boolean): void {
    clearTimeout(this._genTimer);

    if (exito) {
      this.genProgressPct = 100;
      this.genProgressTxt = '¡Documento listo!';
      this.GEN_STEPS.forEach(s => (this.stepStates[s.id] = 'done'));
      this.cdr.detectChanges();

      setTimeout(() => {
        this.mostrandoAnimacion = false;
        this.cdr.detectChanges();
      }, 900);
    } else {
      this.mostrandoAnimacion = false;
      this.cdr.detectChanges();
    }
  }

  // ─────────────────────────────────────────────────────────
  // HISTORIAL
  // ─────────────────────────────────────────────────────────

  escucharCambios(): void {
    onValue(this.refPatrocinio, () => this.cargarHistorial());
    onValue(this.refPlan,       () => this.cargarHistorial());
    onValue(this.refSeguimiento,() => this.cargarHistorial());
  }

  async cargarHistorial(): Promise<void> {
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const [snapPat, snapPlan, snapSeg] = await Promise.all([
        get(this.refPatrocinio),
        get(this.refPlan),
        get(this.refSeguimiento)
      ]);

      const registros: HistorialRegistro[] = [];

      if (snapPat.exists()) {
        snapPat.forEach((snapCedula) => {
          const cedulaKey = snapCedula.key || '';
          snapCedula.forEach((snapDoc) => {
            const data = snapDoc.val() || {};
            const nombreDocente =
              data.docente || data.nombre || data.NombresC ||
              data.datosDocumento?.NombresC || '';

            const dataDoc = {
              NombresC: nombreDocente,
              Carrera1: data.carrera || data.Carrera1 || data.datosDocumento?.Carrera1 || '',
              Cedula1:  data.cedula  || data.Cedula1  || data.datosDocumento?.Cedula1  || cedulaKey,
              NombreCA: data.capacitacion || data.NombreCA || '',
              Codigo:   data.codigo || data.Codigo || data.datosDocumento?.Codigo || '',
              Fecha1:   data.fecha  || data.fechaTexto || data.Fecha1 || ''
            };

            registros.push({
              id: `${cedulaKey}_${snapDoc.key}`,
              tipo: 'patrocinio',
              tipoLabel: 'Patrocinio',
              cedula: data.cedula || data.Cedula1 || cedulaKey,
              docente: nombreDocente,
              carrera: data.carrera || data.Carrera1 || data.datosDocumento?.Carrera1 || '',
              codigo:  data.codigo  || data.Codigo  || data.datosDocumento?.Codigo  || '',
              fechaGuardado: data.fechaGuardado || data.fecha || '',
              timestamp: Number(data.timestamp || 0),
              datosDocumento: dataDoc,
              entregado: Boolean(data.entregado),
              rutaDb: `patrociniosGenerados/${cedulaKey}/${snapDoc.key}`,
              actualizandoEstado: false
            });
          });
        });
      }

      if (snapPlan.exists()) {
        snapPlan.forEach((snapCedula) => {
          const cedulaKey = snapCedula.key || '';
          snapCedula.forEach((snapDoc) => {
            const data = snapDoc.val() || {};
            const nombreDocente =
              data.docente || data.nombre || data.NombresC ||
              data.datosDocumento?.NombresC || data.datosDocumento?.Nombresc || '';
            const carreraDocente =
              data.carrera || data.CarreraDocente ||
              data.datosDocumento?.CarreraDocente || data.datosDocumento?.Carreradocente || '';

            const dataDoc = {
              Codigo: data.codigo || data.Codigo || data.datosDocumento?.Codigo || '',
              NombresC: nombreDocente,
              Nombresc: nombreDocente,
              CarreraDocente: carreraDocente,
              Carreradocente: carreraDocente,
              Respuesta1: data.respuesta1 || data.datosDocumento?.Respuesta1 || '',
              Respuesta2: data.respuesta2 || data.datosDocumento?.Respuesta2 || '',
              Respuesta3: data.respuesta3 || data.datosDocumento?.Respuesta3 || '',
              Respuesta4: data.respuesta4 || data.datosDocumento?.Respuesta4 || '',
              Respuesta5: data.respuesta5 || data.datosDocumento?.Respuesta5 || '',
              Respuesta6: data.respuesta6 || data.datosDocumento?.Respuesta6 || '',
              Respuesta7: data.respuesta7 || data.datosDocumento?.Respuesta7 || '',
              Respuesta8: data.respuesta8 || data.datosDocumento?.Respuesta8 || '',
              capacitaciones: data.datosDocumento?.capacitaciones || [],
              Teoria: data.datosDocumento?.Teoria || [],
              Practica: data.datosDocumento?.Practica || [],
              NombreFormacionEspecifica:
                data.nombreFormacionEspecifica || data.datosDocumento?.NombreFormacionEspecifica || '',
              NivelFormacionEspecifica:
                data.nivelFormacionEspecifica  || data.datosDocumento?.NivelFormacionEspecifica  || '',
              FechaInicioE: this.formatoFecha(data.fechaInicioE || data.datosDocumento?.FechaInicioE || ''),
              FechaFinE:    this.formatoFecha(data.fechaFinE    || data.datosDocumento?.FechaFinE    || ''),
              NombreFormacionGenerica:
                data.nombreFormacionGenerica || data.datosDocumento?.NombreFormacionGenerica || '',
              NivelFormacionGenerica:
                data.nivelFormacionGenerica  || data.datosDocumento?.NivelFormacionGenerica  || '',
              FechaInicioG: this.formatoFecha(data.fechaInicioG || data.datosDocumento?.FechaInicioG || ''),
              FechaFinG:    this.formatoFecha(data.fechaFinG    || data.datosDocumento?.FechaFinG    || ''),
              'NombreFormaciónEspecifica':
                data.nombreFormacionEspecifica || data.datosDocumento?.NombreFormacionEspecifica || '',
              'NivelFormaciónEspecifica':
                data.nivelFormacionEspecifica  || data.datosDocumento?.NivelFormacionEspecifica  || '',
              'NombreFormaciónGenerica':
                data.nombreFormacionGenerica || data.datosDocumento?.NombreFormacionGenerica || '',
              'NivelFormaciónGenerica':
                data.nivelFormacionGenerica  || data.datosDocumento?.NivelFormacionGenerica  || ''
            };

            registros.push({
              id: `${cedulaKey}_${snapDoc.key}`,
              tipo: 'plan',
              tipoLabel: 'Plan Individual',
              cedula: data.cedula || data.Cedula1 || cedulaKey,
              docente: nombreDocente,
              carrera: carreraDocente,
              codigo:  data.codigo || data.Codigo || data.datosDocumento?.Codigo || '',
              fechaGuardado: data.fechaGuardado || data.fecha || '',
              timestamp: Number(data.timestamp || 0),
              datosDocumento: dataDoc,
              entregado: Boolean(data.entregado),
              rutaDb: `planesGenerados/${cedulaKey}/${snapDoc.key}`,
              actualizandoEstado: false
            });
          });
        });
      }

      if (snapSeg.exists()) {
        snapSeg.forEach((snapDoc) => {
          const data = snapDoc.val() || {};
          const nombreDocente =
            data.nombre || data.docente || data.NombresC ||
            data.datosDocumento?.NombresC || data.datosDocumento?.Nombresc ||
            data.datosDocumento?.NombreDocente || '';

          const dataDoc = {
            ...(data.datosDocumento || {}),
            Codigo: data.codigo || data.Codigo || data.datosDocumento?.Codigo || '',
            NombresC: nombreDocente,
            Cedula1:  data.cedula  || data.Cedula1  || data.datosDocumento?.Cedula1  || '',
            Carrera1: data.carrera || data.Carrera1 || data.datosDocumento?.Carrera1 || '',
            CarreraCursando:
              data.CarreraCursando || data.datosDocumento?.CarreraCursando || '',
            Finicio:   this.formatoFecha(data.Einicio || data.datosDocumento?.Finicio || ''),
            Ffin:      this.formatoFecha(data.Efin    || data.datosDocumento?.Ffin    || ''),
            imagenURL: data.datosDocumento?.imagenURL || data.imagenURL || null
          };

          registros.push({
            id: snapDoc.key || '',
            tipo: 'seguimiento',
            tipoLabel: 'Seguimiento',
            cedula:  dataDoc.Cedula1,
            docente: nombreDocente,
            carrera: dataDoc.Carrera1,
            codigo:  dataDoc.Codigo,
            fechaGuardado: data.fechaGuardado || data.fecha || '',
            timestamp: Number(data.timestamp || 0),
            datosDocumento: dataDoc,
            entregado: Boolean(data.entregado),
            rutaDb: `seguimientoGenerados/${snapDoc.key}`,
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

  get registrosFiltrados(): HistorialRegistro[] {
    const texto = this.filtroTexto.trim().toLowerCase();
    return this.registros.filter((r) => {
      const cumpleTipo   = this.filtroTipo === 'todos' || r.tipo === this.filtroTipo;
      const cumpleTexto  =
        !texto ||
        String(r.cedula  || '').toLowerCase().includes(texto) ||
        String(r.docente || '').toLowerCase().includes(texto) ||
        String(r.carrera || '').toLowerCase().includes(texto) ||
        String(r.codigo  || '').toLowerCase().includes(texto);
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
    if (tipo === 'plan')       return 'tag-plan';
    return 'tag-seguimiento';
  }

  async cambiarEstadoEntrega(item: HistorialRegistro, nuevoEstado: boolean): Promise<void> {
    if (item.actualizandoEstado || item.entregado === nuevoEstado) return;
    item.actualizandoEstado = true;
    this.cdr.detectChanges();

    try {
      await update(ref(dbDocente, item.rutaDb), { entregado: nuevoEstado });
      item.entregado = nuevoEstado;
      this.mostrarMensaje(
        nuevoEstado
          ? '✅ Documento marcado como entregado'
          : '✅ Documento marcado como pendiente'
      );
    } catch (error) {
      console.error('Error actualizando estado de entrega:', error);
      this.mostrarMensaje('❌ No se pudo actualizar el estado');
    } finally {
      item.actualizandoEstado = false;
      this.cdr.detectChanges();
    }
  }

  async descargarDocumento(item: HistorialRegistro): Promise<void> {
    if (!item.datosDocumento) {
      this.mostrarMensaje('⚠️ Este registro no tiene datos suficientes para regenerar el documento');
      return;
    }

    this.mostrarAnimacionGenerando();

    try {
      const plantillas: Record<TipoDocumento, string> = {
        patrocinio: '/assets/docs/patrocinio.docx',
        plan:       '/assets/docs/individual.docx',
        seguimiento:'/assets/docs/seguimiento.docx'
      };

      await this.generarPdfDesdePlantilla(plantillas[item.tipo], item.datosDocumento, item);
      this.ocultarAnimacionGenerando(true);
      this.mostrarMensaje('✅ PDF descargado correctamente');
    } catch (error: any) {
      this.ocultarAnimacionGenerando(false);
      console.error('Error descargando PDF:', error);
      this.mostrarMensaje(error?.message || '❌ No se pudo descargar el PDF');
    }
  }

  private async generarPdfDesdePlantilla(
    rutaPlantilla: string,
    data: any,
    item: HistorialRegistro
  ): Promise<void> {
    const response = await fetch(rutaPlantilla);
    if (!response.ok) {
      throw new Error(`No se pudo cargar la plantilla: ${rutaPlantilla}`);
    }

    const content = await response.arrayBuffer();
    const bytes = new Uint8Array(content.slice(0, 8));
    if (bytes[0] !== 80 || bytes[1] !== 75) {
      throw new Error(`La plantilla no es un .docx válido: ${rutaPlantilla}`);
    }

    const zip = new PizZip(content);
    const dataFinal = { ...data };
    const modules: any[] = [];

    if (item.tipo === 'seguimiento') {
      const ImageModuleImport: any = await import('docxtemplater-image-module-free');
      const ImageModule = ImageModuleImport.default || ImageModuleImport;
      const imagenURL   = dataFinal.imagenURL || dataFinal.imageURL || dataFinal.ImagenURL || null;
      const imagenBytes = await this.obtenerImagenSeguimiento(imagenURL);

      const imageModule = new ImageModule({
        centered: true,
        getImage: () => imagenBytes,
        getSize: () => (!imagenURL ? [1, 1] : [420, 300])
      });
      modules.push(imageModule);
      dataFinal.image = 'ok';
    }

    const doc = new Docxtemplater(zip, { modules, paragraphLoop: true, linebreaks: true });

    try {
      doc.render(dataFinal);
    } catch (error: any) {
      console.error('Error renderizando plantilla:', error);
      throw new Error('Error en la plantilla Word. Revisa las variables {{ }} o {%image}.');
    }

    const blobDocx = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const nombreBase = this.limpiarNombreArchivo(`${item.codigo || 'documento'}-${item.docente || 'docente'}`);
    await this.convertirDocxAPdf(blobDocx, nombreBase, item.tipo);
  }

  private async convertirDocxAPdf(
    blobDocx: Blob,
    nombreBase: string,
    tipoDocumento: TipoDocumento
  ): Promise<void> {
    const formData = new FormData();
    formData.append('file', blobDocx, `${nombreBase}.docx`);
    formData.append('tipo_documento', tipoDocumento);

    const response = await fetch(`${this.API_BASE}/convertir-pdf`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let msg = 'No se pudo convertir el documento a PDF';
      try {
        const err = await response.json();
        msg = err.detail || msg;
      } catch {}
      throw new Error(msg);
    }

    const blobPdf = await response.blob();
    saveAs(blobPdf, `${nombreBase}.pdf`);
  }

  private async obtenerImagenSeguimiento(url?: string | null): Promise<Uint8Array> {
    if (!url) return this.imagenPlaceholder1x1();
    try {
      const response = await fetch(url);
      if (!response.ok) return this.imagenPlaceholder1x1();
      const buffer = await response.arrayBuffer();
      const bytes  = new Uint8Array(buffer);
      if (!bytes.length) return this.imagenPlaceholder1x1();
      return bytes;
    } catch {
      return this.imagenPlaceholder1x1();
    }
  }

  private imagenPlaceholder1x1(): Uint8Array {
    return new Uint8Array([
      0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
      0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
      0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
      0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4,
      0x89,0x00,0x00,0x00,0x0D,0x49,0x44,0x41,
      0x54,0x78,0x9C,0x63,0x00,0x01,0x00,0x00,
      0x05,0x00,0x01,0x0D,0x0A,0x2D,0xB4,0x00,
      0x00,0x00,0x00,0x49,0x45,0x4E,0x44,0xAE,
      0x42,0x60,0x82
    ]);
  }

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
    setTimeout(() => {
      this.mensaje = '';
      this.cdr.detectChanges();
    }, 3500);
  }
}