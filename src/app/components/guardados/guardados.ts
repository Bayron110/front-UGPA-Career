// src/app/components/guardados/guardados.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalCareerView } from '../../Interface/CalCareerView';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CalCareerService } from '../../services/CalCareer/cal-career';
import { AxlesSuperior } from '../../Interface/Alex1';
import { AxlesSuperiorService } from '../../services/axles/axles-suoerior';

@Component({
  selector: 'app-guardados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guardados.html',
  styleUrls: ['./guardados.css']
})
export class Guardados implements OnInit {
  calCareers: CalCareerView[] = [];
  carreraSeleccionada?: CalCareerView;
  
  showModal: boolean = false;
  
  niveles: {
    nombre: string;
    ejes: {
      nombre: string;
      temas: string[];
    }[];
  }[] = [];

  currentStep: number = 0;

  constructor(
    private calCareerService: CalCareerService,
    private axlesSuperiorService: AxlesSuperiorService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.obtenerGuardados();
    this.resetNiveles();
  }

  obtenerGuardados(): void {
    this.calCareerService.getAll().subscribe({
      next: (data) => {
        this.calCareers = data.map((item: any) => ({
          id: item.id,
          career: item.career,
          typeCareer: item.typeCareer,
          fechaActual: new Date(item.fechaActual[0], item.fechaActual[1] - 1, item.fechaActual[2]),
          fechaFin: new Date(item.fechaFin[0], item.fechaFin[1] - 1, item.fechaFin[2])
        }));
      },
      error: (err) => {
        console.error('Error al obtener registros:', err);
      }
    });
  }

  trackById(index: number, item: CalCareerView) {
    return item.id;
  }

  seleccionar(item: CalCareerView): void {
    this.carreraSeleccionada = item;
    this.abrirModal();
  }

  abrirModal(): void {
    this.showModal = true;
    this.currentStep = 0;
    this.resetNiveles();
  }

  cerrarModal(): void {
    this.showModal = false;
    this.carreraSeleccionada = undefined;
    this.currentStep = 0;
  }

  resetNiveles(): void {
    this.niveles = Array(4).fill(null).map(() => ({
      nombre: '',
      ejes: [
        { nombre: '', temas: ['', '', '', ''] },
        { nombre: '', temas: ['', '', '', ''] },
        { nombre: '', temas: ['', '', '', ''] },
        { nombre: '', temas: ['', '', '', ''] }
      ]
    }));
  }

  nextStep(): void {
    if (this.currentStep < 3) this.currentStep++;
  }

  prevStep(): void {
    if (this.currentStep > 0) this.currentStep--;
  }

  goToStep(step: number): void {
    this.currentStep = step;
  }

  guardarEjes(): void {
    if (!this.carreraSeleccionada) {
      alert('No hay carrera seleccionada');
      return;
    }

    this.niveles.forEach((nivel, nivelIndex) => {
      const tieneEjes = nivel.ejes.some(eje => eje.nombre.trim() !== '');

      if (tieneEjes) {
        const axle: AxlesSuperior = {
          calCareer: { id: this.carreraSeleccionada!.id },
          nivel: nivel.nombre || `Nivel ${nivelIndex + 1}`,
          eje1: nivel.ejes[0]?.nombre || '',
          eje2: nivel.ejes[1]?.nombre || '',
          eje3: nivel.ejes[2]?.nombre || '',
          eje4: nivel.ejes[3]?.nombre || ''
        };

        this.axlesSuperiorService.save(axle).subscribe({
          next: (resp) => {
            console.log('Guardado en BD:', resp);
          },
          error: (err) => {
            console.error('❌ Error al guardar:', err);
          }
        });
      }
    });

    alert(`✅ Estructura guardada exitosamente para la carrera: "${this.carreraSeleccionada.career.nombre}"`);
    this.cerrarModal();
  }

  onSubmit(): void {
    this.guardarEjes();
  }

  irAAsignarEjes(tipoCarrera: string): void {
    const tipo = tipoCarrera.toLowerCase();
    if (tipo === 'superior') {
      this.router.navigate(['/superior']);
    } else if (tipo === 'tsu') {
      this.router.navigate(['/tsu']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
