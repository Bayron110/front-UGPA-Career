import { Capacitacion } from './Capacitacion';

export interface Career {
  id?: string;
  nombre: string;
  capacitacion: Capacitacion[];  // Array de objetos Capacitacion
}