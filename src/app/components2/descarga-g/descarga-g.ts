import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocenteService } from '../../services/docentes/docente';
import { DocumentosService } from '../../services/documentos/documentos';
import { CareerService } from '../../services/Career/caeer-service';
import { Docente } from '../../Interface/Docente';
import { Documento } from '../../Interface/documentos';
import { Career } from '../../Interface/Career';
import { Capacitacion } from '../../Interface/Capacitacion';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface TipoDocumento {
  id: string;
  nombre: string;
  plantilla: Documento | null;
  seleccionado: boolean;
  generarPorCapacitacion: boolean;
}

@Component({
  selector: 'app-descarga-g',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './descarga-g.html',
  styleUrl: './descarga-g.css'
})
export class DescargaG implements OnInit {
  
  modalAbierto = false;
  generandoDocumentos = false;
  
  docentes: Docente[] = [];
  carreras: Career[] = [];
  plantillas: Documento[] = [];
  
  tiposDocumentos: TipoDocumento[] = [
    { id: 'patrocinio', nombre: 'Patrocinio', plantilla: null, seleccionado: false, generarPorCapacitacion: true },
    { id: 'plan_individual', nombre: 'Plan Individual', plantilla: null, seleccionado: false, generarPorCapacitacion: false },
    { id: 'reporte_anual', nombre: 'Reporte Anual', plantilla: null, seleccionado: false, generarPorCapacitacion: false }
  ];
  
  progreso = {
    actual: 0,
    total: 0,
    mensaje: ''
  };

  fechaActual: string = '';

  constructor(
    private docenteService: DocenteService,
    private documentosService: DocumentosService,
    private careerService: CareerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fechaActual = this.obtenerFechaActual();
    this.cargarDatos();
  }

  obtenerFechaActual(): string {
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  cargarDatos(): void {
    // Cargar docentes
    this.docenteService.obtenerDocentes().subscribe({
      next: (docentes) => {
        this.docentes = docentes;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar docentes:', err)
    });

    // Cargar carreras
    this.careerService.obtenerCarreras().subscribe({
      next: (carreras) => {
        this.carreras = carreras;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar carreras:', err)
    });

    // Cargar plantillas
    this.documentosService.listarDocumentos().subscribe({
      next: (plantillas) => {
        this.plantillas = plantillas;
        this.asignarPlantillas();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar plantillas:', err)
    });
  }

  asignarPlantillas(): void {
    // Asignar plantillas automáticamente por nombre
    this.tiposDocumentos.forEach(tipo => {
      const plantillaEncontrada = this.plantillas.find(p => 
        p.nombre.toLowerCase().includes(tipo.nombre.toLowerCase())
      );
      if (plantillaEncontrada) {
        tipo.plantilla = plantillaEncontrada;
      }
    });
  }

  abrirModal(): void {
    if (this.docentes.length === 0) {
      alert('⚠️ No hay docentes registrados para generar documentos');
      return;
    }
    
    if (this.plantillas.length === 0) {
      alert('⚠️ No hay plantillas disponibles. Por favor, sube plantillas primero.');
      return;
    }
    
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.reiniciarSeleccion();
  }

  reiniciarSeleccion(): void {
    this.tiposDocumentos.forEach(tipo => tipo.seleccionado = false);
  }

  get documentosSeleccionados(): TipoDocumento[] {
    return this.tiposDocumentos.filter(t => t.seleccionado && t.plantilla);
  }

  get totalDocumentosAGenerar(): number {
    let total = 0;
    
    this.documentosSeleccionados.forEach(tipo => {
      if (tipo.generarPorCapacitacion) {
        // Solo contar documentos de carreras que tienen docentes
        this.carreras.forEach(carrera => {
          const docentesEnCarrera = this.docentes.filter(d => d.carreraId === carrera.id);
          if (docentesEnCarrera.length > 0) {
            const capacitaciones = carrera.capacitaciones || [];
            total += docentesEnCarrera.length * capacitaciones.length;
          }
        });
      } else {
        // Un documento por docente
        total += this.docentes.length;
      }
    });
    
    return total;
  }

  async generarTodosLosDocumentos(): Promise<void> {
    if (this.documentosSeleccionados.length === 0) {
      alert('⚠️ Selecciona al menos un tipo de documento');
      return;
    }

    this.generandoDocumentos = true;
    this.progreso.total = this.totalDocumentosAGenerar;
    this.progreso.actual = 0;

    try {
      const zipPrincipal = new JSZip();

      for (const tipo of this.documentosSeleccionados) {
        const carpetaTipo = zipPrincipal.folder(tipo.nombre)!;

        if (tipo.generarPorCapacitacion) {
          await this.generarDocumentosPorCapacitacion(carpetaTipo, tipo);
        } else {
          await this.generarDocumentosSimples(carpetaTipo, tipo);
        }
      }

      // Generar y descargar el ZIP
      this.progreso.mensaje = 'Finalizando descarga...';
      const blob = await zipPrincipal.generateAsync({ type: 'blob' });
      saveAs(blob, `Documentos_Completos_${this.fechaActual}.zip`);

      alert('✅ Documentos generados exitosamente');
      this.cerrarModal();

    } catch (error) {
      console.error('❌ Error al generar documentos:', error);
      alert('❌ Error al generar los documentos. Revisa la consola para más detalles.');
    } finally {
      this.generandoDocumentos = false;
      this.progreso.actual = 0;
      this.progreso.total = 0;
      this.progreso.mensaje = '';
    }
  }

  private async generarDocumentosPorCapacitacion(
    carpetaPadre: JSZip, 
    tipo: TipoDocumento
  ): Promise<void> {
    
    for (const carrera of this.carreras) {
      // Filtrar solo los docentes de esta carrera
      const docentesEnCarrera = this.docentes.filter(d => d.carreraId === carrera.id);
      
      // Si no hay docentes en esta carrera, saltarla
      if (docentesEnCarrera.length === 0) {
        console.log(`⏭️ Carrera "${carrera.nombre}" omitida (sin docentes registrados)`);
        continue;
      }

      const capacitaciones = carrera.capacitaciones || [];
      
      // Si no hay capacitaciones, saltar esta carrera
      if (capacitaciones.length === 0) {
        console.log(`⏭️ Carrera "${carrera.nombre}" omitida (sin capacitaciones)`);
        continue;
      }
      
      for (const capacitacion of capacitaciones) {
        const carpetaCapacitacion = carpetaPadre.folder(
          this.sanitizarNombre(capacitacion.nombre)
        )!;

        for (const docente of docentesEnCarrera) {
          this.progreso.mensaje = `Generando ${tipo.nombre} - ${capacitacion.nombre} - ${docente.nombre}`;
          this.progreso.actual++;
          this.cdr.detectChanges();

          try {
            const contenidoDoc = await this.generarDocumentoIndividual(
              docente,
              carrera,
              capacitacion,
              tipo.plantilla!
            );

            const nombreArchivo = this.generarNombreArchivo(
              docente,
              carrera,
              capacitacion,
              tipo.id
            );

            carpetaCapacitacion.file(nombreArchivo, contenidoDoc);
            
            // Pequeña pausa para no saturar
            await this.esperar(50);

          } catch (error) {
            console.error(`Error generando doc para ${docente.nombre}:`, error);
          }
        }
      }
    }
  }

  private async generarDocumentosSimples(
    carpetaPadre: JSZip,
    tipo: TipoDocumento
  ): Promise<void> {
    
    for (const docente of this.docentes) {
      this.progreso.mensaje = `Generando ${tipo.nombre} - ${docente.nombre}`;
      this.progreso.actual++;
      this.cdr.detectChanges();

      try {
        const carrera = this.carreras.find(c => c.id === docente.carreraId);
        if (!carrera) {
          console.log(`⏭️ Docente "${docente.nombre}" omitido (carrera no encontrada)`);
          continue;
        }

        const contenidoDoc = await this.generarDocumentoIndividual(
          docente,
          carrera,
          null,
          tipo.plantilla!
        );

        const nombreArchivo = this.generarNombreArchivo(
          docente,
          carrera,
          null,
          tipo.id
        );

        carpetaPadre.file(nombreArchivo, contenidoDoc);
        
        await this.esperar(50);

      } catch (error) {
        console.error(`Error generando doc para ${docente.nombre}:`, error);
      }
    }
  }

  private async generarDocumentoIndividual(
    docente: Docente,
    carrera: Career,
    capacitacion: Capacitacion | null,
    plantilla: Documento
  ): Promise<Blob> {
    
    return new Promise((resolve, reject) => {
      this.documentosService.descargarDocumento(plantilla.fileId).subscribe({
        next: (blob) => {
          const reader = new FileReader();

          reader.onload = (event: any) => {
            try {
              const content = new Uint8Array(event.target.result);
              const zip = new PizZip(content);
              const doc = new Docxtemplater(zip, { 
                paragraphLoop: true, 
                linebreaks: true 
              });

              const codigo = this.generarCodigo(docente);

              const datos: any = {
                NombresC: docente.nombre,
                Cedula1: docente.cedula || 'N/A',
                Carrera1: carrera.nombre,
                Formacion: docente.formacion || 'N/A',
                Programa: docente.programa || 'N/A',
                Estado: docente.estado || 'N/A',
                Periodo: docente.periodo || 'N/A',
                Codigo: codigo
              };

              if (capacitacion) {
                datos.NombreCA = capacitacion.nombre;
                datos.HorasCA = capacitacion.horas || 'N/A';
              }

              // Usar la nueva API de docxtemplater (render con datos)
              doc.render(datos);

              const output = doc.getZip().generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              });

              resolve(output);

            } catch (error) {
              reject(error);
            }
          };

          reader.onerror = () => reject(new Error('Error al leer el archivo'));
          reader.readAsArrayBuffer(blob);
        },
        error: (err) => reject(err)
      });
    });
  }

  private generarCodigo(docente: Docente): string {
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const sec = (docente.secuencia || 1).toString().padStart(2, '0');
    
    return `UGPA-RGI2-${sec}-PRO134-${anio}-${mes}`;
  }

  private generarNombreArchivo(
    docente: Docente,
    carrera: Career,
    capacitacion: Capacitacion | null,
    tipoDoc: string
  ): string {
    const nombreLimpio = this.sanitizarNombre(docente.nombre);
    const codigo = this.generarCodigo(docente);
    
    if (capacitacion) {
      return `${codigo}_${nombreLimpio}.docx`;
    }
    
    return `${tipoDoc}_${nombreLimpio}.docx`;
  }

  private sanitizarNombre(nombre: string): string {
    return nombre
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  private esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  get porcentajeProgreso(): number {
    if (this.progreso.total === 0) return 0;
    return Math.round((this.progreso.actual / this.progreso.total) * 100);
  }

  obtenerDocentesPorCarrera(carreraId: string): Docente[] {
    return this.docentes.filter(d => d.carreraId === carreraId);
  }
}