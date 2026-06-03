import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  CronogramaService,
  ActividadCronograma,
  Cronograma
} from '../../firebase/cronogramas';

@Component({
  selector: 'app-publicar-cronogramas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './publicar-cronogramas.html',
  styleUrl: './publicar-cronogramas.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicarCronogramas {

  cargando = false;
  excelTexto = '';
  nombreCronograma = '';
  periodo = '';
  colorFondo = '#1976d2';
  colorTexto = '#ffffff';
  colorBorde = '#0d47a1';
  fuente = 'Arial';
  nuevaActividad = '';
  nuevaFechaInicio = '';
  nuevaFechaFin = '';
  actividades: ActividadCronograma[] = [];

  constructor(
    private cronogramaService: CronogramaService,
    private cdr: ChangeDetectorRef
  ) { }

  procesarExcel(): void {
    if (!this.excelTexto.trim()) return;

    const filas = this.excelTexto.trim().split('\n');
    if (filas.length <= 1) return;

    const nuevas: ActividadCronograma[] = [];

    for (let i = 1; i < filas.length; i++) {
      const columnas = filas[i].split('\t').map(v => v.trim());
      if (columnas.length < 3) continue;

      const fechaInicio = this.convertirFecha(columnas[1]);
      const fechaFin    = this.convertirFecha(columnas[2]);
      if (!fechaInicio || !fechaFin) continue;

      nuevas.push({
        actividad: columnas[0],
        fechaInicio,
        fechaFin
      });
    }

    this.actividades = [...this.actividades, ...nuevas]
      .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());

    this.excelTexto = '';
    this.cdr.markForCheck();
  }

  agregarActividad(): void {
    if (!this.nuevaActividad || !this.nuevaFechaInicio || !this.nuevaFechaFin) return;

    this.actividades = [...this.actividades, {
      actividad:   this.nuevaActividad,
      fechaInicio: this.nuevaFechaInicio,
      fechaFin:    this.nuevaFechaFin
    }].sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());

    this.nuevaActividad   = '';
    this.nuevaFechaInicio = '';
    this.nuevaFechaFin    = '';
    this.cdr.markForCheck();
  }

  eliminarActividad(index: number): void {
    this.actividades = this.actividades.filter((_, i) => i !== index);
    this.cdr.markForCheck();
  }

  async publicar(): Promise<void> {

    if (!this.nombreCronograma.trim()) {
      alert('Ingrese el nombre del cronograma');
      return;
    }

    if (this.actividades.length === 0) {
      alert('Debe agregar al menos una actividad');
      return;
    }

    this.cargando = true;
    this.cdr.detectChanges();

    try {

      const cronograma: Cronograma = {
        nombre:           this.nombreCronograma,
        periodo:          this.periodo,
        colorFondo:       this.colorFondo,
        colorTexto:       this.colorTexto,
        colorBorde:       this.colorBorde,
        fuente:           this.fuente,
        fechaInicio:      '',
        fechaFin:         '',
        fechaPublicacion: '',
        estado:           'PROGRAMADO',
        actividades:      this.actividades
      };

      await this.cronogramaService.publicarCronograma(cronograma);

      alert('Cronograma publicado correctamente');
      this.limpiarFormulario();

    } catch (error) {

      console.error(error);
      alert('Error al publicar cronograma');

    } finally {

      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  limpiarFormulario(): void {
    this.nombreCronograma = '';
    this.periodo          = '';
    this.colorFondo       = '#1976d2';
    this.colorTexto       = '#ffffff';
    this.colorBorde       = '#0d47a1';
    this.fuente           = 'Arial';
    this.excelTexto       = '';
    this.actividades      = [];
    this.cdr.markForCheck();
  }

  convertirFecha(fecha: string): string {
    if (!fecha) return '';
    fecha = fecha.trim();
    if (!fecha.includes('/')) return fecha;

    const partes = fecha.split('/');
    if (partes.length !== 3) return '';

    const dia  = partes[0].padStart(2, '0');
    const mes  = partes[1].padStart(2, '0');
    const anio = partes[2];

    return `${anio}-${mes}-${dia}`;
  }

  get totalActividades(): number {
    return this.actividades.length;
  }

  get fechaInicioCronograma(): string {
    return this.cronogramaService.obtenerFechaInicio(this.actividades) || '-';
  }

  get fechaFinCronograma(): string {
    return this.cronogramaService.obtenerFechaFin(this.actividades) || '-';
  }
}