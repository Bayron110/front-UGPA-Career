import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  CronogramaService,
  ActividadCronograma,
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

  cronogramas: Cronograma[] = [];
  cargando = true;

  constructor(
    private cronogramaService: CronogramaService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cronogramaService.escucharCronogramas(lista => {
      this.cronogramas = lista.sort(
        (a, b) => new Date(b.fechaPublicacion).getTime() - new Date(a.fechaPublicacion).getTime()
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

  async eliminarCronograma(id: string): Promise<void> {
    if (!confirm('¿Seguro que deseas eliminar este cronograma?')) return;
    try {
      await this.cronogramaService.eliminarCronograma(id);
    } catch (error) {
      console.error(error);
      alert('Error al eliminar');
    }
  }

  vincularEstudiantes(): void {
    // TODO
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '-';
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
  }

  trackById(_: number, c: Cronograma): string {
    return c.id ?? '';
  }
}