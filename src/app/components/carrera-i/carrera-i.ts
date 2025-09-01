import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
export class CarreraI {
  nombreCarrera = '';

  constructor(private careerService: CareerService) {}

  guardarCarrera(form: any) {
    if (!this.nombreCarrera.trim()) {
      alert('⚠️ El nombre de la carrera no puede estar vacío');
      return;
    }

    const nuevaCarrera: Career = { nombre: this.nombreCarrera };

    this.careerService.guardarCarrera(nuevaCarrera).subscribe({
      next: () => {
        alert('✅ Carrera guardada exitosamente');
        this.nombreCarrera = '';
        form.reset();
      },
      error: (err) => {
        console.error('❌ Error completo:', err);
        const mensajeError =
          err.error?.message ||
          err.status === 500
            ? '❗ No se puede guardar dos veces la misma carrera.'
            : 'Ocurrió un error inesperado.';

        alert(`❌ Error al guardar la carrera: ${mensajeError}`);
      }
    });
  }
}
