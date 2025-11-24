import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareerService } from '../../services/Career/caeer-service';
import { Career } from '../../Interface/Career';

@Component({
  selector: 'app-reporte-resultados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-resultados.html',
  styleUrl: './reporte-resultados.css'
})
export class ReporteResultados implements OnInit {

  carrerasGuardadas: Career[] = [];
  cargando = false;
  modalAbierto = false;
  carreraSeleccionada: Career | null = null;

  // Datos del formulario
  nombreCompleto = '';
  formacion = '';
  universidad = '';

  constructor(private careerService: CareerService) {}

  ngOnInit(): void {
    this.obtenerCarreras();
  }

  obtenerCarreras() {
    this.cargando = true;
    this.careerService.obtenerCarreras().subscribe({
      next: (data) => {
        this.carrerasGuardadas = data;
        this.cargando = false;
      },
      error: (err) => {
        console.error('❌ Error al obtener carreras:', err);
        this.cargando = false;
      }
    });
  }

  abrirModal(carrera: Career) {
    this.carreraSeleccionada = carrera;
    this.modalAbierto = true;
    // Limpiar formulario
    this.nombreCompleto = '';
    this.formacion = '';
    this.universidad = '';
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.carreraSeleccionada = null;
  }

  guardarDocente() {
    // Aquí iría la lógica para guardar el docente
    console.log('Guardar docente:', {
      carrera: this.carreraSeleccionada?.nombre,
      nombreCompleto: this.nombreCompleto,
      formacion: this.formacion,
      universidad: this.universidad
    });
    this.cerrarModal();
  }
}