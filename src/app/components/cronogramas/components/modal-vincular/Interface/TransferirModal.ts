import { Cronograma } from "../../../firebase/cronogramas";

export interface TransferirModal {
    visible: boolean;
    cargando: boolean;
    guardando: boolean;
    error: string;
    personas: any[];            
    cronogramas: Cronograma[];
    cronogramaDestinoId: string;
    eliminarDeOrigen: boolean;
}
