import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IngresoCarrerasComponent } from './components/interaccion/ingreso-carreras/ingreso-carreras';
import { PlanIndividual } from "./components/interaccion/plan-individual/plan-individual";
import { Seguimiento } from "./components/interaccion/seguimiento/seguimiento";
import { Historial } from "./components/visualizacion/historial/historial";
import { Dasboard } from "./components/visualizacion/dasboard/dasboard";
import { ActivarFormularios } from "./components/interaccion/activar-formularios/activar-formularios";

type VentanaActiva = 'ingreso-carreras' | 'patrocinio' | 'plan-individual' | 'seguimiento' | 'historial' | 'Dashboard'| 'Activar';


@Component({
  selector: 'app-documentos-web-docente',
  standalone: true,
  imports: [
    CommonModule,
    IngresoCarrerasComponent,
    PlanIndividual,
    Seguimiento,
    Historial,
    Dasboard,
    ActivarFormularios
],
  templateUrl: './documentos-web-docente.html',
  styleUrl: './documentos-web-docente.css'
})
export class DocumentosWebDocente {
  ventanaActiva: VentanaActiva = 'ingreso-carreras';

  cambiarVentana(ventana: VentanaActiva): void {
    this.ventanaActiva = ventana;
  }
}