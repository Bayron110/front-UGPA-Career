import { CronogramaService } from '../../../firebase/cronogramas';
import { EstudiantesService } from '../../../firebase/estudiante';

export interface ResultadoMigracionTelegram {
    exito: number;
    fallidos: number;
    sinDocFirestore: number;
}

/**
 * Recorre los estudiantes vinculados (con telegramChatId) y copia ese campo
 * hacia el documento correspondiente en Firestore (proyecto utet-4387a,
 * colección "Estudiantes"), usando merge para no pisar los demás campos.
 * Si el documento no existe en Firestore para esa cédula, no lo crea.
 *
 * Lanza un Error si no hay nada que migrar, para que el llamador decida
 * cómo avisar al usuario.
 */
export async function migrarTelegramChatIds(
    personasVinculadas: any[]
): Promise<ResultadoMigracionTelegram> {
    const estudiantesConTelegram = personasVinculadas.filter(
        (p: any) => p.tipo === 'estudiante' && p.telegramChatId && p.cedula
    );

    console.log('[Migración] Estudiantes con telegramChatId encontrados:', estudiantesConTelegram.length);
    console.table(estudiantesConTelegram.map((p: any) => ({
        cedula: p.cedula, nombres: p.nombres,
        telegramChatId: p.telegramChatId, telegramUser: p.telegramUser
    })));

    if (estudiantesConTelegram.length === 0) {
        throw new Error('No hay estudiantes vinculados con telegramChatId para migrar.');
    }

    let exito = 0;
    let fallidos = 0;
    let sinDocFirestore = 0;

    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    const { getUtetFirestore } = await import('../../../firebase/utet-firestore');
    const db = getUtetFirestore();

    for (const p of estudiantesConTelegram) {
        console.group(`[Migración] Cédula ${p.cedula} (${p.nombres})`);
        try {
            // Intento 1: cédula tal como viene
            let ref = doc(db, 'Estudiantes', p.cedula);
            let snap = await getDoc(ref);

            console.log('¿Existe documento en Firestore?', snap.exists());

            // Intento 2: si empieza con '0', probar sin el cero inicial
            if (!snap.exists() && p.cedula.startsWith('0')) {
                const cedulaSin0 = p.cedula.slice(1);
                ref = doc(db, 'Estudiantes', cedulaSin0);
                snap = await getDoc(ref);
                console.log('Reintentando sin cero inicial, cédula:', cedulaSin0, '¿Existe?', snap.exists());
            }

            if (!snap.exists()) {
                console.warn('No se encontró el documento con ese ID exacto. Revisa el formato de la cédula.');
                sinDocFirestore++;
                console.groupEnd();
                continue;
            }

            console.log('telegramChatId a escribir:', p.telegramChatId);
            console.log('telegramUser a escribir:', p.telegramUser);
            await setDoc(ref,
                { telegramChatId: p.telegramChatId, telegramUser: p.telegramUser },
                { merge: true });

            console.log('✔ Escritura exitosa.');
            exito++;

        } catch (err) {
            console.error('✘ Error al migrar esta cédula:', err);
            fallidos++;
        }
        console.groupEnd();
    }

    console.log(`[Migración] Resumen final → Éxito: ${exito} | Sin documento: ${sinDocFirestore} | Errores: ${fallidos}`);

    return { exito, fallidos, sinDocFirestore };
}

export interface ResultadoActualizarSede {
    actualizados: number;
    sinCoincidencia: number;
    /** Mapa estudiantesVinculados ya actualizado, listo para guardar en el cronograma. */
    vinculadosActualizados: Record<string, any>;
}

/**
 * Busca la sede de los estudiantes vinculados que NO tienen "sede" guardada,
 * comparando contra TODOS los grupos de inducción, y arma el nuevo mapa de
 * estudiantesVinculados con solo ese campo actualizado (sin tocar el resto).
 * No persiste nada: el llamador decide cuándo guardar
 * `vinculadosActualizados` con cronogramaService.actualizarCronograma().
 *
 * Lanza un Error si no hay nadie sin sede.
 */
export async function actualizarSedeVinculados(
    personasVinculadas: any[],
    estudiantesVinculadosActuales: Record<string, any>,
    estudiantesService: EstudiantesService
): Promise<ResultadoActualizarSede> {
    const estudiantesSinSede = personasVinculadas.filter(
        (p: any) => p.tipo === 'estudiante' && p.cedula && !(p.sede && String(p.sede).trim())
    );

    if (estudiantesSinSede.length === 0) {
        throw new Error('Todos los estudiantes vinculados ya tienen sede registrada.');
    }

    const mapaEstudiantes = await estudiantesService.obtenerTodosLosEstudiantes();
    const vinculadosActuales = { ...estudiantesVinculadosActuales };

    let actualizados = 0;
    let sinCoincidencia = 0;

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

    return { actualizados, sinCoincidencia, vinculadosActualizados: vinculadosActuales };
}