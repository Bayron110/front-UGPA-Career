import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstudianteDefensa } from '../../defensas-estudiantes';

export interface DatosDefensa {
  aula: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  sede: string;
  cedula: string;
  nombre: string;
  carrera: string;
  tribunal1: string;
  tribunal2: string;
  tribunal3: string;
  notaDefensa: number | null;
}

@Component({
  selector: 'app-programar-defensa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './programar-defensa.html',
  styleUrl: './programar-defensa.css'
})
export class ProgramarDefensa {

  @Input() estudiante: EstudianteDefensa | null = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() defensaProgramada = new EventEmitter<DatosDefensa>();

  guardando = false;
  errorGuardado = '';

  datosDefensa: DatosDefensa = {
    aula: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    sede: '',
    cedula: '',
    nombre: '',
    carrera: '',
    tribunal1: '',
    tribunal2: '',
    tribunal3: '',
    notaDefensa: null
  };

  ngOnInit(): void {
    // Autocompletar datos que ya vienen del estudiante seleccionado
    if (this.estudiante) {
      this.datosDefensa.cedula = this.estudiante.cedula;
      this.datosDefensa.nombre = this.estudiante.nombres;
      this.datosDefensa.carrera = this.estudiante.carrera;
    }
  }

  cerrarModal(): void {
    this.cerrar.emit();
  }

  camposObligatoriosCompletos(): boolean {
    const d = this.datosDefensa;
    return !!(
      d.aula.trim() &&
      d.fecha &&
      d.horaInicio &&
      d.horaFin &&
      d.sede.trim() &&
      d.tribunal1.trim() &&
      d.tribunal2.trim() &&
      d.tribunal3.trim()
    );
  }

  horaFinValida(): boolean {
    const { horaInicio, horaFin } = this.datosDefensa;
    if (!horaInicio || !horaFin) return true; // aún no se ha llenado, no marcar error
    return horaFin > horaInicio;
  }

  async guardarDefensa(): Promise<void> {
    this.errorGuardado = '';

    if (!this.camposObligatoriosCompletos()) {
      this.errorGuardado = 'Completa todos los campos obligatorios antes de guardar.';
      return;
    }

    if (!this.horaFinValida()) {
      this.errorGuardado = 'La hora de fin debe ser posterior a la hora de inicio.';
      return;
    }

    this.guardando = true;

    try {
      // 👉 AQUÍ va la llamada a tu servicio para guardar en Firebase (RTDB o Firestore)
      // Ejemplo: await this.defensaService.guardar(this.datosDefensa);

      this.defensaProgramada.emit(this.datosDefensa);
      this.cerrar.emit();
    } catch (err) {
      console.error('Error al guardar la defensa:', err);
      this.errorGuardado = 'No se pudo guardar la defensa. Intenta de nuevo.';
    } finally {
      this.guardando = false;
    }
  }
}