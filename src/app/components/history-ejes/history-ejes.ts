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


  // 🔷 Encabezado institucional
  doc.setFontSize(10);
  doc.text('Instituto Tecnológico Superior de Misantla', 20, 20);
  doc.text('Unidad de Gestión de Procesos Académicos', 20, 26);
  doc.text('Código: UGPA-PRO-135/' + new Date().toISOString().slice(0, 10), 150, 20);

  // 📘 Título
  doc.setFontSize(14);
  doc.text(`Resumen de ejes de la carrera: ${nombreCarrera}`, 20, 40);

  // 📋 Datos generales
  doc.setFontSize(11);
  doc.text(`Tipo de Carrera: ${tipoCarrera}`, 20, 50);
  doc.text(`Fecha de cálculo: ${fechaCalculo}`, 20, 56);
  doc.text(`Fecha de finalización: ${fechaFin}`, 20, 62);

  // 🧩 Ejes por nivel
  let y = 70;
  const ejesOrdenados = this.getEjesOrdenados(carrera.ejes);

  for (const eje of ejesOrdenados) {
    doc.setFontSize(12);
    doc.text(`Nivel ${eje.nivel}`, 20, y);
    y += 6;

    for (let j = 1; j <= 4; j++) {
      const ejeContent = (eje as any)[`eje${j}`];
      if (ejeContent && ejeContent !== '-') {
        const temas = this.procesarMaterias(ejeContent);
        autoTable(doc, {
          startY: y,
          head: [[`Eje ${j}`, 'Temas']],
          body: temas.map((t, idx) => [`Tema ${idx + 1}`, t]),
          theme: 'grid',
          styles: { fontSize: 10 },
          headStyles: { fillColor: [41, 128, 185] },
        });
       // Justo antes de usar lastAutoTable
const finalY = (doc as any).lastAutoTable.finalY;
y = finalY + 10;

      }
    }
  }

  // ✅ Sección de firmas
  doc.setFontSize(11);
  doc.text('ELABORADO POR:', 20, y + 10);
  doc.text('NOMBRE: DR. CARLOS PÉREZ ULAC', 20, y + 16);
  doc.text('CARGO: COORDINADOR DE CARRERAS DE LA SALUD', 20, y + 22);

  doc.text('REVISADO POR:', 20, y + 32);
  doc.text('NOMBRE: ING. MARINA GRANDE', 20, y + 38);
  doc.text('CARGO: COORDINADORA GENERAL DE CARRERAS', 20, y + 44);

  doc.text('APROBADO POR:', 20, y + 54);
  doc.text('NOMBRE: ___________________________', 20, y + 60);
  doc.text('CARGO: ___________________________', 20, y + 66);

  // 💾 Guardar PDF
  doc.save(`Resumen_${nombreCarrera}.pdf`);
}

  
}
