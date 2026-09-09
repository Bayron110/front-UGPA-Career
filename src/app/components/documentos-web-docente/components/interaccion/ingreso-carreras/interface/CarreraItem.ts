import { CapacitacionData } from "./capacitacionData";

export interface CarreraItem {
  id: string;
  nombre: string;
  capacitaciones: { [key: string]: CapacitacionData };
  guardando?: boolean;
  eliminando?: boolean;
  limpiando?: boolean;
}