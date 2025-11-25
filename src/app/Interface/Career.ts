import { Capacitacion } from './Capacitacion';

export interface Career {
  id?: string;
  nombre: string;
  capacitaciones: Capacitacion[];  // Array de objetos Capacitacion
}