import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalCareer } from '../../Interface/CalCareer';
import { AxlesSuperior } from '../../Interface/Alex1';
import { CalCareerService } from '../../services/CalCareer/cal-career';
import { AxlesSuperiorService } from '../../services/axles/axles-suoerior';

@Component({
  selector: 'app-history-ejes',
  standalone: true,
  templateUrl: './history-ejes.html',
  styleUrls: ['./history-ejes.css'],
  imports: [CommonModule]
})
export class HistoryEjes implements OnInit {
  carrerasConEjes: { carrera: CalCareer; ejes: AxlesSuperior[]; ejesVisibles: boolean }[] = [];

  constructor(
    private calCareerService: CalCareerService,
    private axlesSuperiorService: AxlesSuperiorService
  ) {}

  ngOnInit(): void {
    this.calCareerService.getAll().subscribe({
      next: (carreras) => {
        carreras.forEach((carrera) => {
          if (carrera.id !== undefined) {
            this.axlesSuperiorService.getByCalCareerId(carrera.id).subscribe({
              next: (ejes) => {
                this.carrerasConEjes.push({ carrera, ejes, ejesVisibles: false });
              },
              error: (err) =>
                console.error(`Error al obtener ejes de ${carrera.id}`, err)
            });
          } else {
            console.warn('Carrera sin ID definida:', carrera);
          }
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
  if (!ejeTexto || ejeTexto === '-') {
    return [];
  }

  return ejeTexto
    .split(' - ')
    .map(materia => materia.trim())
    .filter(materia => materia.length > 0);
}
}
