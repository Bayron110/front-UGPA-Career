import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TypeCareerServices } from '../../services/type-career-services';
import { TypeCareer } from '../../Interface/TypeCareer';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-tipo-carrera',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tipo-carrera.html',
  styleUrl: './tipo-carrera.css'
})
export class TipoCarrera {
  carrera: TypeCareer = {
    tipo: '',
    duracion: 0
  };

  mensaje: string = '';

  constructor(private typeCareerServices: TypeCareerServices) {}

  guardarCarrera(): void {
    this.typeCareerServices.guardar(this.carrera).subscribe({
      next: () => {
        this.mensaje = 'Tipo guardada exitosamente ✅';
        alert(this.mensaje);
        this.carrera = { tipo: '', duracion: 0 };
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 0) {
          this.mensaje = 'No se pudo conectar con el servidor. Verifica tu conexión 🔌';
        } else if (error.status === 400) {
          this.mensaje = 'Datos inválidos. Revisa los campos del formulario ⚠️';
        } else if (error.status === 500) {
          this.mensaje = 'Ya tienes un tipo guardado porfavor edita o elimana ese dato';
        } else {
          this.mensaje = `Error inesperado (${error.status}). Intenta nuevamente ❌`;
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