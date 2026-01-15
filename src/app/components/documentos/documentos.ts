import { ChangeDetectorRef, Component, OnInit, Output, EventEmitter } from '@angular/core';
import { Documento } from '../../Interface/documentos';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentosService } from '../../services/documentos/documentos';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-documentos',
  templateUrl: './documentos.html',
  styleUrls: ['./documentos.css'],
  imports: [CommonModule, FormsModule],
})
export class DocumentosComponent implements OnInit {
  documentos: Documento[] = [];
  selectedFile!: File;
  nombre: string = '';
  descripcion: string = '';
  
  // Variables para el modal
  modalAbierto: boolean = false;
  documentoSeleccionado: Documento | null = null;
  documentoUrl: SafeResourceUrl | null = null;
  blobUrl: string = '';
  errorVisualizacion: string = '';

  // Output para comunicar cambios al componente padre
  @Output() documentosActualizados = new EventEmitter<Documento[]>();

  constructor(
    private documentosService: DocumentosService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.listarDocumentos();
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  onUpload(): void {
    if (this.selectedFile && this.nombre && this.descripcion) {
      this.documentosService.subirDocumento(this.selectedFile, this.nombre, this.descripcion)
        .subscribe(res => {
          alert(res);
          this.listarDocumentos();
          // Limpiar formulario
          this.nombre = '';
          this.descripcion = '';
          this.selectedFile = null as any;
        });
    } else {
      alert('Por favor selecciona archivo, nombre y descripción');
    }
  }

  listarDocumentos(): void {
    this.documentosService.listarDocumentos()
      .subscribe(data => {
        this.documentos = data;
        // Emitir evento al componente padre
        this.documentosActualizados.emit(data);
        this.cdr.detectChanges();
      });
  }

  abrirModal(documento: Documento): void {
    this.documentoSeleccionado = documento;
    this.modalAbierto = true;
    this.errorVisualizacion = '';
    
    this.documentosService.descargarDocumento(documento.fileId).subscribe(
      blob => {
        const url = window.URL.createObjectURL(blob);
        this.blobUrl = url;
        
        const fileType = blob.type;
        const fileName = documento.nombre.toLowerCase();
        
        if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
          this.documentoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx') || 
                   fileType.includes('word') || fileType.includes('document')) {
          this.errorVisualizacion = 'La vista previa de archivos Word no está disponible en el navegador. Por favor, descarga el archivo para verlo.';
          this.documentoUrl = null;
        } else {
          this.documentoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        }
        
        this.cdr.detectChanges();
      },
      error => {
        this.errorVisualizacion = 'Error al cargar el documento';
        console.error('Error:', error);
      }
    );
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.documentoSeleccionado = null;
    this.errorVisualizacion = '';
    
    if (this.blobUrl) {
      window.URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = '';
    }
    
    this.documentoUrl = null;
  }

  descargar(fileId: string | undefined): void {
    if (!fileId) return;
    
    this.documentosService.descargarDocumento(fileId).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const nombreArchivo = this.documentoSeleccionado?.nombre || 'documento';
      
      let extension = '.docx';
      if (blob.type.includes('pdf')) {
        extension = '.pdf';
      } else if (blob.type.includes('word')) {
        extension = nombreArchivo.endsWith('.doc') ? '.doc' : '.docx';
      }
      
      const nombreFinal = nombreArchivo.includes('.') ? nombreArchivo : `${nombreArchivo}${extension}`;
      a.download = nombreFinal;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }
}