// src/app/guards/permisos-guard/permisos-guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LoginService, NivelPermiso } from '../firebase/login';
import { obtenerUsuarioSesion } from './login-proteccion-guard';


// Jerarquía para poder comparar niveles ("edicion" cubre lo que pide "lectura")
const JERARQUIA: Record<NivelPermiso, number> = {
    sin_acceso: 0,
    lectura: 1,
    edicion: 2,
};

// ── Guard de ruta: bloquea la entrada a la URL si no tiene el nivel mínimo ──
export const permisosGuard: CanActivateFn = async (route, state) => {
    const router = inject(Router);
    const loginService = inject(LoginService);

    const usuario = obtenerUsuarioSesion();
    if (!usuario) {
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
    }

    // El admin tiene acceso total, sin importar lo que diga permisos
    if (usuario.rol === 'admin') return true;

    const moduloRequerido = route.data['modulo'] as string | undefined;
    const nivelMinimo = (route.data['nivelMinimo'] as NivelPermiso) ?? 'lectura';

    if (!moduloRequerido) return true;

    const permisos = await loginService.obtenerPermisosPorCorreo(usuario.correo);
    const nivelActual = permisos?.[moduloRequerido] ?? 'sin_acceso';

    if (JERARQUIA[nivelActual] >= JERARQUIA[nivelMinimo]) {
        return true;
    }

    router.navigate(['/Home']);
    return false;
};

// ── Helper para usar DENTRO de componentes ya cargados: ──
// "¿el usuario en sesión tiene al menos este nivel para este módulo?"
// Usa el permiso que quedó guardado en sessionStorage al momento del login
// (no consulta la BD en cada llamada, a diferencia del guard de arriba).
export function tienePermiso(modulo: string, nivelMinimo: NivelPermiso = 'lectura'): boolean {
    const usuario = obtenerUsuarioSesion();
    if (!usuario) return false;

    // El admin tiene acceso total, sin importar lo que diga permisos
    if (usuario.rol === 'admin') return true;

    const nivelActual = usuario.permisos?.[modulo] ?? 'sin_acceso';
    return JERARQUIA[nivelActual] >= JERARQUIA[nivelMinimo];
}