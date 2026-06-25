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

  filtroEstado: 'TODOS' | 'VIGENTE' | 'PROGRAMADO' | 'FINALIZADO' = 'TODOS';
  filtroTexto = '';

  estadoBackend: 'verificando' | 'dormido' | 'despertando' | 'activo' = 'verificando';
  private pollingWakeTimer: any;
  private keepaliveTimer: any;
  keepaliveActivo = false;

  private heartbeatGeneralTimer: any;
  private heartbeatCronTimer: any;

  private readonly INTERVALO_GENERAL_MS = 10 * 60 * 1000;
  private readonly INTERVALO_CRON_MS    =      60 * 1000;
  private readonly INTERVALO_KEEPALIVE  =      25 * 1000;
  private readonly INTERVALO_POLLING    =       3 * 1000;
  private readonly TIMEOUT_PING         =      15 * 1000;

  private readonly BACKEND_URL = 'https://itsqmet-bot-backend.onrender.com';

  // ── Preferencia del usuario persistida en localStorage ──
  private get _usuarioDetuvo(): boolean {
    return localStorage.getItem('backend_keepalive_detenido') === 'true';
  }
  private set _usuarioDetuvo(value: boolean) {
    if (value) {
      localStorage.setItem('backend_keepalive_detenido', 'true');
    } else {
      localStorage.removeItem('backend_keepalive_detenido');
    }
  }

  constructor(
    private cronogramaService: CronogramaService,
    private cdr: ChangeDetectorRef
  ) {}

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

  // ── Verificación inicial ─────────────────────────────────
  private async verificarEstadoInicial(): Promise<void> {
    this.estadoBackend = 'verificando';
    this.cdr.markForCheck();

    const activo = await this.pingBackend();

    if (activo) {
      if (!this._usuarioDetuvo) {
        console.log('[Backend] ✅ Ya estaba activo al cargar.');
        this.estadoBackend = 'activo';
        this.iniciarKeepalive();
      } else {
        console.log('[Backend] 🔕 Activo pero el usuario detuvo el keepalive, respetando.');
        this.estadoBackend = 'dormido';
      }
    } else {
      console.log('[Backend] 💤 Dormido al cargar.');
      this.estadoBackend = 'dormido';
    }

    this.cdr.markForCheck();
  }

  // ── Botón: Despertar ─────────────────────────────────────
  async despertarBackend(): Promise<void> {
    if (this.estadoBackend === 'despertando' || this.estadoBackend === 'verificando') return;

    this._usuarioDetuvo = false;

    this.estadoBackend = 'despertando';
    this.cdr.markForCheck();
    console.log('[Backend] 🔄 Iniciando polling para despertar...');

    await this.pingBackend();

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
    this._usuarioDetuvo = true;

    this.detenerKeepalive();

    if (this.heartbeatGeneralTimer) {
      clearInterval(this.heartbeatGeneralTimer);
      this.heartbeatGeneralTimer = null;
    }
    if (this.heartbeatCronTimer) {
      clearInterval(this.heartbeatCronTimer);
      this.heartbeatCronTimer = null;
    }

    this.estadoBackend = 'dormido';
    console.log('[Backend] 🛑 Preferencia guardada en localStorage. El servidor dormirá por inactividad.');
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

  // ── Ping ─────────────────────────────────────────────────
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

  // ── Auto-heartbeat ────────────────────────────────────────
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
      if (!this._usuarioDetuvo && this.debeDespertarAntesDelCron()) {
        console.log('[Heartbeat] ⏰ Pre-cron: despertando backend...');
        this.enviarHeartbeat();
      }
    }, this.INTERVALO_CRON_MS);

    if (!this._usuarioDetuvo && this.esDentroDeHorario()) {
      this.enviarHeartbeat();
    }

    this.heartbeatGeneralTimer = setInterval(() => {
      if (!this._usuarioDetuvo && this.esDentroDeHorario()) {
        this.enviarHeartbeat();
      } else if (this._usuarioDetuvo) {
        console.log('[Heartbeat] 🔕 Usuario detuvo keepalive, omitiendo ping.');
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