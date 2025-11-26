import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareerService } from '../../services/Career/caeer-service';
import { Career } from '../../Interface/Career';
import { Docente } from '../../Interface/Docente';
import { DocenteService } from '../../services/docentes/docente';

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

  // Lista de docentes cargados
  docentes: Docente[] = [];

  constructor(
    private careerService: CareerService,
    private docenteService: DocenteService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.obtenerCarreras();
  }

  obtenerCarreras() {
    this.cargando = true;
    this.careerService.obtenerCarreras().subscribe({
      next: (data) => {
        this.carrerasGuardadas = data;
        this.cargando = false;
        this.cdr.detectChanges();
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
    this.nombreCompleto = '';

    // Cargar docentes de esa carrera
    this.docenteService.obtenerPorCarrera(carrera.id!).subscribe({
      next: (data) => {
        this.docentes = data;
      },
      error: (err) => {
        console.error('❌ Error al obtener docentes:', err);
      }
    });
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.carreraSeleccionada = null;
    this.docentes = [];
  }

  guardarDocente() {
    if (!this.carreraSeleccionada) return;

    const nuevoDocente: Docente = {
      nombre: this.nombreCompleto,
      carreraId: this.carreraSeleccionada.id!,
      participacionCapacitacion: false
    };

    this.docenteService.crearDocente(nuevoDocente).subscribe({
      next: (docenteGuardado) => {
        console.log('✅ Docente guardado:', docenteGuardado);
        this.docentes.push(docenteGuardado); // actualizar lista en el modal
        this.nombreCompleto = ''; // limpiar campo
      },
      error: (err) => {
        console.error('❌ Error al guardar docente:', err);
      }
    });
  }

  toggleParticipacion(docente: Docente) {
    this.docenteService.cambiarParticipacion(docente.id!).subscribe({
      next: (actualizado) => {
        docente.participacionCapacitacion = actualizado.participacionCapacitacion;
      },
      error: (err) => {
        console.error('❌ Error al cambiar participación:', err);
      }
    });
  }
}