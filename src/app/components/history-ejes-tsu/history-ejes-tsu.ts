import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalCareer } from '../../Interface/CalCareer';
import { AxlesSuperior } from '../../Interface/Alex1';
import { CalCareerService } from '../../services/CalCareer/cal-career';
import { EjePipePipe } from '../../pipes/eje-pipe-pipe';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { AxlesTsuService } from '../../services/TypeCaeerTsu/type-tsu';

@Component({
  selector: 'app-history-ejes-tsu',
  standalone: true,
  templateUrl: './history-ejes-tsu.html',
  styleUrls: ['./history-ejes-tsu.css'],
  imports: [CommonModule, EjePipePipe]
})
export class HistoryEjesTsu implements OnInit {
  carrerasConEjes: { carrera: CalCareer; ejes: AxlesSuperior[]; ejesVisibles: boolean }[] = [];

  constructor(
    private calCareerService: CalCareerService,
    private axlesTSUService: AxlesTsuService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.calCareerService.getAll().subscribe({
      next: (carreras) => {
        // 🔍 Filtrar solo carreras de tipo TSU
        const carrerasTSU = carreras.filter(
          carrera =>
            carrera.id !== undefined &&
            carrera.typeCareer?.tipo?.toLowerCase() === 'tsu'
        );

        const observables = carrerasTSU.map(carrera =>
          this.axlesTSUService.getByCalCareerId(carrera.id!).pipe(
            map(ejes => ({ carrera, ejes, ejesVisibles: false }))
          )
        );

        forkJoin(observables).subscribe({
          next: (data) => {
            this.carrerasConEjes = data;
            this.cdr.detectChanges();
          },
          error: (err) => console.error('Error al obtener ejes de las carreras TSU', err)
        });
      },
      error: (err) => console.error('Error al obtener carreras', err)
    });
  }

  getEjesOrdenados(ejes: AxlesSuperior[]): AxlesSuperior[] {
    return ejes
      .filter((eje) => eje.nivel)
      .sort((a, b) => {
        const nivelA = parseInt(a.nivel.replace(/\D/g, ''), 10);
        const nivelB = parseInt(b.nivel.replace(/\D/g, ''), 10);
        return nivelA - nivelB;
      });
  }

  toggleEjesVisibles(index: number): void {
    this.carrerasConEjes[index].ejesVisibles = !this.carrerasConEjes[index].ejesVisibles;
  }

  procesarMaterias(ejeTexto: string): string[] {
    if (!ejeTexto || ejeTexto === '-') return [];
    return ejeTexto
      .split(' - ')
      .map(materia => materia.trim())
      .filter(materia => materia.length > 0);
  }
}
