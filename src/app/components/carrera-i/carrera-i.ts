import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Career } from '../../Interface/Career';
import { Capacitacion } from '../../Interface/Capacitacion';
import { CareerService } from '../../services/Career/caeer-service';

@Component({
  selector: 'app-carrera-i',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carrera-i.html',
  styleUrls: ['./carrera-i.css'] 
})
export class CarreraI implements OnInit {
  // ⭐ PASO 1: Crear la carrera (solo nombre)
  nombreCarrera: string = '';
  carreraActual: Career | null = null;
  
  // ⭐ PASO 2: Agregar capacitaciones a la carrera actual
  nombreCapacitacion: string = '';
  horasCapacitacion: number | null = null;
  duracionCapacitacion: string = '';
  periodoCapacitacion: string = '';
  tipoCapacitacion: string = '';
  
  // Lista de carreras guardadas
  carrerasGuardadas: Career[] = [];
  carrerasDesplegadas: boolean = false;
  
  // Control del modal
  mostrarModal: boolean = false;
  tituloModal: string = '';
  mensajeModal: string = '';
  tipoModal: 'success' | 'error' | 'warning' | 'edit' | 'delete' | 'edit-capacitacion' = 'success';
  
  // Datos de edición
  carreraEnEdicion: Career | null = null;
  nombreEditado: string = '';
  
  capacitacionEnEdicion: Capacitacion | null = null;
  indiceCapacitacionEdicion: number = -1;
  nombreCapacitacionEditada: string = '';
  horasCapacitacionEditada: number | null = null;
  duracionCapacitacionEditada: string = '';
  periodoCapacitacionEditado: string = '';
  tipoCapacitacionEditado: string = '';

  constructor(
    private careerService: CareerService, 
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.obtenerCarreras();
  }

  // ========== GESTIÓN DE CARRERA ==========

  crearCarrera(): void {
    if (!this.nombreCarrera.trim()) {
      this.abrirModal('Advertencia', '⚠️ El nombre de la carrera no puede estar vacío', 'warning');
      return;
    }

    // Crear carrera vacía (sin capacitaciones aún)
    this.carreraActual = {
      nombre: this.nombreCarrera.trim(),
      capacitaciones: []
    };

    this.abrirModal('Éxito', `✅ Carrera "${this.nombreCarrera}" creada. Ahora agrega capacitaciones.`, 'success');
  }

  // ========== GESTIÓN DE CAPACITACIONES ==========

  agregarCapacitacion(): void {
    if (!this.carreraActual) {
      this.abrirModal('Advertencia', '⚠️ Primero debes crear una carrera', 'warning');
      return;
    }

    // Validaciones
    if (!this.nombreCapacitacion.trim()) {
      this.abrirModal('Advertencia', '⚠️ El nombre de la capacitación no puede estar vacío', 'warning');
      return;
    }

    if (!this.horasCapacitacion || this.horasCapacitacion < 30) {
      this.abrirModal('Advertencia', '⚠️ Las horas deben ser mínimo 30', 'warning');
      return;
    }

    if (!this.duracionCapacitacion.trim()) {
      this.abrirModal('Advertencia', '⚠️ La duración no puede estar vacía', 'warning');
      return;
    }

    if (!this.periodoCapacitacion.trim()) {
      this.abrirModal('Advertencia', '⚠️ El periodo no puede estar vacío', 'warning');
      return;
    }

    if (!this.tipoCapacitacion.trim()) {
      this.abrirModal('Advertencia', '⚠️ El tipo no puede estar vacío', 'warning');
      return;
    }

    // Crear objeto capacitación
    const nuevaCapacitacion: Capacitacion = {
      nombre: this.nombreCapacitacion.trim(),
      horas: this.horasCapacitacion,
      duracion: this.duracionCapacitacion.trim(),
      periodo: this.periodoCapacitacion.trim(),
      tipo: this.tipoCapacitacion.trim()
    };

    // Agregar a la carrera actual
    this.carreraActual.capacitaciones.push(nuevaCapacitacion);

    // Limpiar campos de capacitación
    this.limpiarFormularioCapacitacion();

    this.abrirModal('Éxito', `✅ Capacitación "${nuevaCapacitacion.nombre}" agregada`, 'success');
  }

  eliminarCapacitacionTemporal(index: number): void {
    if (this.carreraActual && index >= 0 && index < this.carreraActual.capacitaciones.length) {
      const nombreCap = this.carreraActual.capacitaciones[index].nombre;
      this.carreraActual.capacitaciones.splice(index, 1);
      this.abrirModal('Éxito', `✅ Capacitación "${nombreCap}" eliminada`, 'success');
    }
  }

  guardarCarreraCompleta(): void {
    if (!this.carreraActual) {
      this.abrirModal('Advertencia', '⚠️ No hay carrera para guardar', 'warning');
      return;
    }

    if (this.carreraActual.capacitaciones.length === 0) {
      this.abrirModal('Advertencia', '⚠️ Debes agregar al menos una capacitación', 'warning');
      return;
    }

    // Guardar en el backend
    this.careerService.guardarCarrera(this.carreraActual).subscribe({
      next: (response) => {
        this.abrirModal('Éxito', '✅ Carrera guardada exitosamente con todas sus capacitaciones', 'success');
        this.resetFormularioCompleto();
        this.obtenerCarreras();
      },
      error: (err) => {
        console.error('❌ Error completo:', err);
        const mensajeError = err.error?.message || 
          (err.status === 500 ? 'No se puede guardar dos veces la misma carrera.' : 'Ocurrió un error inesperado.');
        this.abrirModal('Error', `❌ ${mensajeError}`, 'error');
        
      }
    });
  }

  // ========== CRUD OPERACIONES ==========

  obtenerCarreras(): void {
    this.careerService.obtenerCarreras().subscribe({
      next: (data: Career[]) => {
        this.carrerasGuardadas = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al obtener carreras:', err);
        this.abrirModal('Error', '❌ No se pudieron cargar las carreras guardadas.', 'error');
      }
    });
  }

  editarCarrera(carrera: Career): void {
    this.carreraEnEdicion = { ...carrera };
    this.nombreEditado = carrera.nombre;
    
    this.tituloModal = 'Editar Carrera';
    this.mensajeModal = 'Modifica el nombre de la carrera:';
    this.tipoModal = 'edit';
    this.mostrarModal = true;
  }

  confirmarEdicionCarrera(): void {
    if (!this.nombreEditado.trim()) {
      this.abrirModal('Advertencia', '⚠️ El nombre no puede estar vacío', 'warning');
      return;
    }

    if (!this.carreraEnEdicion || !this.carreraEnEdicion.id) {
      this.abrirModal('Error', '❌ Error: No se encontró la carrera a editar', 'error');
      return;
    }

    const carreraActualizada: Career = {
      ...this.carreraEnEdicion,
      nombre: this.nombreEditado.trim()
    };

    this.careerService.actualizarCarrera(this.carreraEnEdicion.id, carreraActualizada).subscribe({
      next: (response) => {
        this.cerrarModal();
        this.abrirModal('Éxito', '✅ Carrera actualizada exitosamente', 'success');
        this.obtenerCarreras();
      },
      error: (err) => {
        console.error('❌ Error al actualizar:', err);
        this.cerrarModal();
        this.abrirModal('Error', '❌ Error al actualizar la carrera', 'error');
      }
    });
  }

  editarCapacitacion(carrera: Career, capacitacion: Capacitacion, index: number): void {
    this.carreraEnEdicion = { ...carrera };
    this.capacitacionEnEdicion = { ...capacitacion };
    this.indiceCapacitacionEdicion = index;
    
    this.nombreCapacitacionEditada = capacitacion.nombre;
    this.horasCapacitacionEditada = capacitacion.horas;
    this.duracionCapacitacionEditada = capacitacion.duracion;
    this.periodoCapacitacionEditado = capacitacion.periodo;
    this.tipoCapacitacionEditado = capacitacion.tipo;
    
    this.tituloModal = 'Editar Capacitación';
    this.mensajeModal = 'Modifica los datos de la capacitación:';
    this.tipoModal = 'edit-capacitacion';
    this.mostrarModal = true;
  }

  confirmarEdicionCapacitacion(): void {
    if (!this.nombreCapacitacionEditada.trim()) {
      this.abrirModal('Advertencia', '⚠️ El nombre no puede estar vacío', 'warning');
      return;
    }

    if (!this.horasCapacitacionEditada || this.horasCapacitacionEditada < 30) {
      this.abrirModal('Advertencia', '⚠️ Las horas deben ser mínimo 30', 'warning');
      return;
    }

    if (!this.carreraEnEdicion || !this.carreraEnEdicion.id) {
      this.abrirModal('Error', '❌ Error: No se encontró la carrera', 'error');
      return;
    }

    // Actualizar la capacitación en el array
    const carreraActualizada = { ...this.carreraEnEdicion };
    carreraActualizada.capacitaciones[this.indiceCapacitacionEdicion] = {
      nombre: this.nombreCapacitacionEditada.trim(),
      horas: this.horasCapacitacionEditada,
      duracion: this.duracionCapacitacionEditada.trim(),
      periodo: this.periodoCapacitacionEditado.trim(),
      tipo: this.tipoCapacitacionEditado.trim()
    };

    this.careerService.actualizarCarrera(this.carreraEnEdicion.id, carreraActualizada).subscribe({
      next: (response) => {
        this.cerrarModal();
        this.abrirModal('Éxito', '✅ Capacitación actualizada exitosamente', 'success');
        this.obtenerCarreras();
      },
      error: (err) => {
        console.error('❌ Error al actualizar:', err);
        this.cerrarModal();
        this.abrirModal('Error', '❌ Error al actualizar la capacitación', 'error');
      }
    });
  }

  eliminarCapacitacion(carrera: Career, index: number): void {
    if (!carrera.id) return;

    const nombreCap = carrera.capacitaciones[index].nombre;
    const carreraActualizada = { ...carrera };
    carreraActualizada.capacitaciones.splice(index, 1);

    this.careerService.actualizarCarrera(carrera.id, carreraActualizada).subscribe({
      next: (response) => {
        this.abrirModal('Éxito', `✅ Capacitación "${nombreCap}" eliminada`, 'success');
        this.obtenerCarreras();
      },
      error: (err) => {
        console.error('❌ Error al eliminar capacitación:', err);
        this.abrirModal('Error', '❌ Error al eliminar la capacitación', 'error');
      }
    });
  }

  eliminarCarrera(carrera: Career): void {
    this.carreraEnEdicion = carrera;
    this.tituloModal = 'Confirmar Eliminación';
    this.mensajeModal = `¿Estás seguro de eliminar la carrera "${carrera.nombre}" con todas sus capacitaciones?`;
    this.tipoModal = 'delete';
    this.mostrarModal = true;
  }

  confirmarEliminacion(): void {
    if (!this.carreraEnEdicion || !this.carreraEnEdicion.id) {
      this.abrirModal('Error', '❌ Error: No se encontró la carrera a eliminar', 'error');
      return;
    }

    this.careerService.eliminarCarrera(this.carreraEnEdicion.id).subscribe({
      next: (response) => {
        this.cerrarModal();
        this.abrirModal('Éxito', '✅ Carrera eliminada exitosamente', 'success');
        this.obtenerCarreras();
      },
      error: (err) => {
        console.error('❌ Error al eliminar:', err);
        this.cerrarModal();
        this.abrirModal('Error', '❌ Error al eliminar la carrera', 'error');
      }
    });
  }

  // ========== CONTROL DE UI ==========

  toggleCarreras(): void {
    this.carrerasDesplegadas = !this.carrerasDesplegadas;
  }

  abrirModal(titulo: string, mensaje: string, tipo: 'success' | 'error' | 'warning' | 'edit' | 'delete' | 'edit-capacitacion'): void {
    this.tituloModal = titulo;
    this.mensajeModal = mensaje;
    this.tipoModal = tipo;
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.carreraEnEdicion = null;
    this.capacitacionEnEdicion = null;
    this.nombreEditado = '';
    this.nombreCapacitacionEditada = '';
    this.horasCapacitacionEditada = null;
    this.duracionCapacitacionEditada = '';
    this.periodoCapacitacionEditado = '';
    this.tipoCapacitacionEditado = '';
    this.indiceCapacitacionEdicion = -1;
  }

  limpiarFormularioCapacitacion(): void {
    this.nombreCapacitacion = '';
    this.horasCapacitacion = null;
    this.duracionCapacitacion = '';
    this.periodoCapacitacion = '';
    this.tipoCapacitacion = '';
  }

  resetFormularioCompleto(): void {
    this.nombreCarrera = '';
    this.carreraActual = null;
    this.limpiarFormularioCapacitacion();
  }

  cancelarCreacion(): void {
    if (this.carreraActual && this.carreraActual.capacitaciones.length > 0) {
      if (confirm('¿Estás seguro de cancelar? Se perderán todas las capacitaciones agregadas.')) {
        this.resetFormularioCompleto();
      }
    } else {
      this.resetFormularioCompleto();
    }
  }
}