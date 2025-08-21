import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalCareer } from '../../Interface/CalCareer';
import { Career } from '../../Interface/Career';
import { TypeCareer } from '../../Interface/TypeCareer';
import { CalCareerService } from '../../services/cal-career';
import { CaeerService } from '../../services/caeer-service';
import { TypeCareerServices } from '../../services/type-career-services';


@Component({
  selector: 'app-career-cal',
  templateUrl: './career-cal.html',
  styleUrls: ['./career-cal.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class CareerCal {
  calCareer: CalCareer = {};
  careers: Career[] = [];
  typeCareers: TypeCareer[] = [];

  constructor(private calCareerService: CalCareerService, private careerService: CaeerService, private typeCareer: TypeCareerServices ) {}

  ngOnInit(): void {
    this.loadCareers();
    this.loadTypeCareers();
  }

  loadCareers(): void {
  this.careerService.obtenerCarreras().subscribe({
    next: data => this.careers = data,
    error: err => console.error('Error al cargar carreras:', err)
  });
}
  loadTypeCareers(): void {
    this.typeCareer.obtenerTipo().subscribe({
      next: data => this.typeCareers = data,
      error: err => console.log('Error al cargar elñ tipo: ', err)
      
    })
  }

  onSubmit(): void {
    this.calCareerService.create(this.calCareer).subscribe({
      next: () => {
        alert('Registro guardado exitosamente');
        this.resetForm();
      },
      error: err => {
        console.error('Error al guardar:', err);
        alert('Hubo un problema al guardar');
      }
    });
  }

  resetForm(): void {
    this.calCareer = {};
  }

  fechaFin: Date | null = null;

calcularFechaFin() {
  const tipoSeleccionado = this.typeCareers.find(t => t.tipo === this.calCareer.typeCareerTipo);
  const semanas = tipoSeleccionado?.duracion ?? 0;

  if (this.calCareer.fechaActual && semanas > 0) {
    const fechaInicio = new Date(this.calCareer.fechaActual);
    const fechaCalculada = new Date(fechaInicio);
    fechaCalculada.setDate(fechaInicio.getDate() + semanas * 7);

    this.fechaFin = fechaCalculada;
    this.calCareer.fechaFinal = fechaCalculada.toISOString().split('T')[0];
    this.calCareer.typeCareerDuracion = semanas;
  } else {
    this.fechaFin = null;
    this.calCareer.fechaFinal = undefined;
    this.calCareer.typeCareerDuracion = undefined;
  }
}
}