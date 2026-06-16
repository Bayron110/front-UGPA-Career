import { Injectable } from '@angular/core';

import {
    initializeApp,
    getApps
} from 'firebase/app';

import {
    getDatabase,
    ref,
    get,
    set,
    update,
    remove
} from 'firebase/database';

// ── Usa la misma app "cronogramas" donde viven los cronogramas ──────────────
const firebaseConfig = {
    apiKey: "AIzaSyAl394v1xuNXxqkT6lEsiPQf74mFSIW6bw",
    authDomain: "cronogramas-estudiantes.firebaseapp.com",
    databaseURL: "https://cronogramas-estudiantes-default-rtdb.firebaseio.com",
    projectId: "cronogramas-estudiantes",
    storageBucket: "cronogramas-estudiantes.firebasestorage.app",
    messagingSenderId: "1079875324500",
    appId: "1:1079875324500:web:d398c2ea7e224c2d1c7bc1"
};

const app = getApps().find(a => a.name === 'cronogramas')
    ?? initializeApp(firebaseConfig, 'cronogramas');

const db = getDatabase(app);

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface Docente {
    cedula: string;
    nombres: string;
    cargo: string;
    departamento?: string;
    telegramUser?: string;
    telegramChatId?: string;           // ← campo del bot de Telegram
    notificacionesActivas?: boolean;   // ← campo del bot de Telegram
    creadoEn: string;
    /** IDs de cronogramas donde está vinculado (se actualiza en cada vinculación) */
    cronogramasAsignados?: string[];
}

/** Lo que se guarda DENTRO del cronograma — referencia con todos los campos relevantes */
export interface DocenteRef {
    cedula: string;
    nombres: string;
    cargo: string;
    fechaVinculacion: string;
    departamento?: string;
    telegramChatId?: string;
    notificacionesActivas?: boolean;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DocentesService {

    private ruta = 'docentes';

    // ── CRUD docentes ────────────────────────────────────────────────────────

    /** Guardar o actualizar un docente por cédula */
    async guardarDocente(docente: Docente): Promise<void> {
        await set(ref(db, `${this.ruta}/${docente.cedula}`), docente);
    }

    /** Obtener todos los docentes */
    async obtenerDocentes(): Promise<Docente[]> {
        const snapshot = await get(ref(db, this.ruta));
        if (!snapshot.exists()) return [];
        const data = snapshot.val();
        return Object.values(data) as Docente[];
    }

    /** Obtener un docente por cédula */
    async obtenerDocente(cedula: string): Promise<Docente | null> {
        const snapshot = await get(ref(db, `${this.ruta}/${cedula}`));
        if (!snapshot.exists()) return null;
        return snapshot.val() as Docente;
    }

    /** Eliminar un docente */
    async eliminarDocente(cedula: string): Promise<void> {
        await remove(ref(db, `${this.ruta}/${cedula}`));
    }

    // ── Vincular / desvincular dentro de un cronograma ───────────────────────

    /**
     * Vincula un docente a un cronograma:
     * 1. Guarda la referencia en /cronogramas/{id}/docentesVinculados/{cedula}
     *    copiando TODOS los campos relevantes (incluyendo telegramChatId,
     *    notificacionesActivas y departamento si existen)
     * 2. Actualiza la lista cronogramasAsignados en /docentes/{cedula}
     */
    async vincularAcronograma(
        docente: Docente,
        cronogramaId: string,
        actualizarCronograma: (id: string, datos: any) => Promise<void>
    ): Promise<void> {
        // ── FIX: leer el docente fresco desde Firebase para tener todos sus campos ──
        // (el objeto que llega puede venir del formulario y no tener telegramChatId, etc.)
        const docenteFresco = await this.obtenerDocente(docente.cedula) ?? docente;

        // 1. Referencia dentro del cronograma con todos los campos disponibles
        const ref_: DocenteRef = {
            cedula: docenteFresco.cedula,
            nombres: docenteFresco.nombres,
            cargo: docenteFresco.cargo,
            fechaVinculacion: new Date().toISOString(),
            // Solo incluir opcionales si tienen valor real
            ...(docenteFresco.departamento        && { departamento: docenteFresco.departamento }),
            ...(docenteFresco.telegramChatId      !== undefined && { telegramChatId: docenteFresco.telegramChatId }),
            ...(docenteFresco.notificacionesActivas !== undefined && { notificacionesActivas: docenteFresco.notificacionesActivas }),
        };

        await actualizarCronograma(cronogramaId, {
            [`docentesVinculados/${docenteFresco.cedula}`]: ref_
        });

        // 2. Actualizar cronogramasAsignados en /docentes/{cedula}
        const asignados = new Set<string>(docenteFresco.cronogramasAsignados ?? []);
        asignados.add(cronogramaId);

        await update(ref(db, `${this.ruta}/${docenteFresco.cedula}`), {
            cronogramasAsignados: Array.from(asignados)
        });
    }

    /**
     * Desvincula un docente de un cronograma:
     * 1. Borra la referencia en /cronogramas/{id}/docentesVinculados/{cedula}
     * 2. Quita el cronograma de cronogramasAsignados en /docentes/{cedula}
     */
    async desvincularDeCronograma(
        cedula: string,
        cronogramaId: string,
        actualizarCronograma: (id: string, datos: any) => Promise<void>
    ): Promise<void> {
        const docenteActual = await this.obtenerDocente(cedula);
        if (!docenteActual) return;

        // 1. Borrar referencia del cronograma (null = delete en Firebase RTDB)
        await actualizarCronograma(cronogramaId, {
            [`docentesVinculados/${cedula}`]: null
        });


        const asignados = new Set<string>(docenteActual.cronogramasAsignados ?? []);
        asignados.delete(cronogramaId);

        await update(ref(db, `${this.ruta}/${cedula}`), {
            cronogramasAsignados: Array.from(asignados)
        });
    }
}