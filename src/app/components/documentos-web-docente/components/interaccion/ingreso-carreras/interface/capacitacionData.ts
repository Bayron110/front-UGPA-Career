export interface CapacitacionData {
  capacitacion: string;
  tipo: string;
  horas: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  habilitada: boolean;
  teoriaTemas: TemaData[];
  practicaTemas: TemaData[];
}

export interface CapCombinada {
  key: string;
  data: CapacitacionData;
  esGenerica: boolean;
  eliminandoGenerica?: boolean;
}

export interface TemaData {
  titulo: string;
}