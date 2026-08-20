export interface RequisitosModal {
    visible: boolean;
    cargando: boolean;
    error: string;
    cedula: string;
    nombres: string;
    items: { nombre: string; estado: string }[];
    totalCumple: number;
    totalNoCumple: number;
}

export function requisitosModalVacio(): RequisitosModal {
    return {
        visible: false, cargando: false, error: '',
        cedula: '', nombres: '', items: [],
        totalCumple: 0, totalNoCumple: 0
    };
}

/**
 * Campos del documento de Firestore que NO son requisitos de titulación.
 * (Se deja disponible por si más adelante quieres excluir explícitamente
 * estos campos en vez de solo aceptar valores "CUMPLE"/"NO CUMPLE").
 */
export const CAMPOS_NO_REQUISITO = new Set([
    'Celular', 'CodigoCarrera', 'CorreoInstitucional', 'CorreoPersonal',
    'HorarioComplexivo', 'Nombres', 'Apellidos', 'NombreCompleto',
    'Carrera', 'Semestre', 'FechaIngreso', 'FechaNacimiento',
    'Direccion', 'Telefono', 'Email', 'Grupo', 'telegramUser',
    'telegramChatId', 'notificacionesActivas', 'asistencia',
    'fechaVinculacion', 'ingresadoManual', 'cedula', 'id'
]);

export interface ResultadoRequisitos {
    items: { nombre: string; estado: string }[];
    totalCumple: number;
    totalNoCumple: number;
}

/** Error específico para cuando no se encuentra el registro (mensaje amigable para mostrar al usuario) */
export class RequisitosNoEncontradoError extends Error {}

/**
 * Consulta Firestore (proyecto utet-4387a, colección "requisitos") por la
 * cédula del estudiante. Intenta con la cédula tal cual y, si empieza con
 * '0', también sin el cero inicial. Deduplica claves que difieren solo por
 * tildes (prefiriendo la variante con tilde) y ordena NO CUMPLE primero.
 */
export class RequisitosHelper {

    async buscar(cedula: string): Promise<ResultadoRequisitos> {
        const { collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
        const { getUtetFirestore } = await import('../../../firebase/utet-firestore');
        const db = getUtetFirestore();

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
            docSnap = await buscarPorCedula(cedula.slice(1));
        }

        if (!docSnap) {
            throw new RequisitosNoEncontradoError(
                'No se encontró el registro de este estudiante en la base de datos.'
            );
        }

        const data = docSnap.data() as Record<string, any>;
        const valores = (data['valores'] ?? {}) as Record<string, any>;

        const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        const porClaveNormalizada = new Map<string, { nombre: string; estado: string }>();
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
}