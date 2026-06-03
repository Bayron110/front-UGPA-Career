import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PublicarCronogramas } from './components/publicar-cronogramas/publicar-cronogramas';
import { HistorialCronogramas } from './components/historial-cronogramas/historial-cronogramas';

import {
  CronogramaService,
  ActividadCronograma,
  Cronograma
} from './firebase/cronogramas';

@Component({
  selector: 'app-cronogramas',
  standalone: true,
  imports: [CommonModule, FormsModule, PublicarCronogramas, HistorialCronogramas],
  templateUrl: './cronogramas.html',
  styleUrl: './cronogramas.css'
})
export class Cronogramas implements AfterViewInit, OnDestroy {

  menuSeleccionado = 'publicar';
  private animFrame!: number;
  private resizeHandler!: () => void;

  // ── Modal ──
  modalAbierto = false;
  cronogramaEditando: Cronograma | null = null;
  editNombre = '';
  editPeriodo = '';
  editColorFondo = '';
  editColorTexto = '';
  editColorBorde = '';
  editFuente = '';
  editActividades: ActividadCronograma[] = [];
  editNuevaActividad = '';
  editNuevaFechaInicio = '';
  editNuevaFechaFin = '';
  guardando = false;

  constructor(private cronogramaService: CronogramaService) {}

  cambiarVista(vista: string): void {
    this.menuSeleccionado = vista;
  }

  // ── Recibe el evento del hijo ──
  onAbrirModal(c: Cronograma): void {
    this.cronogramaEditando = c;
    this.editNombre       = c.nombre;
    this.editPeriodo      = c.periodo;
    this.editColorFondo   = c.colorFondo;
    this.editColorTexto   = c.colorTexto;
    this.editColorBorde   = c.colorBorde;
    this.editFuente       = c.fuente;
    this.editActividades  = c.actividades.map(a => ({ ...a }));
    this.editNuevaActividad   = '';
    this.editNuevaFechaInicio = '';
    this.editNuevaFechaFin    = '';
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.cronogramaEditando = null;
  }

  agregarActividadModal(): void {
    if (!this.editNuevaActividad || !this.editNuevaFechaInicio || !this.editNuevaFechaFin) return;
    this.editActividades = [...this.editActividades, {
      actividad:   this.editNuevaActividad,
      fechaInicio: this.editNuevaFechaInicio,
      fechaFin:    this.editNuevaFechaFin
    }].sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
    this.editNuevaActividad = '';
    this.editNuevaFechaInicio = '';
    this.editNuevaFechaFin = '';
  }

  eliminarActividadModal(index: number): void {
    this.editActividades = this.editActividades.filter((_, i) => i !== index);
  }

  async guardarCambios(): Promise<void> {
    if (!this.cronogramaEditando?.id) return;
    this.guardando = true;
    try {
      const fechaInicio = this.cronogramaService.obtenerFechaInicio(this.editActividades);
      const fechaFin    = this.cronogramaService.obtenerFechaFin(this.editActividades);
      const estado      = this.cronogramaService.calcularEstado(fechaInicio, fechaFin);

      await this.cronogramaService.actualizarCronograma(this.cronogramaEditando.id, {
        nombre:      this.editNombre,
        periodo:     this.editPeriodo,
        colorFondo:  this.editColorFondo,
        colorTexto:  this.editColorTexto,
        colorBorde:  this.editColorBorde,
        fuente:      this.editFuente,
        actividades: this.editActividades,
        fechaInicio,
        fechaFin,
        estado
      });
      this.cerrarModal();
    } catch (error) {
      console.error(error);
      alert('Error al guardar los cambios');
    } finally {
      this.guardando = false;
    }
  }

  vincularEstudiantes(): void {
    // TODO
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '-';
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
  }

  // ── Canvas HUD ──
  ngAfterViewInit(): void {
    setTimeout(() => this.initHUD(), 50);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrame);
    window.removeEventListener('resize', this.resizeHandler);
  }

  private initHUD(): void {
    const canvas = document.getElementById('cronogramasBg') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    this.resizeHandler = resize;
    window.addEventListener('resize', this.resizeHandler);

    const ox = () => canvas.width  * 0.5;
    const oy = () => canvas.height * 0.5;

    const rings = [
      { r: 240, speed: 0.0015, dash: [1, 5],    dir:  1, alpha: 0.20, width: 0.8 },
      { r: 220, speed: 0.004,  dash: [40, 12],  dir: -1, alpha: 0.55, width: 2.5 },
      { r: 220, speed: 0.004,  dash: [20, 32],  dir: -1, alpha: 0.30, width: 1.0 },
      { r: 195, speed: 0.002,  dash: [2, 6],    dir:  1, alpha: 0.25, width: 0.8 },
      { r: 175, speed: 0.007,  dash: [30, 15],  dir:  1, alpha: 0.60, width: 2.0 },
      { r: 175, speed: 0.007,  dash: [10, 35],  dir:  1, alpha: 0.25, width: 1.0 },
      { r: 155, speed: 0.0025, dash: [1000, 0], dir: -1, alpha: 0.18, width: 1.0 },
      { r: 135, speed: 0.014,  dash: [25, 20],  dir: -1, alpha: 0.65, width: 2.0 },
      { r: 135, speed: 0.014,  dash: [8, 37],   dir: -1, alpha: 0.30, width: 1.0 },
      { r: 112, speed: 0.005,  dash: [3, 5],    dir:  1, alpha: 0.30, width: 1.0 },
      { r:  90, speed: 0.020,  dash: [18, 18],  dir:  1, alpha: 0.70, width: 2.5 },
      { r:  90, speed: 0.020,  dash: [6, 30],   dir:  1, alpha: 0.35, width: 1.0 },
      { r:  68, speed: 0.030,  dash: [12, 8],   dir: -1, alpha: 0.55, width: 1.5 },
      { r:  68, speed: 0.030,  dash: [3, 17],   dir: -1, alpha: 0.25, width: 1.0 },
      { r:  45, speed: 0.040,  dash: [8, 4],    dir:  1, alpha: 0.80, width: 2.5 },
      { r:  45, speed: 0.040,  dash: [2, 10],   dir:  1, alpha: 0.40, width: 1.0 },
    ];
    const angles = rings.map(() => Math.random() * Math.PI * 2);

    const ticksOuter = Array.from({ length: 96 }, (_, i) => ({
      angle: (i / 96) * Math.PI * 2,
      len:   i % 8 === 0 ? 16 : i % 4 === 0 ? 10 : i % 2 === 0 ? 6 : 3,
      r: 248,
      alpha: i % 8 === 0 ? 0.80 : i % 4 === 0 ? 0.50 : 0.20,
      width: i % 8 === 0 ? 1.5 : 0.8
    }));

    const ticksMid = Array.from({ length: 60 }, (_, i) => ({
      angle: (i / 60) * Math.PI * 2,
      len:   i % 5 === 0 ? 10 : 5,
      r: 200,
      alpha: i % 5 === 0 ? 0.55 : 0.20,
      width: i % 5 === 0 ? 1.2 : 0.7
    }));

    const ticksInner = Array.from({ length: 36 }, (_, i) => ({
      angle: (i / 36) * Math.PI * 2,
      len:   i % 3 === 0 ? 8 : 4,
      r: 118,
      alpha: i % 3 === 0 ? 0.60 : 0.20,
      width: 0.8
    }));

    const hudLines = [
      { side: 'left',  yOff: -80, len: 200, alpha: 0.30, dash: [20, 6, 4, 6] },
      { side: 'left',  yOff: -50, len: 280, alpha: 0.20, dash: [8, 8]        },
      { side: 'left',  yOff:  50, len: 240, alpha: 0.25, dash: [15, 6]       },
      { side: 'left',  yOff:  80, len: 180, alpha: 0.18, dash: [5, 10]       },
      { side: 'right', yOff: -70, len: 220, alpha: 0.30, dash: [20, 6, 4, 6] },
      { side: 'right', yOff: -40, len: 300, alpha: 0.20, dash: [8, 8]        },
      { side: 'right', yOff:  60, len: 250, alpha: 0.25, dash: [15, 6]       },
      { side: 'right', yOff:  90, len: 170, alpha: 0.18, dash: [5, 10]       },
    ];

    const hudVLines = [
      { xOff: -260, yStart: -120, yEnd:  80, alpha: 0.22, dash: [10, 6] },
      { xOff: -240, yStart:  -60, yEnd: 140, alpha: 0.15, dash: [4, 10] },
      { xOff:  260, yStart: -100, yEnd:  90, alpha: 0.22, dash: [10, 6] },
      { xOff:  240, yStart:  -50, yEnd: 150, alpha: 0.15, dash: [4, 10] },
    ];

    const particles = Array.from({ length: 100 }, () => ({
      x:     Math.random() * window.innerWidth,
      y:     Math.random() * window.innerHeight,
      r:     Math.random() * 1.8 + 0.3,
      vx:    (Math.random() - 0.5) * 0.30,
      vy:    -(Math.random() * 0.45 + 0.06),
      alpha: Math.random() * 0.50 + 0.10,
      pulse: Math.random() * Math.PI * 2,
      green: Math.random() < 0.15
    }));

    const scanDots = Array.from({ length: 60 }, () => ({
      x:     Math.random() * window.innerWidth,
      y:     Math.random() * window.innerHeight,
      r:     Math.random() * 2.2 + 0.5,
      alpha: Math.random() * 0.28 + 0.05,
      green: Math.random() < 0.20,
      pulse: Math.random() * Math.PI * 2
    }));

    let corePhase = 0;

    const draw = () => {
      if (!canvas.isConnected) { cancelAnimationFrame(this.animFrame); return; }

      const w = canvas.width, h = canvas.height;
      const cx = ox(), cy = oy();

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#000d1a';
      ctx.fillRect(0, 0, w, h);

      const bgG = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420);
      bgG.addColorStop(0,   'rgba(0,80,120,0.22)');
      bgG.addColorStop(0.4, 'rgba(0,40,70,0.14)');
      bgG.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, w, h);

      scanDots.forEach(d => {
        d.pulse += 0.022;
        const a = d.alpha * (0.55 + 0.45 * Math.sin(d.pulse));
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.green ? `rgba(105,255,71,${a})` : `rgba(0,229,255,${a})`;
        ctx.fill();
      });

      hudLines.forEach(l => {
        const startX = l.side === 'left' ? cx - 250 - l.len : cx + 250;
        const endX   = l.side === 'left' ? cx - 250         : cx + 250 + l.len;
        ctx.beginPath(); ctx.moveTo(startX, cy + l.yOff); ctx.lineTo(endX, cy + l.yOff);
        ctx.strokeStyle = `rgba(0,229,255,${l.alpha})`; ctx.lineWidth = 0.8;
        ctx.setLineDash(l.dash); ctx.stroke(); ctx.setLineDash([]);
        const tx = l.side === 'left' ? startX : endX;
        ctx.fillStyle = `rgba(0,229,255,${l.alpha * 1.5})`;
        ctx.fillRect(tx - 2, cy + l.yOff - 2, 4, 4);
      });

      hudVLines.forEach(l => {
        ctx.beginPath(); ctx.moveTo(cx + l.xOff, cy + l.yStart); ctx.lineTo(cx + l.xOff, cy + l.yEnd);
        ctx.strokeStyle = `rgba(0,229,255,${l.alpha})`; ctx.lineWidth = 0.7;
        ctx.setLineDash(l.dash); ctx.stroke();
      });
      ctx.setLineDash([]);

      [ticksOuter, ticksMid, ticksInner].forEach(group => {
        group.forEach(tk => {
          const x1 = cx + Math.cos(tk.angle) * tk.r, y1 = cy + Math.sin(tk.angle) * tk.r;
          const x2 = cx + Math.cos(tk.angle) * (tk.r + tk.len), y2 = cy + Math.sin(tk.angle) * (tk.r + tk.len);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(0,229,255,${tk.alpha})`; ctx.lineWidth = tk.width; ctx.stroke();
        });
      });

      rings.forEach((ring, i) => {
        angles[i] += ring.speed * ring.dir;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(angles[i]);
        ctx.beginPath(); ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,229,255,${ring.alpha})`; ctx.lineWidth = ring.width;
        ctx.setLineDash(ring.dash); ctx.stroke(); ctx.restore();
      });
      ctx.setLineDash([]);

      corePhase += 0.025;
      const corePulse = 0.75 + 0.25 * Math.sin(corePhase);
      const coreGlow  = 0.85 + 0.15 * Math.sin(corePhase * 1.3);

      const halo1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 55 * corePulse);
      halo1.addColorStop(0, `rgba(0,229,255,${0.18 * coreGlow})`);
      halo1.addColorStop(0.5, `rgba(0,150,200,${0.10 * coreGlow})`);
      halo1.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.beginPath(); ctx.arc(cx, cy, 55 * corePulse, 0, Math.PI * 2);
      ctx.fillStyle = halo1; ctx.fill();

      const sphere = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 22);
      sphere.addColorStop(0,   `rgba(180,240,255,${0.95 * coreGlow})`);
      sphere.addColorStop(0.3, `rgba(0,229,255,${0.85 * coreGlow})`);
      sphere.addColorStop(0.7, `rgba(0,100,180,${0.70 * coreGlow})`);
      sphere.addColorStop(1,   `rgba(0,30,60,${0.90 * coreGlow})`);
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fillStyle = sphere; ctx.fill();

      const shine = ctx.createRadialGradient(cx - 6, cy - 8, 1, cx - 4, cy - 5, 14);
      shine.addColorStop(0,   `rgba(255,255,255,${0.55 * coreGlow})`);
      shine.addColorStop(0.5, `rgba(180,240,255,${0.15 * coreGlow})`);
      shine.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fillStyle = shine; ctx.fill();

      const dot = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
      dot.addColorStop(0,   '#ffffff');
      dot.addColorStop(0.4, `rgba(200,245,255,${coreGlow})`);
      dot.addColorStop(1,   'rgba(0,229,255,0)');
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = dot; ctx.fill();

      particles.forEach(p => {
        p.pulse += 0.020;
        const a = p.alpha * (0.65 + 0.35 * Math.sin(p.pulse));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.green ? `rgba(105,255,71,${a})` : `rgba(0,229,255,${a})`;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.y < -5)  { p.y = h + 5; p.x = Math.random() * w; }
        if (p.x < -5)  p.x = w + 5;
        if (p.x > w+5) p.x = -5;
      });

      this.animFrame = requestAnimationFrame(draw);
    };

    draw();
  }
}