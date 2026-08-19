import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HOME_CARDS } from '../Components/cardDescrip';
import { HomeCard } from '../../Interface/home/HomeCards';

type VentanaActiva = 'ingreso-carreras' | 'patrocinio' | 'plan-individual' | 'seguimiento' | 'historial' | 'Dashboard' | 'Activar';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {

  paginationEnabled = false;
  currentPage = 1;
  itemsPerPage = 4;
  allCards: HomeCard[] = HOME_CARDS;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const savedPagination = localStorage.getItem('paginationEnabled');
    const savedPage = localStorage.getItem('currentPage');
    this.paginationEnabled = savedPagination === 'true';
    this.currentPage = savedPage ? parseInt(savedPage) : 1;
    if (this.currentPage > this.totalPages) this.currentPage = 1;
  }

  get visibleCards() {
    if (!this.paginationEnabled) return this.allCards;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.allCards.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.allCards.length / this.itemsPerPage);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  togglePagination(enabled: boolean): void {
    this.paginationEnabled = enabled;
    this.currentPage = 1;
    localStorage.setItem('paginationEnabled', String(enabled));
    localStorage.setItem('currentPage', '1');
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      localStorage.setItem('currentPage', String(page));
    }
  }

  navigate(action: string): void {
    const routes: Record<string, () => void> = {
      iraControlInd: () => window.open('https://registroinduccionesitsqmet.netlify.app/admin/admin', '_blank'),
      irDocumentosWeb: () => this.router.navigate(['/Documentos-Web']),
      irAAgendar: () => this.router.navigate(['/Agenda']),
      irACronogramas: () => this.router.navigate(['/Cronogramas']),
      irAInformesUGPA: () => this.router.navigate(['/Informes-UGPA']),
      irADocentes: () => this.router.navigate(['Docente-Registro']),
      irATitulos: ()=> window.open('https://titulos-administrador.pages.dev/'),
      irAFacturación: ()=> window.open("")
    };
    routes[action]?.();
  }
}