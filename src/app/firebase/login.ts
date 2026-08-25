import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getDatabase, ref, get, set } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyDpnxali4mzuBlRS5W1agtoaYmshnJqmuE",
    authDomain: "registro-utet-estudiantes.firebaseapp.com",
    databaseURL: "https://registro-utet-estudiantes-default-rtdb.firebaseio.com",
    projectId: "registro-utet-estudiantes",
    storageBucket: "registro-utet-estudiantes.firebasestorage.app",
    messagingSenderId: "354665324174",
    appId: "1:354665324174:web:59d7cb0dba476d78c4f3df",
    measurementId: "G-LPTHYRRGCP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

if (typeof window !== 'undefined') {
    isSupported().then(soportado => { if (soportado) getAnalytics(app); });
}

// ── Módulos del sistema ──
// La clave coincide EXACTAMENTE con el "action" de cada tarjeta en
// cardDescrip.ts, así se puede cruzar directo con HOME_CARDS para
// mostrar/ocultar tarjetas según el permiso del usuario.
// Si agregas una tarjeta nueva en cardDescrip.ts, agrega su módulo aquí también.
export const MODULOS_SISTEMA = [
    { clave: 'iraControlInd', nombre: 'Panel de Administrador (Inducciones)' },
    { clave: 'irDocumentosWeb', nombre: 'Documentos Web Docentes' },
    { clave: 'irACronogramas', nombre: 'Cronogramas' },
    { clave: 'irAInformesUGPA', nombre: 'Informes del Proceso de Capacitación Docente' },
    { clave: 'irADocentes', nombre: 'Docentes registrados' },
    { clave: 'irATitulos', nombre: 'Administración de Títulos' },
];

export type NivelPermiso = 'sin_acceso' | 'lectura' | 'edicion';
export type Permisos = Record<string, NivelPermiso>;

export interface UsuarioLogin {
    correo: string;
    contraseña: string;
    rol: 'admin' | 'usuario';
    estado: 'pendiente' | 'aprobado' | 'rechazado';
    permisos: Permisos;
    fechaRegistro: string;
    fechaAprobacion?: string;
}

export interface ResultadoLogin {
    exito: boolean;
    esNuevo: boolean;
    pendiente: boolean;
    rechazado: boolean;
    mensaje: string;
    usuario?: UsuarioLogin;
    clave?: string;
}

function permisosVacios(nivel: NivelPermiso): Permisos {
    const p: Permisos = {};
    MODULOS_SISTEMA.forEach(m => p[m.clave] = nivel);
    return p;
}

@Injectable({ providedIn: 'root' })
export class LoginService {

    private readonly NODO = 'correo_login';

    private async hashPassword(texto: string): Promise<string> {
        const datos = new TextEncoder().encode(texto);
        const buffer = await crypto.subtle.digest('SHA-256', datos);
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private generarClave(correo: string, numero: number): string {
        const prefijo = correo.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 6);
        return `${numero}_${prefijo}`;
    }

    private async buscarPorCorreo(correo: string): Promise<{ clave: string, usuario: UsuarioLogin } | null> {
        const snapshot = await get(ref(db, this.NODO));
        if (!snapshot.exists()) return null;

        const datos = snapshot.val() as Record<string, UsuarioLogin>;
        const correoNormalizado = correo.trim().toLowerCase();

        for (const clave of Object.keys(datos)) {
            if (datos[clave].correo?.trim().toLowerCase() === correoNormalizado) {
                return { clave, usuario: datos[clave] };
            }
        }
        return null;
    }

    /** Rellena con 'sin_acceso' cualquier módulo nuevo que un usuario existente no tenga aún */
    private completarPermisosFaltantes(permisos: Permisos): Permisos {
        const completos: Permisos = { ...permisos };
        MODULOS_SISTEMA.forEach(m => {
            if (!(m.clave in completos)) completos[m.clave] = 'sin_acceso';
        });
        return completos;
    }

    async iniciarSesionORegistrar(correo: string, contraseña: string): Promise<ResultadoLogin> {
        const correoLimpio = correo.trim().toLowerCase();
        const encontrado = await this.buscarPorCorreo(correoLimpio);
        const hashIngresado = await this.hashPassword(contraseña);

        if (encontrado) {
            const { clave, usuario } = encontrado;

            if (usuario.contraseña !== hashIngresado) {
                return { exito: false, esNuevo: false, pendiente: false, rechazado: false, mensaje: 'Contraseña incorrecta.' };
            }
            if (usuario.estado === 'rechazado') {
                return { exito: false, esNuevo: false, pendiente: false, rechazado: true, mensaje: 'Tu acceso fue rechazado por el administrador.' };
            }
            if (usuario.estado === 'pendiente') {
                return { exito: false, esNuevo: false, pendiente: true, rechazado: false, mensaje: 'Tu cuenta está pendiente de aprobación del administrador.' };
            }

            // Usuario aprobado: completa permisos si le faltan módulos nuevos
            const usuarioConPermisosCompletos: UsuarioLogin = {
                ...usuario,
                permisos: this.completarPermisosFaltantes(usuario.permisos ?? {})
            };

            return {
                exito: true, esNuevo: false, pendiente: false, rechazado: false,
                mensaje: 'Sesión iniciada correctamente.',
                usuario: usuarioConPermisosCompletos, clave
            };
        }

        // ── Usuario nuevo ──
        const snapshotTodos = await get(ref(db, this.NODO));
        const total = snapshotTodos.exists() ? Object.keys(snapshotTodos.val()).length : 0;
        const esPrimero = total === 0;
        const clave = this.generarClave(correoLimpio, total + 1);

        const nuevoUsuario: UsuarioLogin = {
            correo: correoLimpio,
            contraseña: hashIngresado,
            rol: esPrimero ? 'admin' : 'usuario',
            estado: esPrimero ? 'aprobado' : 'pendiente',
            permisos: esPrimero ? permisosVacios('edicion') : permisosVacios('sin_acceso'),
            fechaRegistro: new Date().toISOString(),
            ...(esPrimero ? { fechaAprobacion: new Date().toISOString() } : {})
        };

        await set(ref(db, `${this.NODO}/${clave}`), nuevoUsuario);

        if (esPrimero) {
            return { exito: true, esNuevo: true, pendiente: false, rechazado: false, mensaje: 'Cuenta creada. Rol asignado: administrador.', usuario: nuevoUsuario, clave };
        }
        return { exito: false, esNuevo: true, pendiente: true, rechazado: false, mensaje: 'Cuenta creada. Espera la aprobación del administrador para ingresar.' };
    }

    /**
     * Consulta en la BD los permisos actuales de un usuario por su correo.
     * Se usa desde permisosGuard para validar acceso a rutas con el dato
     * siempre fresco (no el que quedó guardado en sessionStorage al hacer login).
     * Retorna null si el correo no existe en la BD.
     */
    async obtenerPermisosPorCorreo(correo: string): Promise<Permisos | null> {
        const encontrado = await this.buscarPorCorreo(correo);
        if (!encontrado) return null;
        return this.completarPermisosFaltantes(encontrado.usuario.permisos ?? {});
    }
}

// ── Servicio de solicitudes (para el modal del admin) ──
@Injectable({ providedIn: 'root' })
export class SolicitudesService {

    private readonly NODO = 'correo_login';

    async obtenerPendientes(): Promise<Array<{ clave: string, usuario: UsuarioLogin }>> {
        const snapshot = await get(ref(db, this.NODO));
        if (!snapshot.exists()) return [];

        const datos = snapshot.val() as Record<string, UsuarioLogin>;
        return Object.keys(datos)
            .filter(clave => datos[clave].estado === 'pendiente')
            .map(clave => ({ clave, usuario: datos[clave] }));
    }

    /**
     * Trae TODOS los usuarios registrados sin filtrar por estado
     * (pendientes, aprobados y rechazados). Se usa en HistorialSesion.
     */
    async obtenerTodos(): Promise<Array<{ clave: string, usuario: UsuarioLogin }>> {
        const snapshot = await get(ref(db, this.NODO));
        if (!snapshot.exists()) return [];

        const datos = snapshot.val() as Record<string, UsuarioLogin>;
        return Object.keys(datos).map(clave => ({ clave, usuario: datos[clave] }));
    }

    async aprobar(clave: string, permisos: Permisos): Promise<void> {
        await set(ref(db, `${this.NODO}/${clave}/estado`), 'aprobado');
        await set(ref(db, `${this.NODO}/${clave}/permisos`), permisos);
        await set(ref(db, `${this.NODO}/${clave}/fechaAprobacion`), new Date().toISOString());
    }

    async rechazar(clave: string): Promise<void> {
        await set(ref(db, `${this.NODO}/${clave}/estado`), 'rechazado');
    }

    /**
     * Actualiza únicamente los permisos de un usuario ya existente
     * (aprobado, pendiente o rechazado), sin tocar su estado.
     * Se usa desde HistorialSesion para editar permisos.
     */
    async actualizarPermisos(clave: string, permisos: Permisos): Promise<void> {
        await set(ref(db, `${this.NODO}/${clave}/permisos`), permisos);
    }
}