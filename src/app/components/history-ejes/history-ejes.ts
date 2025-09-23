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
 const codigoFecha = new Date().toISOString().slice(0, 7); // yyyy-mm

// Seccion Portada


doc.rect(15, 15, 180, 30); 


doc.line(75, 15, 75, 45);  
doc.line(135, 15, 135, 45); 
doc.line(75, 30, 135, 30);
// 📌 Texto columna izquierda
doc.setFontSize(9);
const centro = ['Unidad de Gestión de', 'Procesos Académicos'];

centro.forEach((linea, i) => {
  const textWidth = doc.getTextWidth(linea);
  const x = 75 + (60 - textWidth) / 2; // Centrado dentro del cuadro central
  const y = 20 + i * 6;
  doc.text(linea, x, y);
});

// 📘 Texto columna centro
doc.setFontSize(10);
doc.text(`Ejes de la Carrera: ${nombreCarrera}`, 105, 40, { align: 'center' });

// 🧾 Texto columna derecha (código)
doc.setFontSize(8);
const derecha = ['Código:', `UGPA-RG1-xx-PRO-135-${codigoFecha}`];
derecha.forEach((linea, i) => {
  doc.text(linea, 138, 20 + i * 6);
});

// 📘 Título principal centrado
doc.setFontSize(14);
doc.setFont('helvetica', 'bold');
const titulo = [`Resumen de ejes de la carrera:`, `${nombreCarrera}`];
titulo.forEach((linea, i) => {
  doc.text(linea, 105, 90 + i * 8, { align: 'center' });
});

// 🖋️ Tabla de firmas institucionales
autoTable(doc, {
  startY: 230,
  theme: 'grid',
  head: [['ELABORADO POR', 'REVISADO POR', 'APROBADO POR']],
  body: [
    [
      'NOMBRE: DR. CARLOS PÉREZ ULAC\nCARGO: COORDINADOR DE CARRERAS DE LA SALUD',
      'NOMBRE: ING. MARINA GRANDE\nCARGO: COORDINADORA GENERAL DE CARRERAS',
      'NOMBRE: ___________________________\nCARGO: ___________________________',
    ],
  ],
  styles: { fontSize: 10, cellPadding: 3 },
});

  // --------------------------------
  // 📑 Página 2 — Ejes
  // --------------------------------
  doc.addPage();

  doc.setFontSize(14);
doc.setFont('helvetica', 'bold');  doc.text(`Detalle de ejes de la carrera: ${nombreCarrera}`, 20, 20);

  // Datos generales
  doc.setFontSize(11);
doc.setFont('helvetica', 'bold');
  doc.text(`Tipo de Carrera: ${tipoCarrera}`, 20, 30);
  doc.text(`Fecha de cálculo: ${fechaCalculo}`, 20, 36);
  doc.text(`Fecha de finalización: ${fechaFin}`, 20, 42);

  let y = 50;
  const ejesOrdenados = this.getEjesOrdenados(carrera.ejes);

  for (const eje of ejesOrdenados) {
    doc.setFontSize(12);
    doc.text(`Nivel ${eje.nivel}`, 20, y);
    y += 6;

    const tablaBody: any[] = [];
    for (let j = 1; j <= 4; j++) {
      const ejeContent = (eje as any)[`eje${j}`];
      if (ejeContent && ejeContent !== '-') {
        const temas = this.procesarMaterias(ejeContent);
        const temasTexto = temas.map((t, idx) => `- ${t}`).join('\n');
        tablaBody.push([`Eje ${j}`, temasTexto]);
      }
    }

    if (tablaBody.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Eje', 'Temas']],
        body: tablaBody,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185] },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Si se pasa del final de la página, añade nueva página
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }
  }

  // 💾 Guardar PDF
  doc.save(`Resumen_${nombreCarrera}.pdf`);
}

  
}
