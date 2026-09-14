import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { HistorialRegistro } from './interface/HistorialRegistro';
import { GenStep } from './interface/GenStep';

import { DocumentoService } from './components/documento.service';
import { ExcelService } from './components/excel.service';
import { HistorialFirebaseService } from './components/historial-firebase.service';

export type TipoDocumento = 'patrocinio' | 'plan' | 'seguimiento' | 'sinFormación';

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
  filtroCapacitacion = '';
  filtroSede = '';
  registros: HistorialRegistro[] = [];
  listaCapacitaciones: string[] = [];
  listaSedes: string[] = [];

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
  private _subs = new Subscription();

  constructor(
    private cdr: ChangeDetectorRef,
    private documentoService: DocumentoService,
    private excelService: ExcelService,
    private firebaseService: HistorialFirebaseService
  ) { }

  ngOnInit(): void {
    this.resetStepStates();

    this._subs.add(
      this.firebaseService.obtenerRegistros$().subscribe((regs) => {
        this.registros = regs;
        this.cdr.detectChanges();
      })
    );

    this._subs.add(
      this.firebaseService.obtenerCargando$().subscribe((c) => {
        this.cargando = c;
        this.cdr.detectChanges();
      })
    );

    this.firebaseService.iniciarEscucha();
    this.cargarCatalogoCapacitaciones();
  }

  ngOnDestroy(): void {
    this.firebaseService.detenerEscucha();
    this._subs.unsubscribe();
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
  // CATÁLOGO DE CAPACITACIONES Y SEDES (para los filtros)
  // ─────────────────────────────────────────────
  private async cargarCatalogoCapacitaciones(): Promise<void> {
    const { nombres, sedes } = await this.firebaseService.cargarCatalogoCapacitaciones();
    this.listaCapacitaciones = nombres;
    this.listaSedes = sedes;
    this.cdr.detectChanges();
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

      const cumpleCapacitacion =
        !this.filtroCapacitacion ||
        ((r.tipo === 'patrocinio' || r.tipo === 'plan') && r.capacitacion === this.filtroCapacitacion);

      // Sede propia del registro (los registros antiguos sin este atributo se asumen de Quito)
      const sedeDelRegistro = r.sede || 'Quito';
      const cumpleSede = !this.filtroSede || sedeDelRegistro === this.filtroSede;

      return cumpleTipo && cumpleTexto && cumpleCapacitacion && cumpleSede;
    });
  }

  cambiarFiltroCapacitacion(valor: string): void {
    this.filtroCapacitacion = valor;
  }

  cambiarFiltroSede(valor: string): void {
    this.filtroSede = valor;
  }

  cambiarFiltro(tipo: 'todos' | TipoDocumento): void {
    this.filtroTipo = tipo;
    if (tipo === 'seguimiento' || tipo === 'sinFormación') {
      this.filtroCapacitacion = '';
      this.filtroSede = '';
    }
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
      await this.firebaseService.cambiarEstadoEntrega(item, nuevoEstado);
      this.mostrarMensaje(nuevoEstado ? '✅ Documento marcado como entregado' : '✅ Documento marcado como pendiente');
    } catch (error: any) {
      this.mostrarMensaje(error?.message || '❌ No se pudo actualizar el estado');
    } finally {
      item.actualizandoEstado = false;
      this.cdr.detectChanges();
    }
  }

  // ─────────────────────────────────────────────
  // DESCARGAR DOCUMENTO
  // ─────────────────────────────────────────────
  async descargarDocumento(item: HistorialRegistro): Promise<void> {
    this.mostrarAnimacionGenerando();

    try {
      await this.documentoService.descargarDocumento(item, {
        onReintento: (intento, max) => this.actualizarMensajeReintento(intento, max),
        onEsperando: (intento, max, segundos) => this.actualizarMensajeEsperando(intento, max, segundos)
      });

      this.ocultarAnimacionGenerando(true);
      this.abrirModalExito(item);

    } catch (error: any) {
      this.ocultarAnimacionGenerando(false);
      console.error('Error descargando PDF:', error);
      this.mostrarMensaje(error?.message || '❌ No se pudo descargar el PDF. Use el botón Re-descargar para intentarlo nuevamente.');
    }
  }

  // ─────────────────────────────────────────────
  // EXPORTAR EXCEL
  // ─────────────────────────────────────────────
  exportarExcel(): void {
    try {
      this.excelService.exportarHistorial(this.registrosFiltrados);
      this.mostrarMensaje('✅ Excel generado correctamente');
    } catch (error: any) {
      this.mostrarMensaje(error?.message || '❌ No se pudo exportar el Excel');
    }
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