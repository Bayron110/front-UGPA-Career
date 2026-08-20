import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export interface UsuarioSesion {
  correo: string;
  rol: 'admin' | 'usuario';
  permisos?: Record<string, 'sin_acceso' | 'lectura' | 'edicion'>;
}

export function obtenerUsuarioSesion(): UsuarioSesion | null {
  const datos = sessionStorage.getItem('usuarioActual');
  if (!datos) return null;
  try {
    const usuario = JSON.parse(datos);
    return usuario?.correo && usuario?.rol ? usuario as UsuarioSesion : null;
  } catch {
    return null;
  }
}

export const loginProteccionGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const usuario = obtenerUsuarioSesion();

  if (usuario) return true;

  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

