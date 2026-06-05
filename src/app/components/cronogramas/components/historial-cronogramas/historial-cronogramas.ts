import {
  Component, OnInit, Output, EventEmitter,
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
export class HistorialCronogramas implements OnInit {

  @Output() abrirModalEvento = new EventEmitter<Cronograma>();
  @Output() vincularEvento   = new EventEmitter<Cronograma>(); // ← nuevo

  cronogramas: Cronograma[] = [];
  cargando = true;

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
  }

  estadoReal(c: Cronograma): 'PROGRAMADO' | 'VIGENTE' | 'FINALIZADO' {
    return this.cronogramaService.calcularEstado(c.fechaInicio, c.fechaFin);
  }

  abrirModal(c: Cronograma): void {
    this.abrirModalEvento.emit(c);
  }

  // ← nuevo: emite al padre para abrir el modal vincular
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

  // ── Backend wake-up ──────────────────────────────────────
estadoBackend: 'dormido' | 'despertando' | 'activo' = 'dormido';
cuentaRegresiva = 30;
private timerWake: any;

// Cambia esta URL por la de tu backend
private readonly BACKEND_URL = 'https://itsqmet-bot-backend.onrender.com';

async despertarBackend(): Promise<void> {
    if (this.estadoBackend === 'despertando') return;

    this.estadoBackend = 'despertando';
    this.cuentaRegresiva = 30;
    this.cdr.markForCheck();

    // Ping sin CORS usando Image — solo despierta, no espera respuesta real
    new Image().src = `https://itsqmet-bot-backend.onrender.com/?_=${Date.now()}`;

    // Countdown fijo de 30s (tiempo típico que tarda Render en despertar)
    this.timerWake = setInterval(() => {
        this.cuentaRegresiva--;
        this.cdr.markForCheck();

        if (this.cuentaRegresiva <= 0) {
            clearInterval(this.timerWake);
            this.estadoBackend = 'activo';
            this.cdr.markForCheck();

            // Resetear a dormido después de 5 min
            setTimeout(() => {
                this.estadoBackend = 'dormido';
                this.cdr.markForCheck();
            }, 5 * 60 * 1000);
        }
    }, 1000);
}
}