import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
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
export class Home implements OnInit, AfterViewInit, OnDestroy {

  paginationEnabled = false;
  currentPage = 1;
  itemsPerPage = 4;
  allCards: HomeCard[] = HOME_CARDS;
  private animFrame!: number;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const savedPagination = localStorage.getItem('paginationEnabled');
    const savedPage = localStorage.getItem('currentPage');
    this.paginationEnabled = savedPagination === 'true';
    this.currentPage = savedPage ? parseInt(savedPage) : 1;
    if (this.currentPage > this.totalPages) this.currentPage = 1;
  }

  ngAfterViewInit(): void {
    this.initHUD();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrame);
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
      irAInformesUGPA: () => this.router.navigate(['/Informes-UGPA'])
    };
    routes[action]?.();
  }

  private initHUD(): void {
    const canvas = document.getElementById('hudBg') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const parent = canvas.parentElement!;

    const resize = () => {
      canvas.width  = parent.offsetWidth;
      canvas.height = Math.max(parent.offsetHeight, window.innerHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    const getOx = () => canvas.width * 0.78;
    const getOy = () => canvas.height * 0.42;

    const rings = [
      { r: 180, speed: 0.004, dash: [6, 4],  dir:  1, alpha: 0.45, width: 1.5 },
      { r: 155, speed: 0.007, dash: [2, 8],  dir: -1, alpha: 0.30, width: 1.0 },
      { r: 125, speed: 0.012, dash: [12, 3], dir:  1, alpha: 0.40, width: 1.0 },
      { r:  98, speed: 0.018, dash: [4, 4],  dir: -1, alpha: 0.55, width: 1.5 },
      { r:  70, speed: 0.025, dash: [2, 2],  dir:  1, alpha: 0.35, width: 1.0 },
      { r:  42, speed: 0.035, dash: [8, 2],  dir: -1, alpha: 0.65, width: 2.0 },
    ];
    const angles = rings.map(() => Math.random() * Math.PI * 2);

    const ticks = Array.from({ length: 72 }, (_, i) => ({
      angle: (i / 72) * Math.PI * 2,
      len:   i % 6 === 0 ? 14 : i % 3 === 0 ? 8 : 4,
      r:     190,
      alpha: i % 6 === 0 ? 0.65 : 0.20
    }));

    const particles = Array.from({ length: 80 }, () => ({
      x:     Math.random() * window.innerWidth,
      y:     Math.random() * window.innerHeight,
      r:     Math.random() * 2 + 0.4,
      vx:    (Math.random() - 0.5) * 0.35,
      vy:    -(Math.random() * 0.5 + 0.1),
      alpha: Math.random() * 0.55 + 0.15,
      pulse: Math.random() * Math.PI * 2,
      green: Math.random() < 0.2
    }));

    const scanDots = Array.from({ length: 50 }, () => ({
      x:     Math.random() * window.innerWidth,
      y:     Math.random() * window.innerHeight,
      r:     Math.random() * 2.5 + 0.8,
      alpha: Math.random() * 0.35 + 0.08,
      green: Math.random() < 0.25,
      pulse: Math.random() * Math.PI * 2
    }));

    const draw = () => {
      const w  = canvas.width;
      const h  = canvas.height;
      const ox = getOx();
      const oy = getOy();

      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#000d1a';
      ctx.fillRect(0, 0, w, h);

      const bgG = ctx.createRadialGradient(ox, oy, 0, ox, oy, 300);
      bgG.addColorStop(0, 'rgba(0,60,90,0.3)');
      bgG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, w, h);

      ctx.setLineDash([4, 6]);
      [
        [oy - 55, 0.22], [oy + 55, 0.15],
        [oy - 100, 0.12], [oy + 100, 0.10]
      ].forEach(([y, a]) => {
        ctx.beginPath();
        ctx.moveTo(0, y as number);
        ctx.lineTo(ox - 210, y as number);
        ctx.strokeStyle = `rgba(0,229,255,${a})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      });
      ctx.setLineDash([]);

      scanDots.forEach(d => {
        d.pulse += 0.03;
        const a = d.alpha * (0.6 + 0.4 * Math.sin(d.pulse));
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.green
          ? `rgba(105,255,71,${a})`
          : `rgba(0,229,255,${a})`;
        ctx.fill();
      });

      rings.forEach((ring, i) => {
        angles[i] += ring.speed * ring.dir;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(angles[i]);
        ctx.beginPath();
        ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,229,255,${ring.alpha})`;
        ctx.lineWidth = ring.width;
        ctx.setLineDash(ring.dash);
        ctx.stroke();
        ctx.restore();
      });

      ctx.setLineDash([]);
      ticks.forEach(tk => {
        const x1 = ox + Math.cos(tk.angle) * tk.r;
        const y1 = oy + Math.sin(tk.angle) * tk.r;
        const x2 = ox + Math.cos(tk.angle) * (tk.r + tk.len);
        const y2 = oy + Math.sin(tk.angle) * (tk.r + tk.len);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(0,229,255,${tk.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      const coreG = ctx.createRadialGradient(ox, oy, 0, ox, oy, 42);
      coreG.addColorStop(0, 'rgba(0,229,255,0.28)');
      coreG.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.beginPath();
      ctx.arc(ox, oy, 42, 0, Math.PI * 2);
      ctx.fillStyle = coreG;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ox, oy, 13, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,229,255,0.85)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ox, oy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      particles.forEach(p => {
        p.pulse += 0.025;
        const a = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.green
          ? `rgba(105,255,71,${a})`
          : `rgba(0,229,255,${a})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -5)  { p.y = h + 5; p.x = Math.random() * w; }
        if (p.x < -5)  p.x = w + 5;
        if (p.x > w+5) p.x = -5;
      });

      this.animFrame = requestAnimationFrame(draw);
    };

    draw();
  }
}