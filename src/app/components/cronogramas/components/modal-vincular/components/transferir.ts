// Ajusta esta ruta si la profundidad de carpetas de tu proyecto es distinta
import { Cronograma, CronogramaService } from '../../../firebase/cronogramas';

export interface TransferirModal {
    visible: boolean;
    cargando: boolean;
    guardando: boolean;
    error: string;
    persona: any | null;
    cronogramas: Cronograma[];
    cronogramaDestinoId: string;
    eliminarDeOrigen: boolean;
}

export function transferirModalVacio(): TransferirModal {
    return {
        visible: false, cargando: false, guardando: false, error: '',
        persona: null, cronogramas: [], cronogramaDestinoId: '',
        eliminarDeOrigen: true
    };
}

export class TransferirHelper {

    constructor(private cronogramaService: CronogramaService) {}

    /** Cronogramas disponibles como destino (todos menos el actual) */
    async cargarCronogramasDisponibles(cronogramaActualId: string | undefined): Promise<Cronograma[]> {
        const todos = await this.cronogramaService.obtenerCronogramas();
        return todos.filter(c => c.id !== cronogramaActualId);
    }

    /**
     * Copia (y opcionalmente mueve) a la persona hacia el cronograma destino.
     * Cuando eliminarDeOrigen es true, muta directamente
     * cronogramaOrigen.estudiantesVinculados, igual que hacía el componente
     * original, para que la vista se actualice sin recargar.
     */
    async transferir(
        persona: any,
        cronogramaOrigen: any,
        destino: Cronograma,
        eliminarDeOrigen: boolean
    ): Promise<void> {
        if (!destino?.id || !cronogramaOrigen?.id) {
            throw new Error('Cronograma destino no válido.');
        }

        const cedula = persona.cedula;
        // Quitamos el campo "tipo" que agrega el getter personasVinculadas,
        // no debe guardarse como parte del registro del estudiante.
        const { tipo, ...datosEstudiante } = persona;

        // 1) Escribir en el cronograma destino
        const mapaDestino = { ...((destino as any).estudiantesVinculados ?? {}) };
        mapaDestino[cedula] = {
            ...datosEstudiante,
            fechaVinculacion: new Date().toISOString()
        };
        await this.cronogramaService.actualizarCronograma(
            destino.id,
            { estudiantesVinculados: mapaDestino } as any
        );

        // 2) Si corresponde, eliminar del cronograma actual (mover en vez de copiar)
        if (eliminarDeOrigen) {
            const mapaOrigen = { ...(cronogramaOrigen.estudiantesVinculados ?? {}) };
            delete mapaOrigen[cedula];
            await this.cronogramaService.actualizarCronograma(
                cronogramaOrigen.id,
                { estudiantesVinculados: mapaOrigen } as any
            );
            cronogramaOrigen.estudiantesVinculados = mapaOrigen;
        }
    }
}