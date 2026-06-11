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

  // ── Backend wake-up (manual) ─────────────────────────────
  estadoBackend: 'dormido' | 'despertando' | 'activo' = 'dormido';
  cuentaRegresiva = 30;
  private timerWake: any;

  // ── Auto-heartbeat ───────────────────────────────────────
  private heartbeatGeneralTimer: any;  // ping cada 10 min dentro del horario
  private heartbeatCronTimer: any;     // ping cada 1 min para vigilar crons

  private readonly INTERVALO_GENERAL_MS = 10 * 60 * 1000; // 10 minutos
  private readonly INTERVALO_CRON_MS    =      60 * 1000; //  1 minuto

  // ── URL backend ─────────────────────────────────────────
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

    this.iniciarHeartbeat();
  }

  ngOnDestroy(): void {
    if (this.timerWake)            clearInterval(this.timerWake);
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

  // ── Botón manual: despertar backend ─────────────────────
  async despertarBackend(): Promise<void> {
    if (this.estadoBackend === 'despertando') return;

    this.estadoBackend = 'despertando';
    this.cuentaRegresiva = 30;
    this.cdr.markForCheck();

    // Ping sin CORS usando Image — solo despierta
    new Image().src = `${this.BACKEND_URL}/?_=${Date.now()}`;

    this.timerWake = setInterval(() => {
      this.cuentaRegresiva--;
      this.cdr.markForCheck();

      if (this.cuentaRegresiva <= 0) {
        clearInterval(this.timerWake);
        this.estadoBackend = 'activo';
        this.cdr.markForCheck();

        // Resetear a dormido después de 5 minutos
        setTimeout(() => {
          this.estadoBackend = 'dormido';
          this.cdr.markForCheck();
        }, 5 * 60 * 1000);
      }
    }, 1000);
  }

  // ── Auto-heartbeat ───────────────────────────────────────

  /**
   * Hora actual en Ecuador (UTC-5).
   */
  private ahoraEcuador(): Date {
    return new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    );
  }

  /**
   * true si estamos entre 8:00 AM y 5:59 PM hora Ecuador.
   */
  private esDentroDeHorario(): boolean {
    const h = this.ahoraEcuador().getHours();
    return h >= 8 && h < 18;
  }

  /**
   * true en los 5 minutos previos a las 8:00 AM o 6:00 PM.
   * Ej: 7:55–7:59 → true  /  17:55–17:59 → true
   * Así el backend está despierto justo cuando node-cron dispara.
   */
  private debeDespertarAntesDelCron(): boolean {
    const ahora = this.ahoraEcuador();
    const h = ahora.getHours();
    const m = ahora.getMinutes();

    const antesDeOcho = h === 7  && m >= 55; // 7:55 – 7:59 AM
    const antesDeSeis = h === 17 && m >= 55; // 5:55 – 5:59 PM

    return antesDeOcho || antesDeSeis;
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

  /**
   * Hace GET /ping al backend.
   * Si falla solo se loguea, no afecta la UI.
   */
  private async enviarHeartbeat(): Promise<void> {
    const hora = this.ahoraEcuador().toLocaleTimeString('es-EC');
    try {
      const res = await fetch(`${this.BACKEND_URL}/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(15000) // timeout 15s
      });
      console.log(`[Heartbeat] ✅ Backend despierto — status: ${res.status} — ${hora}`);
    } catch (err) {
      console.warn(`[Heartbeat] ⚠️ Sin respuesta en este ciclo (${hora}):`, err);
    }
  }
}