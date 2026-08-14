export interface ItemRequisito {
    nombre: string;
    estado: string;
}

export interface ResultadoRequisitos {
    items: ItemRequisito[];
    totalCumple: number;
    totalNoCumple: number;
}

/**
 * Consulta Firestore (proyecto utet-4387a, colección "requisitos") por la
 * cédula de un estudiante o persona vinculada, y devuelve solo los campos
 * marcados como "CUMPLE" / "NO CUMPLE", ordenados con los pendientes
 * primero.
 *
 * Lanza un Error si no se encuentra el registro, para que el llamador
 * decida cómo mostrarlo (el mensaje del Error es apto para mostrar
 * directamente al usuario).
 */
export async function obtenerRequisitos(cedula: string): Promise<ResultadoRequisitos> {
    const { collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
    const { getUtetFirestore } = await import('../../../firebase/utet-firestore');
    const db = getUtetFirestore();

    // Busca por el campo "cedula" (ya no es el ID del documento).
    // Toma el registro más reciente (por updatedAt) que no esté eliminado.
    const buscarPorCedula = async (ced: string) => {
        const q = query(
            collection(db, 'requisitos'),
            where('cedula', '==', ced),
            where('eliminado', '==', false),
            orderBy('updatedAt', 'desc'),
            limit(1)
        );
        const res = await getDocs(q);
        return res.empty ? null : res.docs[0];
    };

    // Intento 1: cédula tal como viene
    let docSnap = await buscarPorCedula(cedula);

    // Intento 2: si empieza con '0', probar sin el cero inicial
    if (!docSnap && cedula.startsWith('0')) {
        const cedulaSin0 = cedula.slice(1);
        docSnap = await buscarPorCedula(cedulaSin0);
    }

    if (!docSnap) {
        throw new Error('No se encontró el registro de este estudiante en la base de datos.');
    }

    const data = docSnap.data() as Record<string, any>;
    const valores = (data['valores'] ?? {}) as Record<string, any>;

    // Deduplicar claves que difieren solo por tildes
    // (ej. "ActualizacionDatos" vs "ActualizaciónDatos"),
    // prefiriendo la variante con tilde.
    const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const porClaveNormalizada = new Map<string, ItemRequisito>();
    for (const [key, value] of Object.entries(valores)) {
        if (value !== 'CUMPLE' && value !== 'NO CUMPLE') continue;
        const clave = sinTildes(key).toLowerCase();
        const existente = porClaveNormalizada.get(clave);
        const tieneTilde = sinTildes(key) !== key;
        if (!existente || tieneTilde) {
            porClaveNormalizada.set(clave, { nombre: key, estado: value as string });
        }
    }
    const items = [...porClaveNormalizada.values()];

    // Ordenar: primero NO CUMPLE (pendientes), luego CUMPLE, alfabético dentro de cada grupo
    items.sort((a, b) => {
        if (a.estado !== b.estado) return a.estado === 'NO CUMPLE' ? -1 : 1;
        return a.nombre.localeCompare(b.nombre, 'es');
    });

    return {
        items,
        totalCumple: items.filter(i => i.estado === 'CUMPLE').length,
        totalNoCumple: items.filter(i => i.estado === 'NO CUMPLE').length
    };
}