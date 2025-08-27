import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalCareer } from '../../Interface/CalCareer';
import { Career } from '../../Interface/Career';
import { TypeCareer } from '../../Interface/TypeCareer';
import { CalCareerService } from '../../services/cal-career';
import { CareerService } from '../../services/caeer-service';
import { TypeCareerService } from '../../services/type-career-services';
import { Axles } from "../axles/axles";

@Component({
  selector: 'app-career-cal',
  templateUrl: './career-cal.html',
  styleUrls: ['./career-cal.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, Axles]
})
export class CareerCal implements OnInit {

  calCareer: CalCareer = {
    careerId: 0,
    typeCareerId: 0,
    fechaActual: '',
    fechaFin: ''
  };

  careers: Career[] = [];
  typeCareers: TypeCareer[] = [];
  fechaFin: Date | null = null;

  constructor(
    private calCareerService: CalCareerService,
    private careerService: CareerService,
    private typeCareerService: TypeCareerService
  ) {}

  ngOnInit(): void {
    this.loadCareers();
    this.loadTypeCareers();
  }
  

  loadCareers(): void {
    this.careerService.obtenerCarreras().subscribe({
      next: (data) => (this.careers = data),
      error: (err) => console.error('Error al cargar carreras:', err)
    });
  }

  loadTypeCareers(): void {
    this.typeCareerService.obtenerTipos().subscribe({
      next: (data) => (this.typeCareers = data),
      error: (err) => console.error('Error al cargar tipos:', err)
    });
  }

  calcularFechaFin(): void {
    const tipoSeleccionado = this.typeCareers.find(
      (t) => t.id === this.calCareer.typeCareerId
    );

    const semanas = tipoSeleccionado?.duracion ?? 0;

    if (this.calCareer.fechaActual && semanas > 0) {
      const fechaInicio = new Date(this.calCareer.fechaActual);
      const fechaCalculada = new Date(fechaInicio);
      fechaCalculada.setDate(fechaInicio.getDate() + semanas * 7);

      this.fechaFin = fechaCalculada;
      this.calCareer.fechaFin = fechaCalculada.toISOString().split('T')[0];
    } else {
      this.fechaFin = null;
      this.calCareer.fechaFin = '';
    }
  }

  onSubmit(): void {
    if (!this.calCareer.careerId || !this.calCareer.typeCareerId || !this.calCareer.fechaActual) {
      alert('⚠️ Todos los campos son obligatorios');
      return;
    }

    const payload = {
      career: { id: this.calCareer.careerId },
      typeCareer: { id: this.calCareer.typeCareerId },
      fechaActual: this.calCareer.fechaActual,
      fechaFin: this.calCareer.fechaFin
    };

    this.calCareerService.create(payload).subscribe({
      next: () => {
        alert('✅ Registro guardado exitosamente');
        this.resetForm();
      },
      error: (err) => {
        console.error('❌ Error al guardar:', err);
        alert('❌ Hubo un problema al guardar');
      }
    });
  }

  resetForm(): void {
    this.calCareer = {
      careerId: 0,
      typeCareerId: 0,
      fechaActual: '',
      fechaFin: ''
    };
    this.fechaFin = null;
  }
  ejesCompletos: boolean = false;
}
