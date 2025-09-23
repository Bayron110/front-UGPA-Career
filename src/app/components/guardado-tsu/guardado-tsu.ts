import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalCareerView } from '../../Interface/CalCareerView';
import { CalCareerService } from '../../services/CalCareer/cal-career';
import { AxlesTsu } from '../../Interface/Alex2';
import { AxlesTsuService } from '../../services/TypeCaeerTsu/type-tsu';

@Component({
  selector: 'app-guardado-tsu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guardado-tsu.html',
  styleUrls: ['./guardado-tsu.css']
})
export class GuardadoTsu implements OnInit {

  calCareers: CalCareerView[] = [];
  carreraSeleccionada?: CalCareerView;

  showModal: boolean = false;

  niveles: {
    nombre: string;
    ejes: { nombre: string; temas: string[] }[];
  }[] = [];

  currentStep: number = 0;

  constructor(
    private calCareerService: CalCareerService,
    private axlesTsuService: AxlesTsuService,
    private router: Router,
    private crd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.obtenerGuardados();
    this.resetNiveles();
  }

 obtenerGuardados(): void {
  this.calCareerService.getAll().subscribe({
    next: (data) => {
      this.calCareers = data
        .filter((item: any) => item.typeCareer.tipo.toLowerCase() === 'tsu')
        .map((item: any) => ({
          id: item.id,
          career: item.career,
          typeCareer: item.typeCareer,
          fechaActual: new Date(item.fechaActual[0], item.fechaActual[1] - 1, item.fechaActual[2]),
          fechaFin: new Date(item.fechaFin[0], item.fechaFin[1] - 1, item.fechaFin[2])
        }));
      this.crd.detectChanges();
    },
    error: (err) => {
      console.error('Error al obtener registros:', err);
    }
  });
}

  trackById(index: number, item: CalCareerView) {
    return item.id;
  }

  seleccionar(item: CalCareerView): void {
    this.carreraSeleccionada = item;
    this.abrirModal();
  }

  abrirModal(): void {
    this.showModal = true;
    this.currentStep = 0;
    this.resetNiveles();
  }

  cerrarModal(): void {
    this.showModal = false;
    this.carreraSeleccionada = undefined;
    this.currentStep = 0;
  }

  resetNiveles(): void {
    // Cada nivel tendrá 6 ejes
    this.niveles = Array(4).fill(null).map(() => ({
      nombre: '',
      ejes: Array(6).fill(null).map(() => ({ nombre: '', temas: ['', '', '', '', '', ''] }))
    }));
  }

  nextStep(): void {
    if (this.currentStep < this.niveles.length - 1) this.currentStep++;
  }

  prevStep(): void {
    if (this.currentStep > 0) this.currentStep--;
  }

  goToStep(step: number): void {
    this.currentStep = step;
  }

  guardarEjes(): void {
    if (!this.carreraSeleccionada) {
      alert('No hay carrera seleccionada');
      return;
    }

    this.niveles.forEach((nivel, nivelIndex) => {
      const tieneEjes = nivel.ejes.some(eje => eje.nombre.trim() !== '');
      if (tieneEjes) {
        const axle: AxlesTsu = {
          calCareer: { id: this.carreraSeleccionada!.id },
          nivel: nivel.nombre || `Nivel ${nivelIndex + 1}`,
          eje1: nivel.ejes[0]?.nombre || '',
          eje2: nivel.ejes[1]?.nombre || '',
          eje3: nivel.ejes[2]?.nombre || '',
          eje4: nivel.ejes[3]?.nombre || '',
          eje5: nivel.ejes[4]?.nombre || '',
          eje6: nivel.ejes[5]?.nombre || ''
        };

        this.axlesTsuService.save(axle).subscribe({
          next: (resp) => console.log('Guardado en BD:', resp),
          error: (err) => console.error('❌ Error al guardar:', err)
        });
      }
    });

    alert(`✅ Estructura guardada exitosamente para la carrera: "${this.carreraSeleccionada.career.nombre}"`);
    this.cerrarModal();
  }

  onSubmit(): void {
    this.guardarEjes();
  }

  irAAsignarEjes(tipoCarrera: string): void {
    const tipo = tipoCarrera.toLowerCase();
    if (tipo === 'tsu') {
      this.router.navigate(['/tsu']);
    } else if (tipo === 'superior') {
      this.router.navigate(['/superior']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
