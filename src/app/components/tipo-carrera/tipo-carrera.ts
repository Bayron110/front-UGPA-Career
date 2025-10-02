import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TypeCareer } from '../../Interface/TypeCareer';
import { HttpErrorResponse } from '@angular/common/http';
import { TypeCareerService } from '../../services/TypeCareer/type-career-services';

@Component({
  selector: 'app-tipo-carrera',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tipo-carrera.html',
  styleUrls: ['./tipo-carrera.css'] 
})
export class TipoCarrera implements OnInit {

  isLoading: boolean = false;

  carrera: TypeCareer = {
    tipo: '',
    duracion: 0
  };

  tiposGuardados: TypeCareer[] = [];
  tiposDesplegados: boolean = false;
  mostrarModal: boolean = false;
  tituloModal: string = '';
  mensajeModal: string = '';
  tipoModal: 'success' | 'error' | 'warning' | 'edit' | 'delete' = 'success';
  tipoEnEdicion: TypeCareer | null = null;
  tipoEditado: string = '';
  duracionEditada: number = 0;
  mensaje: string = '';

  constructor(private typeCareerServices: TypeCareerService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.obtenerTipos();
  }

  guardarCarrera(): void {
    if (!this.carrera.tipo || this.carrera.duracion <= 0) {
      this.abrirModal('Advertencia', '⚠️ Todos los campos son obligatorios y deben ser válidos.', 'warning');
      return;
    }

    this.typeCareerServices.guardarTipoCarrera(this.carrera).subscribe({
      next: () => {
        this.abrirModal('Éxito', '✅ Tipo de carrera guardado exitosamente', 'success');
        this.cdr.detectChanges();
        this.carrera = { tipo: '', duracion: 0 };
        this.obtenerTipos();
        
      },
      error: (error: HttpErrorResponse) => {
        let mensajeError = '';
        
        if (error.status === 0) {
          mensajeError = '🔌 No se pudo conectar con el servidor. Verifica tu conexión.';
        } else if (error.status === 400) {
          mensajeError = '⚠️ Datos inválidos. Revisa los campos.';
        } else if (error.status === 500) {
          mensajeError = '❗ Ya existe este tipo de carrera. Por favor edita o elimina el existente.';
        } else {
          mensajeError = `❌ Error inesperado (${error.status}). Intenta nuevamente.`;
        }

        console.error('Error al guardar carrera:', {
          status: error.status,
          message: error.message,
          backend: error.error
        });

        this.abrirModal('Error', mensajeError, 'error');
      }
    });
  }

  obtenerTipos() {
    this.typeCareerServices.obtenerTipos().subscribe({
      next: (data) => {
        this.tiposGuardados = data;
      },
      error: (err) => {
        console.error('❌ Error al obtener tipos:', err);
        this.abrirModal('Error', 'No se pudieron cargar los tipos de carrera guardados.', 'error');
      }
    });
  }

  toggleTipos() {
    this.tiposDesplegados = !this.tiposDesplegados;
  }

  editarTipo(tipo: TypeCareer) {
    this.tipoEnEdicion = tipo;
    this.tipoEditado = tipo.tipo;
    this.duracionEditada = tipo.duracion;
    this.tituloModal = 'Editar Tipo de Carrera';
    this.mensajeModal = 'Modifica los datos del tipo de carrera:';
    this.tipoModal = 'edit';
    this.mostrarModal = true;
  }

  confirmarEdicion() {
    if (!this.tipoEditado.trim() || this.duracionEditada <= 0) {
      this.cerrarModal();
      this.abrirModal('Advertencia', '⚠️ Todos los campos son obligatorios y deben ser válidos', 'warning');
      return; 
    }

    if (this.tipoEnEdicion && this.tipoEnEdicion.id) {
      const tipoActualizado: TypeCareer = {
        ...this.tipoEnEdicion,
        tipo: this.tipoEditado.trim(),
        duracion: this.duracionEditada
        
      };
      
      this.isLoading=true;

      this.typeCareerServices.actualizarTipo(this.tipoEnEdicion.id, tipoActualizado).subscribe({
        next: () => {
          this.isLoading=false;
          this.cerrarModal();
          this.abrirModal('Éxito', '✅ Tipo de carrera actualizado exitosamente', 'success');
          this.cdr.detectChanges();
          this.obtenerTipos();
        },
        error: (err) => {
          this.isLoading=false;
          console.error('❌ Error al actualizar:', err);
          this.cerrarModal();
          this.abrirModal('Error', '❌ Error al actualizar el tipo de carrera', 'error');
        }
      });
    } else {
      this.isLoading=false;
      this.cerrarModal();
      this.abrirModal('Error', '❌ No se pudo identificar el tipo de carrera a actualizar', 'error');
    }
  }

  eliminarTipo(tipo: TypeCareer) {
    this.tipoEnEdicion = tipo;
    this.tituloModal = 'Confirmar Eliminación';
    this.mensajeModal = `¿Estás seguro de eliminar el tipo de carrera "${tipo.tipo}"?`;
    this.tipoModal = 'delete';
    this.mostrarModal = true;
  }

  confirmarEliminacion() {
  this.isLoading = true;

  if (this.tipoEnEdicion && this.tipoEnEdicion.id) {
    this.typeCareerServices.eliminarTipo(this.tipoEnEdicion.id).subscribe({
      next: () => {
        this.cerrarModal();
        this.abrirModal('Éxito', '✅ Tipo de carrera eliminado exitosamente', 'success');
        this.cdr.detectChanges();
        this.obtenerTipos();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ Error al eliminar:', err);
        this.cerrarModal();
        this.abrirModal('Error', '❌ Error al eliminar el tipo de carrera', 'error');
        
        this.isLoading = false;
      }
    });
  } else {
    this.cerrarModal();
    this.abrirModal('Error', '❌ No se pudo identificar el tipo de carrera a eliminar', 'error');
    this.isLoading = false; 
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
    this.tipoEnEdicion = null;
    this.tipoEditado = '';
    this.duracionEditada = 0;
  }
}