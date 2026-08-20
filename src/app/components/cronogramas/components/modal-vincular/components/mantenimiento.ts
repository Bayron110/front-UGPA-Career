// Ajusta estas rutas si la profundidad de carpetas de tu proyecto es distinta
import { EstudiantesService } from '../../../firebase/estudiante';
import { CronogramaService } from '../../../firebase/cronogramas';

export interface ResultadoMigracion {
    exito: number;
    fallidos: number;
    sinDocFirestore: number;
}

export interface ResultadoActualizarSede {
    actualizados: number;
    sinCoincidencia: number;
}

export class MantenimientoHelper {

    constructor(
        private estudiantesService: EstudiantesService,
        private cronogramaService: CronogramaService
    ) {}

    /**
     * Copia telegramChatId desde Realtime Database (personasVinculadas)
     * hacia Firestore (proyecto utet-4387a, colección "Estudiantes"),
     * usando merge para no pisar los demás campos. Si el documento no
     * existe en Firestore para esa cédula, no lo crea (se cuenta como
     * "sin documento") para evitar registros huérfanos.
     */
    async migrarTelegramChatIds(personasVinculadas: any[]): Promise<ResultadoMigracion> {
        const estudiantesConTelegram = personasVinculadas.filter(
            (p: any) => p.tipo === 'estudiante' && p.telegramChatId && p.cedula
        );

        let exito = 0;
        let fallidos = 0;
        let sinDocFirestore = 0;

        if (estudiantesConTelegram.length === 0) {
            return { exito, fallidos, sinDocFirestore };
        }

        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        const { getUtetFirestore } = await import('../../../firebase/utet-firestore');
        const db = getUtetFirestore();

        for (const p of estudiantesConTelegram) {
            try {
                // Intento 1: cédula tal como viene
                let ref = doc(db, 'Estudiantes', p.cedula);
                let snap = await getDoc(ref);

                // Intento 2: si empieza con '0', probar sin el cero inicial
                if (!snap.exists() && p.cedula.startsWith('0')) {
                    const cedulaSin0 = p.cedula.slice(1);
                    ref = doc(db, 'Estudiantes', cedulaSin0);
                    snap = await getDoc(ref);
                }

                if (!snap.exists()) {
                    sinDocFirestore++;
                    continue;
                }

                await setDoc(ref,
                    { telegramChatId: p.telegramChatId, telegramUser: p.telegramUser },
                    { merge: true });

                exito++;
            } catch (err) {
                console.error('[Migración] Error al migrar cédula', p.cedula, err);
                fallidos++;
            }
        }

        return { exito, fallidos, sinDocFirestore };
    }

    /**
     * Busca la sede de los estudiantes vinculados que no la tienen,
     * cruzando contra TODOS los grupos de inducción, y actualiza
     * únicamente ese campo en Firebase (sin sobrescribir nada más).
     * Muta cronograma.estudiantesVinculados igual que el componente
     * original para reflejar el cambio sin recargar.
     */
    async actualizarSedeVinculados(
        cronograma: any,
        personasVinculadas: any[]
    ): Promise<ResultadoActualizarSede> {
        const estudiantesSinSede = personasVinculadas.filter(
            (p: any) => p.tipo === 'estudiante' && p.cedula && !(p.sede && String(p.sede).trim())
        );

        let actualizados = 0;
        let sinCoincidencia = 0;

        if (estudiantesSinSede.length === 0 || !cronograma?.id) {
            return { actualizados, sinCoincidencia };
        }

        const mapaEstudiantes = await this.estudiantesService.obtenerTodosLosEstudiantes();
        const vinculadosActuales = { ...(cronograma.estudiantesVinculados ?? {}) };

        for (const p of estudiantesSinSede) {
            const encontrado = mapaEstudiantes.get(p.cedula);
            const sedeEncontrada = encontrado?.sede?.trim();

            if (!sedeEncontrada) {
                sinCoincidencia++;
                continue;
            }

            vinculadosActuales[p.cedula] = {
                ...vinculadosActuales[p.cedula],
                sede: sedeEncontrada
            };
            actualizados++;
        }

        if (actualizados > 0) {
            await this.cronogramaService.actualizarCronograma(
                cronograma.id,
                { estudiantesVinculados: vinculadosActuales } as any
            );
            cronograma.estudiantesVinculados = vinculadosActuales;
        }

        return { actualizados, sinCoincidencia };
    }
}