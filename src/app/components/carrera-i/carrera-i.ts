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
  styleUrls: ['./carrera-i.css'],
  // Sin encapsulación para que el CSS externo del proyecto no tape los estilos del componente
  // Si quieres mantener encapsulación, usa ViewEncapsulation.Emulated (el default)
  // y asegúrate de que el CSS padre no tenga reglas que sobreescriban colores/fondos
})
export class CarreraI implements OnInit {

  // ── Formulario nueva carrera ──
  nombreCarrera: string = '';
  carreraActual: Career | null = null;

  // ── Formulario capacitación ──
  nombreCapacitacion: string = '';
  horasCapacitacion: number | null = null;
  duracionCapacitacion: string = '';
  periodoCapacitacion: string = '';
  tipoCapacitacion: string = '';

  // ── Lista y búsqueda ──
  carrerasGuardadas: Career[] = [];
  carrerasFiltradas: Career[] = [];   // <-- NUEVO: lista que se muestra en el HTML
  terminoBusqueda: string = '';        // <-- NUEVO: modelo del input de búsqueda
  carrerasDesplegadas: boolean = false;

  // ── Modal ──
  mostrarModal: boolean = false;
  tituloModal: string = '';
  mensajeModal: string = '';
  tipoModal: 'success' | 'error' | 'warning' | 'edit' | 'delete' | 'edit-capacitacion' | 'add-capacitacion' = 'success';

  // ── Edición carrera ──
  carreraEnEdicion: Career | null = null;
  nombreEditado: string = '';

  // ── Agregar capacitación desde lista ──
  carreraParaAgregar: Career | null = null;

  // ── Edición capacitación ──
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

  // ─────────────────────────────────────────
  // Búsqueda
  // ─────────────────────────────────────────

  filtrarCarreras(): void {
    const termino = this.terminoBusqueda.trim().toLowerCase();
    if (!termino) {
      this.carrerasFiltradas = [...this.carrerasGuardadas];
    } else {
      this.carrerasFiltradas = this.carrerasGuardadas.filter(c =>
        c.nombre.toLowerCase().includes(termino)
      );
    }
  }

  // ─────────────────────────────────────────
  // Crear carrera (paso 1)
  // ─────────────────────────────────────────

  crearCarrera(): void {
    if (!this.nombreCarrera.trim()) {
      this.abrirModal('Advertencia', '⚠️ El nombre de la carrera no puede estar vacío', 'warning');
      return;
    }
    this.carreraActual = {
      nombre: this.nombreCarrera.trim(),
      capacitaciones: []
    };
    this.abrirModal('Éxito', `✅ Carrera "${this.nombreCarrera}" creada. Ahora agrega capacitaciones.`, 'success');
  }

  // ─────────────────────────────────────────
  // Agregar capacitación temporal
  // ─────────────────────────────────────────

  agregarCapacitacion(): void {
    if (!this.carreraActual) {
      this.abrirModal('Advertencia', '⚠️ Primero debes crear una carrera', 'warning');
      return;
    }
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

    const nuevaCapacitacion: Capacitacion = {
      nombre: this.nombreCapacitacion.trim(),
      horas: this.horasCapacitacion,
      duracion: this.duracionCapacitacion.trim(),
      periodo: this.periodoCapacitacion.trim(),
      tipo: this.tipoCapacitacion.trim()
    };

    this.carreraActual.capacitaciones.push(nuevaCapacitacion);
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

  // ─────────────────────────────────────────
  // Guardar carrera completa
  // ─────────────────────────────────────────

  guardarCarreraCompleta(): void {
    if (!this.carreraActual) {
      this.abrirModal('Advertencia', '⚠️ No hay carrera para guardar', 'warning');
      return;
    }
    if (this.carreraActual.capacitaciones.length === 0) {
      this.abrirModal('Advertencia', '⚠️ Debes agregar al menos una capacitación', 'warning');
      return;
    }

    this.careerService.guardarCarrera(this.carreraActual).subscribe({
      next: () => {
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

  // ─────────────────────────────────────────
  // Agregar capacitación desde la lista
  // ─────────────────────────────────────────

  agregarNuevaCapacitacion(carrera: Career): void {
    this.carreraParaAgregar = { ...carrera };
    this.nombreCapacitacionEditada = '';
    this.horasCapacitacionEditada = null;
    this.duracionCapacitacionEditada = '';
    this.periodoCapacitacionEditado = '';
    this.tipoCapacitacionEditado = '';

    this.tituloModal = 'Agregar Nueva Capacitación';
    this.mensajeModal = `Ingresa los datos de la nueva capacitación para la carrera "${carrera.nombre}"`;
    this.tipoModal = 'add-capacitacion';
    this.mostrarModal = true;
  }

  confirmarAgregarCapacitacion(): void {
    if (!this.nombreCapacitacionEditada.trim()) {
      this.abrirModal('Advertencia', '⚠️ El nombre no puede estar vacío', 'warning');
      return;
    }
    if (!this.horasCapacitacionEditada || this.horasCapacitacionEditada < 30) {
      this.abrirModal('Advertencia', '⚠️ Las horas deben ser mínimo 30', 'warning');
      return;
    }
    if (!this.duracionCapacitacionEditada.trim()) {
      this.abrirModal('Advertencia', '⚠️ La duración no puede estar vacía', 'warning');
      return;
    }
    if (!this.periodoCapacitacionEditado.trim()) {
      this.abrirModal('Advertencia', '⚠️ El periodo no puede estar vacío', 'warning');
      return;
    }
    if (!this.tipoCapacitacionEditado.trim()) {
      this.abrirModal('Advertencia', '⚠️ El tipo no puede estar vacío', 'warning');
      return;
    }
    if (!this.carreraParaAgregar || !this.carreraParaAgregar.id) {
      this.abrirModal('Error', '❌ Error: No se encontró la carrera', 'error');
      return;
    }

    const nuevaCapacitacion: Capacitacion = {
      nombre: this.nombreCapacitacionEditada.trim(),
      horas: this.horasCapacitacionEditada,
      duracion: this.duracionCapacitacionEditada.trim(),
      periodo: this.periodoCapacitacionEditado.trim(),
      tipo: this.tipoCapacitacionEditado.trim()
    };

    const carreraActualizada = { ...this.carreraParaAgregar };
    carreraActualizada.capacitaciones = [...carreraActualizada.capacitaciones, nuevaCapacitacion];

    this.careerService.actualizarCarrera(this.carreraParaAgregar.id, carreraActualizada).subscribe({
      next: () => {
        this.cerrarModal();
        this.abrirModal('Éxito', '✅ Capacitación agregada exitosamente', 'success');
        this.obtenerCarreras();
      },
      error: (err) => {
        console.error('❌ Error al agregar capacitación:', err);
        this.cerrarModal();
        this.abrirModal('Error', '❌ Error al agregar la capacitación', 'error');
      }
    });
  }

  // ─────────────────────────────────────────
  // Obtener carreras
  // ─────────────────────────────────────────

  obtenerCarreras(): void {
    this.careerService.obtenerCarreras().subscribe({
      next: (data: Career[]) => {
        this.carrerasGuardadas = data;
        this.filtrarCarreras(); // sincroniza lista filtrada
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al obtener carreras:', err);
        this.abrirModal('Error', '❌ No se pudieron cargar las carreras guardadas.', 'error');
      }
    });
  }

  // ─────────────────────────────────────────
  // Editar carrera
  // ─────────────────────────────────────────

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
      next: () => {
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

  // ─────────────────────────────────────────
  // Editar capacitación
  // ─────────────────────────────────────────

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

    const carreraActualizada = { ...this.carreraEnEdicion };
    carreraActualizada.capacitaciones = [...carreraActualizada.capacitaciones];
    carreraActualizada.capacitaciones[this.indiceCapacitacionEdicion] = {
      nombre: this.nombreCapacitacionEditada.trim(),
      horas: this.horasCapacitacionEditada,
      duracion: this.duracionCapacitacionEditada.trim(),
      periodo: this.periodoCapacitacionEditado.trim(),
      tipo: this.tipoCapacitacionEditado.trim()
    };

    this.careerService.actualizarCarrera(this.carreraEnEdicion.id, carreraActualizada).subscribe({
      next: () => {
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

  // ─────────────────────────────────────────
  // Eliminar capacitación
  // ─────────────────────────────────────────

  eliminarCapacitacion(carrera: Career, index: number): void {
    if (!carrera.id) return;

    const nombreCap = carrera.capacitaciones[index].nombre;
    const carreraActualizada = { ...carrera };
    carreraActualizada.capacitaciones = [...carreraActualizada.capacitaciones];
    carreraActualizada.capacitaciones.splice(index, 1);

    this.careerService.actualizarCarrera(carrera.id, carreraActualizada).subscribe({
      next: () => {
        this.abrirModal('Éxito', `✅ Capacitación "${nombreCap}" eliminada`, 'success');
        this.obtenerCarreras();
      },
      error: (err) => {
        console.error('❌ Error al eliminar capacitación:', err);
        this.abrirModal('Error', '❌ Error al eliminar la capacitación', 'error');
      }
    });
  }

  // ─────────────────────────────────────────
  // Eliminar carrera
  // ─────────────────────────────────────────

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
      next: () => {
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

  // ─────────────────────────────────────────
  // Helpers modal
  // ─────────────────────────────────────────

  toggleCarreras(): void {
    this.carrerasDesplegadas = !this.carrerasDesplegadas;
  }

  abrirModal(
    titulo: string,
    mensaje: string,
    tipo: 'success' | 'error' | 'warning' | 'edit' | 'delete' | 'edit-capacitacion' | 'add-capacitacion'
  ): void {
    this.tituloModal = titulo;
    this.mensajeModal = mensaje;
    this.tipoModal = tipo;
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.carreraEnEdicion = null;
    this.carreraParaAgregar = null;
    this.capacitacionEnEdicion = null;
    this.nombreEditado = '';
    this.nombreCapacitacionEditada = '';
    this.horasCapacitacionEditada = null;
    this.duracionCapacitacionEditada = '';
    this.periodoCapacitacionEditado = '';
    this.tipoCapacitacionEditado = '';
    this.indiceCapacitacionEdicion = -1;
  }

  // ─────────────────────────────────────────
  // Helpers formulario
  // ─────────────────────────────────────────

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