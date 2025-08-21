import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Career } from '../../Interface/Career';
import { CaeerService } from '../../services/caeer-service';

@Component({
  selector: 'app-carrera-i',
  imports: [CommonModule, FormsModule],
  templateUrl: './carrera-i.html',
  styleUrl: './carrera-i.css'
})
export class CarreraI {
  nombreCarrera = '';

  constructor(private careerService: CaeerService) {}

  guardarCarrera(form: any) {
    const nuevaCarrera: Career = { nombre: this.nombreCarrera };

    this.careerService.guardarCarrera(nuevaCarrera).subscribe({
      next: () => {
        alert("✅ Carrera guardada exitosamente");
        form.reset(); 
      },
      error: (err) => {
  console.error('❌ Error completo:', err);
  const mensajeError =
    err.error?.message ||
    err.status === 500
      ? 'No se puede Guardar Dos Veces la misma Carrera'
      : 'Ocurrió un error inesperado.';

  alert(`❌ Error al guardar la carrera: ${mensajeError}`);
}
    });
  }
}