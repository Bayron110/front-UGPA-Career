import { Component } from '@angular/core';
import { InformePlanificacion } from "./components/informe-planificacion/informe-planificacion";
import { InformeFinal } from "./components/informe-final/informe-final";
import { InformeInstrumentos } from './components/informe-instrumentos/informe-instrumentos';
import { InformeImpacto } from "./components/informe-impacto/informe-impacto";

@Component({
  selector: 'app-documentos',
  imports: [InformePlanificacion, InformeFinal, InformeInstrumentos, InformeImpacto],
  templateUrl: './documentos.html',
  styleUrl: './documentos.css'
})
export class Documentos {

pantalla = 'planificacion';

cambiar(p: string) {
  this.pantalla = p;
}
}
