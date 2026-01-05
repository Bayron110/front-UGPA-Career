import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareerService } from '../../services/Career/caeer-service';
import { Career } from '../../Interface/Career';
import { Docente } from '../../Interface/Docente';
import { DocenteService } from '../../services/docentes/docente';
import { Capacitacion } from '../../Interface/Capacitacion';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-reporte-resultados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-resultados.html',
  styleUrls: ['./reporte-resultados.css']
})
export class ReporteResultados implements OnInit {

  carrerasGuardadas: Career[] = [];
  capacitaciones: Capacitacion[] = [];
  cargando = false;
  modalAbierto = false;
  carreraSeleccionada: Career | null = null;

  nombreCompleto = '';
  cedula = '';
  formacion = '';
  programa = '';
  estado = '';
  periodo = '';

  docentes: Docente[] = [];

  mostrarFormularioDocente = false;
  docenteEditando: Docente | null = null;

  // ===== MODAL PATROCINIO =====
  modalPatrocinioAbierto = false;
  docenteSeleccionado: Docente | null = null;
  capacitacionSeleccionada: Capacitacion | null = null;
  codigoPatrocinio = '';
  archivoWord: File | null = null;

  constructor(
    private careerService: CareerService,
    private docenteService: DocenteService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.obtenerCarreras();
    this.obtenerDocentes();
  }

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

  abrirModal(carrera: Career): void {
    this.carreraSeleccionada = carrera;
    this.modalAbierto = true;
    this.nombreCompleto = '';

    // Limpio antes de cargar
    this.docentes = [];
    this.cargando = true;

    this.docenteService.obtenerPorCarrera(carrera.id!).subscribe({
      next: (data) => {
        this.docentes = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al obtener docentes:', err);
        this.cargando = false;
      }
    });

    this.capacitaciones = carrera.capacitaciones || [];
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.carreraSeleccionada = null;
    this.nombreCompleto = '';
  }

  guardarDocente(): void {
    if (!this.carreraSeleccionada || !this.nombreCompleto.trim()) return;

    const docenteData: Docente = {
      nombre: this.nombreCompleto.trim(),
      carreraId: this.carreraSeleccionada.id!,
      cedula: this.cedula.trim(),
      formacion: this.formacion.trim(),
      programa: this.programa.trim(),
      estado: this.estado.trim(),
      periodo: this.periodo.trim()
    };

    if (this.docenteEditando) {
      // 🔹 Actualizar docente existente
      this.docenteService.actualizarDocente(this.docenteEditando.id!, docenteData).subscribe({
        next: (docenteActualizado) => {
          console.log('✏️ Docente actualizado:', docenteActualizado);

          // Reemplazar en la lista
          const index = this.docentes.findIndex(d => d.id === this.docenteEditando!.id);
          if (index !== -1) {
            this.docentes[index] = docenteActualizado;
          }

          this.docenteEditando = null;
          this.limpiarFormulario();
          this.cdr.detectChanges();
        },
        error: (err) => console.error('❌ Error al actualizar docente:', err)
      });
    } else {
      // 🔹 Crear nuevo docente
      this.docenteService.crearDocente(docenteData).subscribe({
        next: (docenteGuardado) => {
          console.log('✅ Docente guardado:', docenteGuardado);
          this.docentes.push(docenteGuardado);
          this.limpiarFormulario();
          this.cdr.detectChanges();
        },
        error: (err) => console.error('❌ Error al guardar docente:', err)
      });
    }
  }

  limpiarFormulario(): void {
    this.nombreCompleto = '';
    this.cedula = '';
    this.formacion = '';
    this.programa = '';
    this.estado = '';
    this.periodo = '';
  }

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

  toggleFormularioDocente(): void {
    this.mostrarFormularioDocente = !this.mostrarFormularioDocente;
  }

  editarDocente(docente: Docente): void {
    this.docenteEditando = docente;

    // Cargar datos en el formulario
    this.nombreCompleto = docente.nombre;
    this.cedula = docente.cedula || '';
    this.formacion = docente.formacion || '';
    this.programa = docente.programa || '';
    this.estado = docente.estado || '';
    this.periodo = docente.periodo || '';

    this.mostrarFormularioDocente = true; // abrir el formulario
  }

  // ===========================
  // FUNCIONES MODAL PATROCINIO
  // ===========================

  abrirModalPatrocinio(docente: Docente): void {
    this.docenteSeleccionado = docente;
    this.capacitacionSeleccionada = null;
    this.codigoPatrocinio = '';
    this.archivoWord = null;
    this.modalPatrocinioAbierto = true;
  }

  cerrarModalPatrocinio(): void {
    this.modalPatrocinioAbierto = false;
    this.docenteSeleccionado = null;
  }

  onArchivoWordSeleccionado(event: any): void {
    this.archivoWord = event.target.files[0];
  }

 generarPatrocinio(): void {
  if (!this.docenteSeleccionado ||
      !this.capacitacionSeleccionada ||
      !this.archivoWord ||
      !this.carreraSeleccionada) {
    alert('Completa todos los campos');
    return;
  }

  const reader = new FileReader();

  reader.onload = (event: any) => {
  try {
    const content = new Uint8Array(event.target.result);
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.setData({
      NombresC: this.docenteSeleccionado!.nombre,
      Cedula1: this.docenteSeleccionado!.cedula,
      Carrera1: this.carreraSeleccionada!.nombre,
      NombreCA: this.capacitacionSeleccionada!.nombre,
      Codigo: this.codigoPatrocinio
    });

    doc.render();

    const output = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

saveAs(output, `${this.codigoPatrocinio}-${this.docenteSeleccionado!.nombre}.docx`);    this.cerrarModalPatrocinio();

  } catch (error) {
    console.error('❌ Error al generar Word:', error);
    alert('Error al procesar el documento Word. Revisa que los campos estén escritos sin formato.');
  }
};

reader.readAsArrayBuffer(this.archivoWord);

}
}