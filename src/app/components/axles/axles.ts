import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Eje {
  abierto: boolean;
  campos: string[];
  nombre?: string;
}

interface Nivel {
  abierto: boolean;
  ejes: Eje[];
  nombre?: string;
}

@Component({
  selector: 'app-axles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './axles.html',
  styleUrls: ['./axles.css']
})
export class Axles {
  niveles: Nivel[] = Array(4).fill(null).map((_, i) => ({
    abierto: false,
    nombre: `Nivel ${i + 1}`,
    ejes: Array(4).fill(null).map((_, j) => ({
      abierto: false,
      nombre: `Eje ${j + 1}`,
      campos: []
    }))
  }));

  toggleNivel(index: number): void {
    this.niveles[index].abierto = !this.niveles[index].abierto;
  }

  toggleEje(nivelIndex: number, ejeIndex: number): void {
    this.niveles[nivelIndex].ejes[ejeIndex].abierto = 
      !this.niveles[nivelIndex].ejes[ejeIndex].abierto;
  }

  agregarCampo(nivel: Nivel, eje: Eje): void {
    if (eje.campos.length < 4) {
      eje.campos.push('');
    }
  }

  eliminarCampo(nivel: Nivel, eje: Eje, index: number): void {
    eje.campos.splice(index, 1);
  }

  getEjesActivos(nivel: Nivel): number {
    return nivel.ejes.filter(eje => eje.campos.length > 0).length;
  }

  getTotalCampos(): number {
    return this.niveles.reduce((total, nivel) => 
      total + nivel.ejes.reduce((ejeTotal, eje) => 
        ejeTotal + eje.campos.length, 0), 0);
  }

  getNivelesActivos(): number {
    return this.niveles.filter(nivel => 
      nivel.ejes.some(eje => eje.campos.length > 0)).length;
  }
  
  @Output() estadoCompleto = new EventEmitter<boolean>();

ngDoCheck() {
  const completo = this.niveles.every(n =>
    n.ejes.every(e => e.campos.length === 4)
  );
  this.estadoCompleto.emit(completo);
}
}