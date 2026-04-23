import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get, off, onValue, ref, update } from 'firebase/database';
import { dbDocente } from '../../../../../firebase/firebase-docente';

declare const PizZip: any;
declare const docxtemplater: any;
declare const saveAs: any;

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

  private refPatrocinio = ref(dbDocente, 'patrociniosGenerados');
  private refPlan = ref(dbDocente, 'planesGenerados');
  private refSeguimiento = ref(dbDocente, 'seguimientoGenerados');

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.cargarHistorial();
    this.escucharCambios();
  }

  ngOnDestroy(): void {
    off(this.refPatrocinio);
    off(this.refPlan);
    off(this.refSeguimiento);
  }

  escucharCambios(): void {
    onValue(this.refPatrocinio, () => this.cargarHistorial());
    onValue(this.refPlan, () => this.cargarHistorial());
    onValue(this.refSeguimiento, () => this.cargarHistorial());
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

      /* ── PATROCINIOS ──────────────────────────── */
      if (snapPat.exists()) {
        snapPat.forEach((snapCedula) => {
          const cedulaKey = snapCedula.key || '';
          snapCedula.forEach((snapDoc) => {
            const data = snapDoc.val() || {};
            const dataDoc = {
              NombresC: data.docente || '',
              Carrera1: data.carrera || '',
              Cedula1: data.cedula || cedulaKey,
              NombreCA: data.capacitacion || '',
              Codigo: data.codigo || '',
              Fecha1: data.fecha || data.fechaTexto || ''
            };
            registros.push({
              id: `${cedulaKey}_${snapDoc.key}`,
              tipo: 'patrocinio',
              tipoLabel: 'Patrocinio',
              cedula: data.cedula || cedulaKey,
              docente: data.docente || '',
              carrera: data.carrera || '',
              codigo: data.codigo || '',
              fechaGuardado: data.fechaGuardado || '',
              timestamp: Number(data.timestamp || 0),
              datosDocumento: dataDoc,
              entregado: Boolean(data.entregado),
              rutaDb: `patrociniosGenerados/${cedulaKey}/${snapDoc.key}`,
              actualizandoEstado: false
            });
          });
        });
      }

      /* ── PLANES INDIVIDUALES ──────────────────── */
      if (snapPlan.exists()) {
        snapPlan.forEach((snapCedula) => {
          const cedulaKey = snapCedula.key || '';
          snapCedula.forEach((snapDoc) => {
            const data = snapDoc.val() || {};
            const dataDoc = {
              Codigo: data.codigo || '',
              NombresC: data.docente || '',
              Nombresc: data.docente || '',
              CarreraDocente: data.carrera || '',
              Carreradocente: data.carrera || '',

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
              'NivelFormaciónGenerica': data.nivelFormacionGenerica || ''
            };
            registros.push({
              id: `${cedulaKey}_${snapDoc.key}`,
              tipo: 'plan',
              tipoLabel: 'Plan Individual',
              cedula: data.cedula || cedulaKey,
              docente: data.docente || '',
              carrera: data.carrera || '',
              codigo: data.codigo || '',
              fechaGuardado: data.fechaGuardado || '',
              timestamp: Number(data.timestamp || 0),
              datosDocumento: dataDoc,
              entregado: Boolean(data.entregado),
              rutaDb: `planesGenerados/${cedulaKey}/${snapDoc.key}`,
              actualizandoEstado: false
            });
          });
        });
      }

      /* ── SEGUIMIENTO ──────────────────────────── */
      if (snapSeg.exists()) {
        snapSeg.forEach((snapDoc) => {
          const data = snapDoc.val() || {};
          registros.push({
            id: snapDoc.key || '',
            tipo: 'seguimiento',
            tipoLabel: 'Seguimiento',
            cedula: data.cedula || data.Cedula1 || '',
            docente: data.docente || data.NombresC || '',
            carrera: data.carrera || data.Carrera1 || '',
            codigo: data.codigo || data.Codigo || '',
            fechaGuardado: data.fechaGuardado || '',
            timestamp: Number(data.timestamp || 0),
            datosDocumento: data.datosDocumento || null,
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

  /* ── Getters / helpers ───────────────────────── */

  get registrosFiltrados(): HistorialRegistro[] {
    const texto = this.filtroTexto.trim().toLowerCase();
    return this.registros.filter((r) => {
      const cumpleTipo = this.filtroTipo === 'todos' || r.tipo === this.filtroTipo;
      const cumpleTexto = !texto ||
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
    return this.registros.filter(r => r.tipo === tipo).length;
  }

  obtenerClaseTipo(tipo: TipoDocumento): string {
    if (tipo === 'patrocinio') return 'tag-patrocinio';
    if (tipo === 'plan') return 'tag-plan';
    return 'tag-seguimiento';
  }

  /* ── Estado entrega ──────────────────────────── */

  async cambiarEstadoEntrega(item: HistorialRegistro, nuevoEstado: boolean): Promise<void> {
    if (item.actualizandoEstado || item.entregado === nuevoEstado) return;

    item.actualizandoEstado = true;
    this.cdr.detectChanges();

    try {
      await update(ref(dbDocente, item.rutaDb), { entregado: nuevoEstado });
      item.entregado = nuevoEstado;
      this.mostrarMensaje(nuevoEstado
        ? '✅ Documento marcado como entregado'
        : '✅ Documento marcado como pendiente');
    } catch (error) {
      console.error('Error actualizando estado de entrega:', error);
      this.mostrarMensaje('❌ No se pudo actualizar el estado');
    } finally {
      item.actualizandoEstado = false;
      this.cdr.detectChanges();
    }
  }

  /* ── Descarga ────────────────────────────────── */

  async descargarDocumento(item: HistorialRegistro): Promise<void> {
    if (!item.datosDocumento) {
      this.mostrarMensaje('⚠️ Este registro no tiene datos suficientes para regenerar el documento');
      return;
    }
    try {
      const plantillas: Record<TipoDocumento, string> = {
        patrocinio: 'assets/doc/patrocinio.docx',
        plan: 'assets/doc/individual.docx',
        seguimiento: 'assets/doc/seguimiento.docx'
      };
      await this.generarWordDesdePlantilla(plantillas[item.tipo], item.datosDocumento, item);
      this.mostrarMensaje('✅ Documento descargado correctamente');
    } catch (error) {
      console.error('Error descargando documento:', error);
      this.mostrarMensaje('❌ No se pudo descargar el documento');
    }
  }

  private async generarWordDesdePlantilla(
    rutaPlantilla: string,
    data: any,
    item: HistorialRegistro
  ): Promise<void> {
    const response = await fetch(rutaPlantilla);
    if (!response.ok) throw new Error(`No se pudo cargar la plantilla ${rutaPlantilla}`);

    const content = await response.arrayBuffer();
    const zip = new PizZip(content);
    const doc = new docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);

    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    saveAs(blob, `${this.limpiarNombreArchivo(`${item.codigo || 'documento'}-${item.docente || 'docente'}`)}.docx`);
  }

  /* ── Utils ───────────────────────────────────── */

  private formatoFecha(fechaISO: string): string {
    if (!fechaISO) return '';
    const p = String(fechaISO).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fechaISO;
  }

  private limpiarNombreArchivo(texto: string): string {
    return String(texto || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    this.cdr.detectChanges();
    setTimeout(() => { this.mensaje = ''; this.cdr.detectChanges(); }, 3500);
  }
}