import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalCareer } from '../../Interface/CalCareer';
import { AxlesSuperior } from '../../Interface/Alex1';
import { CalCareerService } from '../../services/CalCareer/cal-career';
import { AxlesSuperiorService } from '../../services/axles/axles-suoerior';
import { EjePipePipe } from '../../pipes/eje-pipe-pipe';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import imagen1 from '../../img/img1';

@Component({
  selector: 'app-history-ejes',
  standalone: true,
  templateUrl: './history-ejes.html',
  styleUrls: ['./history-ejes.css'],
  imports: [CommonModule, EjePipePipe]
})
export class HistoryEjes implements OnInit {
  carrerasConEjes: { carrera: CalCareer; ejes: AxlesSuperior[]; ejesVisibles: boolean }[] = [];

  constructor(
    private calCareerService: CalCareerService,
    private axlesSuperiorService: AxlesSuperiorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.calCareerService.getAll().subscribe({
      next: (carreras) => {
        const carrerasSuperiores = carreras.filter(
          carrera =>
            carrera.id !== undefined &&
            carrera.typeCareer?.tipo?.toLowerCase() === 'superior'
        );

        const observables = carrerasSuperiores.map(carrera =>
          this.axlesSuperiorService.getByCalCareerId(carrera.id!).pipe(
            map(ejes => ({ carrera, ejes, ejesVisibles: false }))
          )
        );

        forkJoin(observables).subscribe({
          next: (data) => {
            this.carrerasConEjes = data;
            this.cdr.detectChanges();
          },
          error: (err) => console.error('Error al obtener ejes de las carreras', err)
        });
      },
      error: (err) => console.error('Error al obtener carreras', err)
    });
  }

  getEjesOrdenados(ejes: AxlesSuperior[]): AxlesSuperior[] {
    return ejes
      .filter((eje) => eje.nivel)
      .sort((a, b) => {
        const nivelA = parseInt(a.nivel.replace(/\D/g, ''), 10);
        const nivelB = parseInt(b.nivel.replace(/\D/g, ''), 10);
        return nivelA - nivelB;
      });
  }

  toggleEjesVisibles(index: number): void {
    this.carrerasConEjes[index].ejesVisibles = !this.carrerasConEjes[index].ejesVisibles;
  }

  procesarMaterias(ejeTexto: string): string[] {
    if (!ejeTexto || ejeTexto === '-') return [];
    return ejeTexto
      .split(' - ')
      .map(materia => materia.trim())
      .filter(materia => materia.length > 0);
  }

  generarPDFConFormato(i: number): void {
    const doc = this.generarPDFEnMemoria(i);

    const carrera = this.carrerasConEjes[i];
    const nombreCarrera = carrera.carrera.career?.nombre || 'Carrera';
    const codigoFecha = carrera.carrera.fechaActual
      ? new Date(carrera.carrera.fechaActual).toISOString().slice(0, 7)
      : 'fecha';
    const codigoIncremental = i + 1;
    const codigo = `UGPA-RGI1-${String(codigoIncremental).padStart(2, '0')}-PRO-135-${codigoFecha}`;

    doc.save(`${codigo}-${nombreCarrera.replace(/\s+/g, '_')}.pdf`);
  }

  private generarPDFEnMemoria(i: number): jsPDF {
    const carrera = this.carrerasConEjes[i];
    const doc = new jsPDF();

    const nombreCarrera = carrera.carrera.career?.nombre || 'Carrera';
    const tipoCarrera = carrera.carrera.typeCareer?.tipo || 'No especificado';
    const fechaCalculo = carrera.carrera.fechaActual
      ? new Date(carrera.carrera.fechaActual).toLocaleDateString()
      : 'No disponible';
    const fechaFin = carrera.carrera.fechaFin
      ? new Date(carrera.carrera.fechaFin).toLocaleDateString()
      : 'No disponible';

    let codigoFecha = 'No disponible';
    let codigoIncremental = 1;

    if (carrera.carrera.fechaActual) {
      const fecha = new Date(carrera.carrera.fechaActual);
      if (!isNaN(fecha.getTime())) {
        codigoFecha = fecha.toISOString().slice(0, 7);
        const carrerasPreviasDelMes = this.carrerasConEjes.slice(0, i).filter(c => {
          const fechaCarrera = new Date(c.carrera.fechaActual || "");
          return fechaCarrera.toISOString().slice(0, 7) === codigoFecha;
        });
        codigoIncremental = carrerasPreviasDelMes.length + 1;
      }
    }

    const codigo = `UGPA-RGI1-${String(codigoIncremental).padStart(2, '0')}-PRO-135-${codigoFecha}`;

    doc.setLineWidth(0.5);
    doc.rect(15, 20, 180, 30);
    doc.line(65, 20, 65, 50);
    doc.line(145, 20, 145, 50);
    doc.line(65, 35, 145, 35);
    const logoBase64 = imagen1;
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 20, 26, 40, 20);
    }
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Unidad de Gestión de Procesos Académicos', 105, 28, { align: 'center' });
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Contenidos de la Carrera:', 105, 38, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(nombreCarrera, 105, 44, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Código:', 170, 28, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const codigoLineas = doc.splitTextToSize(codigo, 45);
    let codigoY = 33;
    codigoLineas.forEach((linea: string) => {
      doc.text(linea, 170, codigoY, { align: 'center' });
      codigoY += 4;
    });

    const centerX = doc.internal.pageSize.getWidth() / 2;
    doc.setFontSize(23);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen de contenidos de la carrera:', centerX, 145, { align: 'center' });
    doc.setFontSize(23);
    doc.text(nombreCarrera, centerX, 155, { align: 'center' });

    autoTable(doc, {
      startY: 230,
      theme: 'grid',
      head: [['ELABORADO POR', 'REVISADO POR', 'APROBADO POR']],
      body: [
        ['', '', ''],
        [
          'NOMBRE: Msc. Jeffesor Villareal\n\nCARGO: Coordinador de Carreras',
          'NOMBRE: Ing. Martha Tomala\n\nCARGO: Coordinadora General de Carreras',
          'NOMBRE: Dr. Alex León T.\n\nCARGO: Vicerrector'
        ]
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 4,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        minCellHeight: 20
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 60 },
        2: { cellWidth: 60 }
      }
    });
    doc.addPage();

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Detalle de los contenidos de la carrera: ${nombreCarrera}`, 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tipo de Carrera: ${tipoCarrera}`, 20, 35);
    doc.text(`Fecha de Inicio: ${fechaCalculo}`, 20, 42);
    doc.text(`Fecha de Fin: ${fechaFin}`, 20, 49);

    let y = 65;
    const ejesOrdenados = this.getEjesOrdenados(carrera.ejes);

    for (const eje of ejesOrdenados) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${eje.nivel}`, 20, y);
      y += 8;

      const tablaBody: any[] = [];
      for (let j = 1; j <= 4; j++) {
        const ejeContent = (eje as any)[`eje${j}`];
        if (ejeContent && ejeContent !== '-') {
          const temas = this.procesarMaterias(ejeContent);
          const temasTexto = temas.map((t, idx) => `${idx + 1}. ${t}`).join('\n');
          tablaBody.push([`Contenido ${j}`, temasTexto]);
        }
      }

      if (tablaBody.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Contenidos', 'Materias']],
          body: tablaBody,
          theme: 'grid',
          styles: {
            fontSize: 7,
            cellPadding: 3,
            overflow: 'linebreak',
            halign: 'left',
            valign: 'top',
            lineWidth: 0.3,
            lineColor: [0, 0, 0]
          },
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'center'
          },
          columnStyles: {
            0: { cellWidth: 30, halign: 'center', valign: 'middle' },
            1: { cellWidth: 150 }
          },
          margin: { left: 15, right: 15 }
        });

        y = (doc as any).lastAutoTable.finalY + 12;

        if (y > 250) {
          doc.addPage();
          y = 25;
        }
      }
    }

    return doc;
  }
  async generarCarpetaDePDFs(): Promise<void> {
  const zip = new JSZip();
  const carpeta = zip.folder('PDF_Carreras_Superiores')!;

  for (let i = 0; i < this.carrerasConEjes.length; i++) {
    const carrera = this.carrerasConEjes[i];
    const pdf = this.generarPDFEnMemoria(i);
    const pdfBlob = pdf.output('blob');
    const nombreCarrera = carrera.carrera.career?.nombre || 'Carrera';
    const codigoFecha = carrera.carrera.fechaActual
      ? new Date(carrera.carrera.fechaActual).toISOString().slice(0, 7)
      : 'fecha';
    const codigoIncremental = i + 1;
    const codigo = `UGPA-RGI1-${String(codigoIncremental).padStart(2, '0')}-PRO-135-${codigoFecha}`;
    
    const nombreArchivo = `${codigo}-${nombreCarrera.replace(/\s+/g, '_')}.pdf`;
    carpeta.file(nombreArchivo, pdfBlob);
  }

  const fechaActual = new Date().toISOString().split('T')[0];
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `Carreras_Superiores_${fechaActual}.zip`);
}
}
