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
import { DocumentosComponent } from "../documentos/documentos";
import { DocumentosService } from '../../services/documentos/documentos';
import { Documento } from '../../Interface/documentos';

@Component({
  selector: 'app-reporte-resultados',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentosComponent],
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
  todosLosDocentes: Docente[] = []; // Para contar el total y generar secuencia

  mostrarFormularioDocente = false;
  docenteEditando: Docente | null = null;

  modalPatrocinioAbierto = false;
  docenteSeleccionado: Docente | null = null;
  capacitacionSeleccionada: Capacitacion | null = null;
  
  plantillasDisponibles: Documento[] = [];
  plantillaSeleccionada: Documento | null = null;
  seccionDocumentosExpandida = false;

  anio: number = new Date().getFullYear();
  mes: number = new Date().getMonth() + 1;
  codigoGenerado: string = '';
  
  generandoDocumento = false;

  constructor(
    private careerService: CareerService,
    private docenteService: DocenteService,
    private documentosService: DocumentosService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.obtenerCarreras();
    this.obtenerTodosLosDocentes();
    this.cargarPlantillas();
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

  obtenerTodosLosDocentes(): void {
    this.docenteService.obtenerDocentes().subscribe({
      next: (data) => {
        this.todosLosDocentes = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al obtener todos los docentes:', err);
      }
    });
  }

  cargarPlantillas(): void {
    this.documentosService.listarDocumentos().subscribe({
      next: (data) => {
        this.plantillasDisponibles = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al cargar plantillas:', err);
      }
    });
  }

  abrirModal(carrera: Career): void {
    this.carreraSeleccionada = carrera;
    this.modalAbierto = true;
    this.nombreCompleto = '';

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
      this.docenteService.actualizarDocente(this.docenteEditando.id!, docenteData).subscribe({
        next: (docenteActualizado) => {
          console.log('✏️ Docente actualizado:', docenteActualizado);

          const index = this.docentes.findIndex(d => d.id === this.docenteEditando!.id);
          if (index !== -1) {
            this.docentes[index] = docenteActualizado;
          }

          this.docenteEditando = null;
          this.limpiarFormulario();
          this.obtenerTodosLosDocentes();
          this.cdr.detectChanges();
        },
        error: (err) => console.error('❌ Error al actualizar docente:', err)
      });
    } else {
      this.docenteService.crearDocente(docenteData).subscribe({
        next: (docenteGuardado) => {
          console.log('✅ Docente guardado:', docenteGuardado);
          this.docentes.push(docenteGuardado);
          this.limpiarFormulario();
          this.obtenerTodosLosDocentes();
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
        this.obtenerTodosLosDocentes();
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

    this.nombreCompleto = docente.nombre;
    this.cedula = docente.cedula || '';
    this.formacion = docente.formacion || '';
    this.programa = docente.programa || '';
    this.estado = docente.estado || '';
    this.periodo = docente.periodo || '';

    this.mostrarFormularioDocente = true;
  }


  abrirModalPatrocinio(docente: Docente): void {
    this.docenteSeleccionado = docente;
    this.capacitacionSeleccionada = null;
    this.plantillaSeleccionada = null;
    this.modalPatrocinioAbierto = true;
    
    this.generarCodigo();
  }

  cerrarModalPatrocinio(): void {
    this.modalPatrocinioAbierto = false;
    this.docenteSeleccionado = null;
    this.codigoGenerado = '';
  }

  generarCodigo(): void {
  if (!this.docenteSeleccionado?.secuencia) return;

  const sec = this.docenteSeleccionado.secuencia
    .toString()
    .padStart(2, '0');

  const mesFormateado = this.mes.toString().padStart(2, '0');

  this.codigoGenerado = `UGPA-RGI2-${sec}-PRO134-${this.anio}-${mesFormateado}`;
}


  generarPatrocinio(): void {
    if (!this.docenteSeleccionado ||
        !this.capacitacionSeleccionada ||
        !this.plantillaSeleccionada ||
        !this.carreraSeleccionada) {
      alert('Por favor complete todos los campos');
      return;
    }

    if (!this.anio || !this.mes) {
      alert('Por favor ingrese año y mes válidos');
      return;
    }

    this.generarCodigo();
    
    this.generandoDocumento = true;

    this.documentosService.descargarDocumento(this.plantillaSeleccionada.fileId).subscribe({
      next: (blob) => {
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
              Codigo: this.codigoGenerado
            });

            doc.render();

            const output = doc.getZip().generate({
              type: 'blob',
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });

            // Descargar como Word
            saveAs(output, `${this.codigoGenerado}-${this.docenteSeleccionado!.nombre}.docx`);
            
            // Ocultar animación
            this.generandoDocumento = false;
            
            alert('✅ Documento generado exitosamente');
            this.cerrarModalPatrocinio();

          } catch (error) {
            console.error('❌ Error al generar documento:', error);
            this.generandoDocumento = false;
            alert('Error al procesar el documento. Verifica que la plantilla tenga los campos correctos: NombresC, Cedula1, Carrera1, NombreCA, Codigo');
          }
        };

        reader.readAsArrayBuffer(blob);
      },
      error: (err) => {
        console.error('❌ Error al descargar plantilla:', err);
        this.generandoDocumento = false;
        alert('Error al descargar la plantilla seleccionada');
      }
    });
  }

  toggleSeccionDocumentos(): void {
    this.seccionDocumentosExpandida = !this.seccionDocumentosExpandida;
  }

  onDocumentosActualizados(documentos: Documento[]): void {
    this.plantillasDisponibles = documentos;
    this.cdr.detectChanges();
  }
}