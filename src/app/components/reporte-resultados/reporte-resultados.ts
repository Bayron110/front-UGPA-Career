import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareerService } from '../../services/Career/caeer-service';
import { Career } from '../../Interface/Career';
import { Docente } from '../../Interface/Docente';
import { DocenteService } from '../../services/docentes/docente';
import { Capacitacion } from '../../Interface/Capacitacion';

@Component({
  selector: 'app-reporte-resultados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-resultados.html',
  styleUrls: ['./reporte-resultados.css'] // ✅ corregido plural
})
export class ReporteResultados implements OnInit {

  carrerasGuardadas: Career[] = [];
  capacitaciones: Capacitacion[] = [];
  cargando = false;
  modalAbierto = false;
  carreraSeleccionada: Career | null = null;

  nombreCompleto = '';

  docentes: Docente[] = [];

  constructor(
    private careerService: CareerService,
    private docenteService: DocenteService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.obtenerCarreras();
    this.obtenerDocentes(); // 🔹 cargar docentes al inicio
  }

  // Obtener todas las carreras
  obtenerCarreras(): void {
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

  // Obtener todos los docentes (solo por nombre)
  obtenerDocentes(): void {
    this.docenteService.obtenerDocentes().subscribe({
      next: (data) => {
        this.docentes = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al obtener docentes:', err);
      }
    });
  }

  // Abrir modal (solo para registrar docente)
abrirModal(carrera: Career): void {
  this.carreraSeleccionada = carrera;
  this.modalAbierto = true;
  this.nombreCompleto = '';

  // 🔹 Docentes de la carrera
  this.docenteService.obtenerPorCarrera(carrera.id!).subscribe({
    next: (data) => {
      this.docentes = data;
    },
    error: (err) => {
      console.error('❌ Error al obtener docentes:', err);
    }
  });

  // 🔹 Capacitaciones de la carrera (ya vienen embebidas en Career)
  this.capacitaciones = carrera.capacitaciones || [];
}

  // Cerrar modal
  cerrarModal(): void {
    this.modalAbierto = false;
    this.carreraSeleccionada = null;
    this.nombreCompleto = '';
  }

  // Guardar un nuevo docente (solo nombre)
guardarDocente(): void {
  if (!this.carreraSeleccionada || !this.nombreCompleto.trim()) return;

  const nuevoDocente: Docente = {
    nombre: this.nombreCompleto.trim(),
    carreraId: this.carreraSeleccionada.id!,   // 🔹 vínculo con la carrera
    
  };

  this.docenteService.crearDocente(nuevoDocente).subscribe({
    next: (docenteGuardado) => {
      console.log('✅ Docente guardado:', docenteGuardado);
      this.docentes.push(docenteGuardado); // actualizar lista en el modal
      this.nombreCompleto = ''; // limpiar campo
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('❌ Error al guardar docente:', err);
    }
  });
}

  // Eliminar docente
  eliminarDocente(id: string): void {
    this.docenteService.eliminarDocente(id).subscribe({
      next: () => {
        this.docentes = this.docentes.filter(d => d.id !== id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al eliminar docente:', err);
      }
    });
  }
}