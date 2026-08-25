import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODULOS_SISTEMA, NivelPermiso, Permisos, SolicitudesService, UsuarioLogin } from '../../firebase/login';
import { HOME_CARDS } from '../../pages/Components/cardDescrip'; // 👈 ajusta la ruta real según donde esté este componente

interface SolicitudUI {
  clave: string;
  usuario: UsuarioLogin;
  permisosElegidos: Permisos;
  procesando: boolean;
}

@Component({
  selector: 'app-modal-solicitudes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-solicitudes.html',
  styleUrl: './modal-solicitudes.css'
})
export class ModalSolicitudes implements OnChanges {

  @Input() visible = false;
  @Output() cerrarEvento = new EventEmitter<void>();

  // 👇 nuevo: combina MODULOS_SISTEMA con los módulos de HOME_CARDS que no estén ya incluidos
  modulos = this.combinarModulos();

  solicitudes: SolicitudUI[] = [];
  cargando = false;

  constructor(
    private solicitudesService: SolicitudesService,
    private cdr: ChangeDetectorRef
  ) {}

  // 👇 nuevo
  private combinarModulos() {
    const clavesExistentes = new Set(MODULOS_SISTEMA.map(m => m.clave));

    const modulosFaltantes = HOME_CARDS
      .filter(card => !clavesExistentes.has(card.action))
      .map(card => ({
        clave: card.action,
        nombre: card.footer || card.title
      }));

    return [...MODULOS_SISTEMA, ...modulosFaltantes];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.cargarPendientes();
    }
  }

  private async cargarPendientes(): Promise<void> {
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const pendientes = await this.solicitudesService.obtenerPendientes();
      this.solicitudes = pendientes.map(p => ({
        clave: p.clave,
        usuario: p.usuario,
        permisosElegidos: this.modulos.reduce((acc, m) => {
          acc[m.clave] = 'sin_acceso';
          return acc;
        }, {} as Permisos),
        procesando: false
      }));
    } catch (e) {
      console.error('Error al cargar solicitudes pendientes:', e);
      this.solicitudes = [];
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  setPermiso(sol: SolicitudUI, moduloClave: string, nivel: NivelPermiso): void {
    sol.permisosElegidos[moduloClave] = nivel;
  }

  async aprobar(sol: SolicitudUI): Promise<void> {
    sol.procesando = true;
    this.cdr.detectChanges();

    try {
      await this.solicitudesService.aprobar(sol.clave, sol.permisosElegidos);
      this.solicitudes = this.solicitudes.filter(s => s.clave !== sol.clave);
    } catch (e) {
      console.error('Error al aprobar:', e);
      alert('Error al aprobar la solicitud.');
    } finally {
      sol.procesando = false;
      this.cdr.detectChanges();
    }
  }

  async rechazar(sol: SolicitudUI): Promise<void> {
    if (!confirm(`¿Rechazar el acceso de ${sol.usuario.correo}?`)) return;
    sol.procesando = true;
    this.cdr.detectChanges();

    try {
      await this.solicitudesService.rechazar(sol.clave);
      this.solicitudes = this.solicitudes.filter(s => s.clave !== sol.clave);
    } catch (e) {
      console.error('Error al rechazar:', e);
      alert('Error al rechazar la solicitud.');
    } finally {
      sol.procesando = false;
      this.cdr.detectChanges();
    }
  }

  cerrar(): void {
    this.cerrarEvento.emit();
  }
}