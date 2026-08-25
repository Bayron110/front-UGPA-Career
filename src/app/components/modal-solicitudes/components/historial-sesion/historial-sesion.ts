import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODULOS_SISTEMA, NivelPermiso, Permisos, SolicitudesService, UsuarioLogin } from '../../../../firebase/login';

interface UsuarioUI {
  clave: string;
  usuario: UsuarioLogin;
  permisosElegidos: Permisos;
  permisosOriginales: Permisos;
  modificado: boolean;
  guardando: boolean;
}

@Component({
  selector: 'app-historial-sesion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial-sesion.html',
  styleUrl: './historial-sesion.css'
})
export class HistorialSesion implements OnInit {

  modulos = MODULOS_SISTEMA;
  usuarios: UsuarioUI[] = [];
  cargando = false;
  filtro = '';

  constructor(
    private solicitudesService: SolicitudesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  get usuariosFiltrados(): UsuarioUI[] {
    const texto = this.filtro.trim().toLowerCase();
    if (!texto) return this.usuarios;
    return this.usuarios.filter(u => u.usuario.correo.toLowerCase().includes(texto));
  }

  private completarPermisos(permisos: Permisos): Permisos {
    const completos: Permisos = { ...permisos };
    this.modulos.forEach(m => {
      if (!(m.clave in completos)) completos[m.clave] = 'sin_acceso';
    });
    return completos;
  }

  private async cargarUsuarios(): Promise<void> {
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const todos = await this.solicitudesService.obtenerTodos();
      this.usuarios = todos
        .sort((a, b) => (b.usuario.fechaRegistro ?? '').localeCompare(a.usuario.fechaRegistro ?? ''))
        .map(u => {
          const permisosCompletos = this.completarPermisos(u.usuario.permisos ?? {});
          return {
            clave: u.clave,
            usuario: u.usuario,
            permisosElegidos: { ...permisosCompletos },
            permisosOriginales: { ...permisosCompletos },
            modificado: false,
            guardando: false
          };
        });
    } catch (e) {
      console.error('Error al cargar historial de usuarios:', e);
      this.usuarios = [];
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  setPermiso(u: UsuarioUI, moduloClave: string, nivel: NivelPermiso): void {
    u.permisosElegidos[moduloClave] = nivel;
    u.modificado = this.hayCambios(u);
  }

  private hayCambios(u: UsuarioUI): boolean {
    return this.modulos.some(m => u.permisosElegidos[m.clave] !== u.permisosOriginales[m.clave]);
  }

  async guardarCambios(u: UsuarioUI): Promise<void> {
    u.guardando = true;
    this.cdr.detectChanges();

    try {
      await this.solicitudesService.actualizarPermisos(u.clave, u.permisosElegidos);
      u.permisosOriginales = { ...u.permisosElegidos };
      u.modificado = false;
    } catch (e) {
      console.error('Error al actualizar permisos:', e);
      alert('Error al guardar los cambios.');
    } finally {
      u.guardando = false;
      this.cdr.detectChanges();
    }
  }

  descartarCambios(u: UsuarioUI): void {
    u.permisosElegidos = { ...u.permisosOriginales };
    u.modificado = false;
  }
}