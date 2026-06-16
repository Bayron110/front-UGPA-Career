import {
  Component, OnInit, OnDestroy, Output, EventEmitter,
  ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  CronogramaService,
  Cronograma
} from '../../firebase/cronogramas';

@Component({
  selector: 'app-historial-cronogramas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial-cronogramas.html',
  styleUrl: './historial-cronogramas.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistorialCronogramas implements OnInit, OnDestroy {

  @Output() abrirModalEvento = new EventEmitter<Cronograma>();
  @Output() vincularEvento   = new EventEmitter<Cronograma>();

  cronogramas: Cronograma[] = [];
  cargando = true;

  // ── Filtros ──────────────────────────────────────────────
  filtroEstado: 'TODOS' | 'VIGENTE' | 'PROGRAMADO' | 'FINALIZADO' = 'TODOS';
  filtroTexto = '';

  // ── Backend monitor ──────────────────────────────────────
  estadoBackend: 'verificando' | 'dormido' | 'despertando' | 'activo' = 'verificando';
  private pollingWakeTimer: any;   // polling cada 3s mientras despierta
  private keepaliveTimer: any;     // ping cada 25s para mantener activo
  keepaliveActivo = false;         // true cuando el keepalive está corriendo

  // ── Auto-heartbeat (pre-cron) ────────────────────────────
  private heartbeatGeneralTimer: any;
  private heartbeatCronTimer: any;

  private readonly INTERVALO_GENERAL_MS = 10 * 60 * 1000; // 10 min
  private readonly INTERVALO_CRON_MS    =      60 * 1000; //  1 min
  private readonly INTERVALO_KEEPALIVE  =      25 * 1000; // 25 s
  private readonly INTERVALO_POLLING    =       3 * 1000; //  3 s
  private readonly TIMEOUT_PING         =      15 * 1000; // 15 s

  private readonly BACKEND_URL = 'https://itsqmet-bot-backend.onrender.com';

  constructor(
    private cronogramaService: CronogramaService,
    private cdr: ChangeDetectorRef
  ) {}

  // ────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.cronogramaService.escucharCronogramas(lista => {
      this.cronogramas = lista.sort(
        (a, b) =>
          new Date(b.fechaPublicacion).getTime() -
          new Date(a.fechaPublicacion).getTime()
      );
      this.cargando = false;
      this.cdr.markForCheck();
    });

    // Verificar estado real del backend al cargar
    this.verificarEstadoInicial();
    this.iniciarHeartbeat();
  }

  ngOnDestroy(): void {
    this.detenerPolling();
    this.detenerKeepalive();
    if (this.heartbeatGeneralTimer) clearInterval(this.heartbeatGeneralTimer);
    if (this.heartbeatCronTimer)    clearInterval(this.heartbeatCronTimer);
  }

  // ── Helpers cronograma ───────────────────────────────────
  estadoReal(c: Cronograma): 'PROGRAMADO' | 'VIGENTE' | 'FINALIZADO' {
    return this.cronogramaService.calcularEstado(c.fechaInicio, c.fechaFin);
  }

  abrirModal(c: Cronograma): void {
    this.abrirModalEvento.emit(c);
  }

  abrirVincular(c: Cronograma): void {
    this.vincularEvento.emit(c);
  }

  async eliminarCronograma(id: string): Promise<void> {
    if (!confirm('¿Seguro que deseas eliminar este cronograma?')) return;
    try {
      await this.cronogramaService.eliminarCronograma(id);
    } catch (error) {
      console.error(error);
      alert('Error al eliminar');
    }
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '-';
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
  }

  trackById(_: number, c: Cronograma): string {
    return c.id ?? '';
  }

  // ── Filtros ──────────────────────────────────────────────
  get cronogramasFiltrados(): Cronograma[] {
    return this.cronogramas.filter(c => {
      const coincideEstado =
        this.filtroEstado === 'TODOS' || this.estadoReal(c) === this.filtroEstado;

      const coincideTexto =
        !this.filtroTexto.trim() ||
        c.nombre.toLowerCase().includes(this.filtroTexto.trim().toLowerCase());

      return coincideEstado && coincideTexto;
    });
  }

  setFiltro(estado: 'TODOS' | 'VIGENTE' | 'PROGRAMADO' | 'FINALIZADO'): void {
    this.filtroEstado = estado;
    this.cdr.markForCheck();
  }

  contar(estado: 'VIGENTE' | 'PROGRAMADO' | 'FINALIZADO'): number {
    return this.cronogramas.filter(c => this.estadoReal(c) === estado).length;
  }

  limpiarBusqueda(): void {
    this.filtroTexto = '';
    this.cdr.markForCheck();
  }

  // ── Verificación inicial del estado real ─────────────────
  private async verificarEstadoInicial(): Promise<void> {
    this.estadoBackend = 'verificando';
    this.cdr.markForCheck();

    const activo = await this.pingBackend();

    if (activo) {
      console.log('[Backend] ✅ Ya estaba activo al cargar.');
      this.estadoBackend = 'activo';
      this.iniciarKeepalive();
    } else {
      console.log('[Backend] 💤 Dormido al cargar.');
      this.estadoBackend = 'dormido';
    }

    this.cdr.markForCheck();
  }

  // ── Botón: Despertar ─────────────────────────────────────
  async despertarBackend(): Promise<void> {
    if (this.estadoBackend === 'despertando' || this.estadoBackend === 'verificando') return;

    this.estadoBackend = 'despertando';
    this.cdr.markForCheck();
    console.log('[Backend] 🔄 Iniciando polling para despertar...');

    // Primer ping inmediato
    await this.pingBackend();

    // Polling cada 3s hasta que responda
    this.pollingWakeTimer = setInterval(async () => {
      const activo = await this.pingBackend();

      if (activo) {
        this.detenerPolling();
        this.estadoBackend = 'activo';
        this.keepaliveActivo = true;
        this.iniciarKeepalive();
        console.log('[Backend] ✅ Servidor despierto y keepalive iniciado.');
        this.cdr.markForCheck();
      }
    }, this.INTERVALO_POLLING);
  }

  // ── Botón: Finalizar keepalive ───────────────────────────
  finalizarKeepalive(): void {
    this.detenerKeepalive();
    this.estadoBackend = 'dormido';
    console.log('[Backend] 🛑 Keepalive detenido. El servidor dormirá por inactividad.');
    this.cdr.markForCheck();
  }

  // ── Keepalive: mantener vivo cada 25s ───────────────────
  private iniciarKeepalive(): void {
    this.detenerKeepalive();
    this.keepaliveActivo = true;

    this.keepaliveTimer = setInterval(async () => {
      const activo = await this.pingBackend();
      const hora = this.ahoraEcuador().toLocaleTimeString('es-EC');

      if (activo) {
        console.log(`[Keepalive] 💚 Backend sigue activo — ${hora}`);
      } else {
        // Si perdió conexión, actualizar estado
        console.warn(`[Keepalive] ⚠️ Backend no responde — ${hora}`);
        this.estadoBackend = 'dormido';
        this.keepaliveActivo = false;
        this.detenerKeepalive();
        this.cdr.markForCheck();
      }
    }, this.INTERVALO_KEEPALIVE);
  }

  private detenerKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    this.keepaliveActivo = false;
  }

  private detenerPolling(): void {
    if (this.pollingWakeTimer) {
      clearInterval(this.pollingWakeTimer);
      this.pollingWakeTimer = null;
    }
  }

  // ── Ping real al backend ─────────────────────────────────
  /**
   * Hace GET /ping. Devuelve true si responde OK, false si falla.
   */
  private async pingBackend(): Promise<boolean> {
    try {
      const res = await fetch(`${this.BACKEND_URL}/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.TIMEOUT_PING)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Auto-heartbeat (pre-cron, no modifica estadoBackend) ─
  private ahoraEcuador(): Date {
    return new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    );
  }

  private esDentroDeHorario(): boolean {
    const h = this.ahoraEcuador().getHours();
    return h >= 8 && h < 18;
  }

  private debeDespertarAntesDelCron(): boolean {
    const ahora = this.ahoraEcuador();
    const h = ahora.getHours();
    const m = ahora.getMinutes();
    return (h === 7 && m >= 55) || (h === 17 && m >= 55);
  }

  private iniciarHeartbeat(): void {
    if (this.debeDespertarAntesDelCron()) {
      console.log('[Heartbeat] ⏰ Ventana pre-cron detectada al iniciar, despertando...');
      this.enviarHeartbeat();
    }

    this.heartbeatCronTimer = setInterval(() => {
      if (this.debeDespertarAntesDelCron()) {
        console.log('[Heartbeat] ⏰ Pre-cron: despertando backend...');
        this.enviarHeartbeat();
      }
    }, this.INTERVALO_CRON_MS);

    if (this.esDentroDeHorario()) {
      this.enviarHeartbeat();
    }

    this.heartbeatGeneralTimer = setInterval(() => {
      if (this.esDentroDeHorario()) {
        this.enviarHeartbeat();
      } else {
        console.log(
          `[Heartbeat] 💤 Fuera de horario ` +
          `(${this.ahoraEcuador().toLocaleTimeString('es-EC')}), omitiendo ping general.`
        );
      }
    }, this.INTERVALO_GENERAL_MS);
  }

  private async enviarHeartbeat(): Promise<void> {
    const hora = this.ahoraEcuador().toLocaleTimeString('es-EC');
    try {
      const res = await fetch(`${this.BACKEND_URL}/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.TIMEOUT_PING)
      });
      console.log(`[Heartbeat] ✅ Backend despierto — status: ${res.status} — ${hora}`);
    } catch (err) {
      console.warn(`[Heartbeat] ⚠️ Sin respuesta en este ciclo (${hora}):`, err);
    }
  }
}