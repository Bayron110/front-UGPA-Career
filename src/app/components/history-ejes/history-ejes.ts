import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalCareer } from '../../Interface/CalCareer';
import { AxlesSuperior } from '../../Interface/Alex1';
import { CalCareerService } from '../../services/CalCareer/cal-career';
import { AxlesSuperiorService } from '../../services/axles/axles-suoerior';
import { EjePipePipe } from '../../pipes/eje-pipe-pipe';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-history-ejes',
  standalone: true,
  templateUrl: './history-ejes.html',
  styleUrls: ['./history-ejes.css'],
  imports: [CommonModule, EjePipePipe]
})
export class HistoryEjes implements OnInit {
  carrerasConEjes: { carrera: CalCareer; ejes: AxlesSuperior[]; ejesVisibles: boolean }[] = [];

  constructor(
    private calCareerService: CalCareerService,
    private axlesSuperiorService: AxlesSuperiorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.calCareerService.getAll().subscribe({
      next: (carreras) => {
        const observables = carreras
          .filter(carrera => carrera.id !== undefined)
          .map(carrera =>
            this.axlesSuperiorService.getByCalCareerId(carrera.id!).pipe(
              map(ejes => ({ carrera, ejes, ejesVisibles: false }))
            )
          );

        // forkJoin espera a que todos los observables terminen
        forkJoin(observables).subscribe({
          next: (data) => {
            this.carrerasConEjes = data;       // asigna los datos al array
            this.cdr.detectChanges();          // fuerza refresco de la vista
          },
          error: (err) => console.error('Error al obtener ejes de las carreras', err)
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
