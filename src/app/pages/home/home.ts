import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HOME_CARDS, HomeCard } from '../Components/cardDescrip';

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

    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
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
      irACarrera:    () => this.router.navigate(['/Carrera']),
      irATipo:       () => this.router.navigate(['/Tipo']),
      irACalCareer:  () => this.router.navigate(['/Cal']),
      irAHistory:    () => this.router.navigate(['/history']),
      irAHistorytsu: () => this.router.navigate(['/history-tsu']),
      irAGenerar:    () => this.router.navigate(['/generar']),
      irAReporteA:   () => this.router.navigate(['/reporteA']),
      irAReporteR:   () => this.router.navigate(['/ReporteR']),
      irAAgenda:     () => this.router.navigate(['/Agenda']),
      iraControl:    () => this.router.navigate(['/Control']),
      iraDas:        () => this.router.navigate(['/Dash']),
      iraControlInd: () => window.location.href = 'https://controlasistenciaitsq.netlify.app/admin/admin',
    };
    routes[action]?.();
  }
}