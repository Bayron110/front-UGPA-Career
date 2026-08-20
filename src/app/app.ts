import { Component, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ModalSolicitudes } from './components/modal-solicitudes/modal-solicitudes';
import { NavBar } from './components/nav-bar/nav-bar';
import { Footer } from "./components/footer/footer";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavBar, ModalSolicitudes, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  mostrarNavbar = true;
  modalSolicitudesVisible = false;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        this.mostrarNavbar = !e.urlAfterRedirects.startsWith('/login');
        this.cdr.detectChanges();
      });
  }

  @HostListener('window:keydown', ['$event'])
  manejarAtajoTeclado(evento: KeyboardEvent): void {
    const combinacion = (evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'm';
    if (!combinacion) return;

    if (!this.esAdmin()) return;

    evento.preventDefault();
    this.modalSolicitudesVisible = !this.modalSolicitudesVisible;
    this.cdr.detectChanges(); // 👈 nuevo
  }

  private esAdmin(): boolean {
    const datos = sessionStorage.getItem('usuarioActual');
    if (!datos) return false;
    try {
      const usuario = JSON.parse(datos);
      return usuario?.rol === 'admin';
    } catch {
      return false;
    }
  }

  cerrarModalSolicitudes(): void {
    this.modalSolicitudesVisible = false;
    this.cdr.detectChanges(); // 👈 nuevo
  }
}