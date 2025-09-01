import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalCareer } from '../../Interface/CalCareer';

import { TypeCareer } from '../../Interface/TypeCareer';
import { CareerService } from '../../services/Career/caeer-service';
import { TypeCareerService } from '../../services/type-career-services';
import { CalCareerService } from '../../services/CalCareer/cal-career';
import { Career } from '../../Interface/Career';

@Component({
  selector: 'app-career-cal',
  templateUrl: './career-cal.html',
  styleUrls: ['./career-cal.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class CareerCal implements OnInit {

  calCareer: CalCareer = {
    careerId: 0,
    typeCareerId: 0,
    fechaActual: '',
    fechaFin: '',
    
  };

  careers: Career[] = [];
  typeCareers: TypeCareer[] = [];
  fechaFin: Date | null = null;

  // Variable que indica que ya se guardó la información
  infoGuardada: boolean = false;

  constructor(
    private router: Router,
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
    const tipo = this.typeCareers.find(t => t.id === this.calCareer.typeCareerId);
    if (this.calCareer.fechaActual && tipo) {
      const fechaInicio = new Date(this.calCareer.fechaActual);
      const fechaCalculada = new Date(fechaInicio);
      fechaCalculada.setDate(fechaInicio.getDate() + tipo.duracion * 7);

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
        alert('✅ Información guardada correctamente');
        this.infoGuardada = true; // Marcamos que se guardó
      },
      error: (err) => {
        console.error('❌ Error al guardar:', err);
        alert('❌ Hubo un problema al guardar');
      }
    });
  }

  // Redirigir solo si ya se guardó la información
  redirigir(): void {
  this.router.navigate(['/vista']);
}
}
