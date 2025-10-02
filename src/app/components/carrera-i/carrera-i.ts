import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Career } from '../../Interface/Career';
import { CareerService } from '../../services/Career/caeer-service';

@Component({
  selector: 'app-carrera-i',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carrera-i.html',
  styleUrls: ['./carrera-i.css'] 
})
export class CarreraI implements OnInit {
  nombreCarrera = '';
  carrerasGuardadas: Career[] = [];
  carrerasDesplegadas: boolean = false;
  
  mostrarModal: boolean = false;
  tituloModal: string = '';
  mensajeModal: string = '';
  tipoModal: 'success' | 'error' | 'warning' | 'edit' | 'delete' = 'success';
  carreraEnEdicion: Career | null = null;
  nombreEditado: string = '';

  constructor(private careerService: CareerService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.obtenerCarreras();
  }

  guardarCarrera(form: any) {
    if (!this.nombreCarrera.trim()) {
      this.abrirModal('Advertencia', '⚠️ El nombre de la carrera no puede estar vacío', 'warning');
      return;
    }

    const nuevaCarrera: Career = { nombre: this.nombreCarrera };

    this.careerService.guardarCarrera(nuevaCarrera).subscribe({
      next: () => {
        this.abrirModal('Éxito', '✅ Carrera guardada exitosamente', 'success');
        this.nombreCarrera = '';
        form.reset();
        this.obtenerCarreras();
      },
      error: (err) => {
        console.error('❌ Error completo:', err);
        const mensajeError =
          err.error?.message ||
          err.status === 500
            ? 'No se puede guardar dos veces la misma carrera.'
            : 'Ocurrió un error inesperado.';

        this.abrirModal('Error', `❌ ${mensajeError}`, 'error');
      }
    });
  }

  obtenerCarreras() {
    this.careerService.obtenerCarreras().subscribe({
      next: (data) => {
        this.carrerasGuardadas = data;
      },
      error: (err) => {
        console.error('❌ Error al obtener carreras:', err);
        this.abrirModal('Error', 'No se pudieron cargar las carreras guardadas.', 'error');
      }
    });
  }

  toggleCarreras() {
    this.carrerasDesplegadas = !this.carrerasDesplegadas;
  }

  editarCarrera(carrera: Career) {
    this.carreraEnEdicion = carrera;
    this.nombreEditado = carrera.nombre;
    this.tituloModal = 'Editar Carrera';
    this.mensajeModal = 'Modifica el nombre de la carrera:';
    this.tipoModal = 'edit';
    this.mostrarModal = true;
  }

  confirmarEdicion() {
    if (!this.nombreEditado.trim()) {
      this.abrirModal('Advertencia', '⚠️ El nombre no puede estar vacío', 'warning');
      return;
    }

    if (this.carreraEnEdicion && this.carreraEnEdicion.id) {
      const carreraActualizada: Career = {
        ...this.carreraEnEdicion,
        nombre: this.nombreEditado.trim()
      };

      this.careerService.actualizarCarrera(this.carreraEnEdicion.id, carreraActualizada).subscribe({
        next: () => {
          this.cerrarModal();
          this.abrirModal('Éxito', '✅ Carrera actualizada exitosamente', 'success');
          this.cdr.detectChanges();
          this.obtenerCarreras();
        },
        error: (err) => {
          console.error('❌ Error al actualizar:', err);
          this.cerrarModal();
          this.abrirModal('Error', '❌ Error al actualizar la carrera', 'error');
        }
      });
    }
  }

  eliminarCarrera(carrera: Career) {
    this.carreraEnEdicion = carrera;
    this.tituloModal = 'Confirmar Eliminación';
    this.mensajeModal = `¿Estás seguro de eliminar la carrera "${carrera.nombre}"?`;
    this.tipoModal = 'delete';
    this.mostrarModal = true;
  }

  confirmarEliminacion() {
    if (this.carreraEnEdicion && this.carreraEnEdicion.id) {
      this.careerService.eliminarCarrera(this.carreraEnEdicion.id).subscribe({
        next: () => {
          this.cerrarModal();
          this.abrirModal('Éxito', '✅ Carrera eliminada exitosamente', 'success');
          this.cdr.detectChanges();
          this.obtenerCarreras();
        },
        error: (err) => {
          console.error('❌ Error al eliminar:', err);
          this.cerrarModal();
          this.abrirModal('Error', '❌ Error al eliminar la carrera', 'error');
        }
      });
    }
  }

  abrirModal(titulo: string, mensaje: string, tipo: 'success' | 'error' | 'warning' | 'edit' | 'delete') {
    this.tituloModal = titulo;
    this.mensajeModal = mensaje;
    this.tipoModal = tipo;
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.carreraEnEdicion = null;
    this.nombreEditado = '';
  }
}