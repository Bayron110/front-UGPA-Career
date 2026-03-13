import { EventStatus } from "../../components/eventos/eventos";

export interface EventoGeneral {
  id: string;
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  status: EventStatus;
  completadoEn: number | null;
  notificadoProximo: boolean;
  notificadoPorFinalizar: boolean;
  notificadoSinCompletar: boolean;
  createdAt: number;
}