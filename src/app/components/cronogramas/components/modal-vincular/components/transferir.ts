import { Cronograma, CronogramaService } from '../../../firebase/cronogramas';

export interface TransferirModal {
    visible: boolean;
    cargando: boolean;
    guardando: boolean;
    error: string;
    personas: any[];              // 👈 antes: persona: any | null
    cronogramas: Cronograma[];
    cronogramaDestinoId: string;
    eliminarDeOrigen: boolean;
}

export function transferirModalVacio(): TransferirModal {
    return {
        visible: false, cargando: false, guardando: false, error: '',
        personas: [], cronogramas: [], cronogramaDestinoId: '',
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
     * Transfiere UNA o VARIAS personas al cronograma destino en solo 2
     * escrituras a Firebase (una al destino, una al origen), sin importar
     * cuántas sean. Esto evita golpear límites de escritura con lotes grandes.
     */
    async transferirLote(
        personas: any[],
        cronogramaOrigen: any,
        destino: Cronograma,
        eliminarDeOrigen: boolean
    ): Promise<{ exito: number; fallidos: number }> {
        if (!destino?.id || !cronogramaOrigen?.id) {
            throw new Error('Cronograma destino no válido.');
        }
        if (!personas || personas.length === 0) {
            return { exito: 0, fallidos: 0 };
        }

        const fechaVinculacion = new Date().toISOString();
        const mapaDestino = { ...((destino as any).estudiantesVinculados ?? {}) };
        const cedulasOk: string[] = [];
        let fallidos = 0;

        for (const persona of personas) {
            if (!persona?.cedula) { fallidos++; continue; }
            // Quitamos "tipo", que agrega el getter personasVinculadas y no
            // debe guardarse como parte del registro del estudiante.
            const { tipo, ...datosEstudiante } = persona;
            mapaDestino[persona.cedula] = { ...datosEstudiante, fechaVinculacion };
            cedulasOk.push(persona.cedula);
        }

        // 1) Una sola escritura al destino con todos los estudiantes fusionados
        await this.cronogramaService.actualizarCronograma(
            destino.id,
            { estudiantesVinculados: mapaDestino } as any
        );

        // 2) Si corresponde, una sola escritura al origen quitándolos a todos
        if (eliminarDeOrigen) {
            const mapaOrigen = { ...(cronogramaOrigen.estudiantesVinculados ?? {}) };
            cedulasOk.forEach(c => delete mapaOrigen[c]);
            await this.cronogramaService.actualizarCronograma(
                cronogramaOrigen.id,
                { estudiantesVinculados: mapaOrigen } as any
            );
            cronogramaOrigen.estudiantesVinculados = mapaOrigen;
        }

        return { exito: cedulasOk.length, fallidos };
    }
}