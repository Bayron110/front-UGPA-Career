import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TypeCareer } from '../../Interface/TypeCareer';
import { HttpErrorResponse } from '@angular/common/http';
import { TypeCareerService } from '../../services/type-career-services';


@Component({
  selector: 'app-tipo-carrera',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tipo-carrera.html',
  styleUrls: ['./tipo-carrera.css'] 
  
})
export class TipoCarrera {
  carrera: TypeCareer = {
    tipo: '',
    duracion: 0
  };

  mensaje: string = '';

  constructor(private typeCareerServices: TypeCareerService) {}

  guardarCarrera(): void {
    if (!this.carrera.tipo || this.carrera.duracion <= 0) {
      this.mensaje = 'Todos los campos son obligatorios y deben ser válidos.';
      alert(this.mensaje);
      return;
    }

    this.typeCareerServices.guardarTipoCarrera(this.carrera).subscribe({
      next: () => {
        this.mensaje = '✅ Tipo de carrera guardado exitosamente';
        alert(this.mensaje);
        this.carrera = { tipo: '', duracion: 0 };
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 0) {
          this.mensaje = '🔌 No se pudo conectar con el servidor. Verifica tu conexión.';
        } else if (error.status === 400) {
          this.mensaje = '⚠️ Datos inválidos. Revisa los campos.';
        } else if (error.status === 500) {
          this.mensaje = '❗ Ya existe este tipo de carrera. Por favor edita o elimina el existente.';
        } else {
          this.mensaje = `❌ Error inesperado (${error.status}). Intenta nuevamente.`;
        }

        console.error('Error al guardar carrera:', {
          status: error.status,
          message: error.message,
          backend: error.error
        });

        alert(this.mensaje);
      }
    });
  }
}
