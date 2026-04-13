import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalCareer } from '../../Interface/CalCareer';
import { TypeCareer } from '../../Interface/TypeCareer';
import { CareerService } from '../../services/Career/caeer-service';
import { TypeCareerService } from '../../services/TypeCareer/type-career-services';
import { CalCareerService } from '../../services/CalCareer/cal-career';
import { Career } from '../../Interface/Career';

interface ModalState {
  visible: boolean;
  tipo: 'success' | 'warning' | 'error';
  icono: string;
  titulo: string;
  mensaje: string;
  confirmacion: boolean;
}

@Component({
  selector: 'app-career-cal',
  templateUrl: './career-cal.html',
  styleUrls: ['./career-cal.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class CareerCal implements OnInit {

  calCareer: CalCareer = {
    careerId: "",
    typeCareerId: "",
    fechaActual: "",
    fechaFin: "",
  };

  calCareers: any[] = [];
  careers: Career[] = [];
  typeCareers: TypeCareer[] = [];
  fechaFin: Date | null = null;
  infoGuardada: boolean = false;
  modoEdicion: boolean = false;
  idEdicion: string = '';

  modal: ModalState = {
    visible: false,
    tipo: 'success',
    icono: '✅',
    titulo: '',
    mensaje: '',
    confirmacion: false
  };

  private accionPendiente: (() => void) | null = null;

  constructor(
    private router: Router,
    private calCareerService: CalCareerService,
    private careerService: CareerService,
    private typeCareerService: TypeCareerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCareers();
    this.loadTypeCareers();
    this.loadCalCareers();
  }

  // ── Modal helpers ──────────────────────────────────────────

  mostrarModal(
    tipo: 'success' | 'warning' | 'error',
    titulo: string,
    mensaje: string,
    confirmacion = false,
    accion?: () => void
  ): void {
    const iconos = { success: '✅', warning: '⚠️', error: '❌' };
    this.modal = { visible: true, tipo, icono: iconos[tipo], titulo, mensaje, confirmacion };
    this.accionPendiente = accion ?? null;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modal.visible = false;
    this.accionPendiente = null;
    this.cdr.detectChanges();
  }

  confirmarAccion(): void {
    this.modal.visible = false;
    if (this.accionPendiente) {
      const accion = this.accionPendiente;
      this.accionPendiente = null;
      accion();
    }
    this.cdr.detectChanges();
  }

  // ── Carga de datos ─────────────────────────────────────────

  loadCareers(): void {
    this.careerService.obtenerCarreras().subscribe({
      next: (data) => { this.careers = data; this.cdr.detectChanges(); },
      error: (err) => console.error('Error al cargar carreras:', err)
    });
  }

  loadTypeCareers(): void {
    this.typeCareerService.obtenerTipos().subscribe({
      next: (data) => { this.typeCareers = data; this.cdr.detectChanges(); },
      error: (err) => console.error('Error al cargar tipos:', err)
    });
  }

  loadCalCareers(): void {
    this.calCareerService.getAll().subscribe({
      next: (data) => {
        this.calCareers = data.map((item: any) => ({
          id: item.id,
          career: item.career,
          typeCareer: item.typeCareer,
          careerId: item.career?.id || '',
          typeCareerId: item.typeCareer?.id || '',
          fechaActual: Array.isArray(item.fechaActual)
            ? new Date(item.fechaActual[0], item.fechaActual[1] - 1, item.fechaActual[2])
            : new Date(item.fechaActual),
          fechaFin: Array.isArray(item.fechaFin)
            ? new Date(item.fechaFin[0], item.fechaFin[1] - 1, item.fechaFin[2])
            : new Date(item.fechaFin)
        }));
        this.cdr.detectChanges();
      },
      error: (err) => console.error('❌ Error al cargar calculadas:', err)
    });
  }

  // ── Lógica del formulario ──────────────────────────────────

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
      this.mostrarModal('warning', 'Campos incompletos', 'Todos los campos son obligatorios.');
      return;
    }

    const payload = {
      career: { id: this.calCareer.careerId },
      typeCareer: { id: this.calCareer.typeCareerId },
      fechaActual: this.calCareer.fechaActual,
      fechaFin: this.calCareer.fechaFin
    };

    if (this.modoEdicion) {
      this.calCareerService.update(this.idEdicion, payload as any).subscribe({
        next: () => {
          this.mostrarModal('success', 'Actualizado', 'Información actualizada correctamente.');
          this.cancelarEdicion();
          this.loadCalCareers();
        },
        error: (err) => {
          console.error('❌ Error al actualizar:', err);
          this.mostrarModal('error', 'Error al actualizar', 'Hubo un problema al actualizar. Intenta nuevamente.');
        }
      });
    } else {
      this.calCareerService.create(payload).subscribe({
        next: () => {
          this.mostrarModal('success', 'Guardado', 'Información guardada correctamente.');
          this.infoGuardada = true;
          this.limpiarFormulario();
          this.loadCalCareers();
        },
        error: (err) => {
          console.error('❌ Error al guardar:', err);
          this.mostrarModal('error', 'Error al guardar', 'Hubo un problema al guardar. Intenta nuevamente.');
        }
      });
    }
  }

  limpiarFormulario(): void {
    this.calCareer = { careerId: "", typeCareerId: "", fechaActual: "", fechaFin: "" };
    this.fechaFin = null;
    this.cdr.detectChanges();
  }

  editarCarrera(carrera: any): void {
    this.modoEdicion = true;
    this.idEdicion = carrera.id;

    const fechaActualStr = carrera.fechaActual instanceof Date
      ? carrera.fechaActual.toISOString().split('T')[0]
      : carrera.fechaActual;

    const fechaFinStr = carrera.fechaFin instanceof Date
      ? carrera.fechaFin.toISOString().split('T')[0]
      : carrera.fechaFin;

    this.calCareer = {
      careerId: carrera.career?.id || '',
      typeCareerId: carrera.typeCareer?.id || '',
      fechaActual: fechaActualStr,
      fechaFin: fechaFinStr
    };

    this.fechaFin = carrera.fechaFin instanceof Date ? carrera.fechaFin : new Date(carrera.fechaFin);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  eliminarCarrera(id: string): void {
    this.mostrarModal(
      'warning',
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar esta carrera calculada? Esta acción no se puede deshacer.',
      true,
      () => {
        this.calCareerService.delete(id).subscribe({
          next: () => {
            this.mostrarModal('success', 'Eliminado', 'Carrera eliminada correctamente.');
            this.loadCalCareers();
          },
          error: (err) => {
            console.error('❌ Error al eliminar:', err);
            this.mostrarModal('error', 'Error al eliminar', 'Hubo un problema al eliminar la carrera. Intenta nuevamente.');
          }
        });
      }
    );
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.idEdicion = '';
    this.limpiarFormulario();
  }

  getTsuCareers(): any[] {
    return this.calCareers.filter(c => c.typeCareer?.tipo?.toLowerCase() === 'tsu');
  }

  getSuperiorCareers(): any[] {
    return this.calCareers.filter(c => c.typeCareer?.tipo?.toLowerCase() === 'superior');
  }

  redirigir(): void { this.router.navigate(['/vista']); }
  redirigirTsu(): void { this.router.navigate(['/tsu']); }
}