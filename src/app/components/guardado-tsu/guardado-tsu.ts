import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalCareerView } from '../../Interface/CalCareerView';
import { CalCareerService } from '../../services/CalCareer/cal-career';
import { AxlesTsu } from '../../Interface/Alex2';
import { AxlesTsuService } from '../../services/TypeCaeerTsu/type-tsu';
import { forkJoin } from 'rxjs';

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
  ejesExistentes: AxlesTsu[] = [];
  modoEdicion: boolean = false;

  showModal: boolean = false;

  niveles: {
    id?: number;
    nombre: string;
    ejes: { nombre: string; temas: string[] }[];
  }[] = [];

  // Mapa para saber qué carreras tienen ejes
  carrerasConEjes: Map<string, boolean> = new Map();

  currentStep: number = 0;

  constructor(
    private calCareerService: CalCareerService,
    private axlesTsuService: AxlesTsuService,
    private router: Router,
    private cdr: ChangeDetectorRef
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
        
        // Verificar cuáles tienen ejes asignados
        this.verificarEjesAsignados();
      },
      error: (err) => {
        console.error('Error al obtener registros:', err);
      }
    });
  }

  verificarEjesAsignados(): void {
    if (this.calCareers.length === 0) {
      return;
    }

    const observables = this.calCareers.map(carrera => 
      this.axlesTsuService.getByCalCareerId(carrera.id!)
    );

    forkJoin(observables).subscribe({
      next: (results) => {
        results.forEach((ejes, index) => {
          const carreraId = this.calCareers[index].id!;
          this.carrerasConEjes.set(carreraId, ejes && ejes.length > 0);
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al verificar ejes:', err);
      }
    });
  }

  tieneEjes(carrera: CalCareerView): boolean {
    return this.carrerasConEjes.get(carrera.id!) || false;
  }

  trackById(index: number, item: CalCareerView): string {
    return item.id!;
  }

  seleccionar(item: CalCareerView): void {
    this.carreraSeleccionada = item;
    this.modoEdicion = false;
    this.resetNiveles();
    this.abrirModal();
  }

  editarEjes(item: CalCareerView): void {
    this.carreraSeleccionada = item;
    this.modoEdicion = true;
    
    // Cargar los ejes existentes
    this.axlesTsuService.getByCalCareerId(item.id!).subscribe({
      next: (ejes) => {
        this.ejesExistentes = ejes;
        this.cargarEjesEnFormulario(ejes);
        this.abrirModal();
      },
      error: (err) => {
        console.error('Error al cargar ejes:', err);
        alert('❌ Error al cargar los ejes existentes');
      }
    });
  }

  cargarEjesEnFormulario(ejes: AxlesTsu[]): void {
    this.resetNiveles();
    
    ejes.forEach((eje, index) => {
      if (index < 4) {
        this.niveles[index] = {
          id: eje.id,
          nombre: eje.nivel || '',
          ejes: [
            { nombre: eje.eje1 || '', temas: ['', '', '', '', '', ''] },
            { nombre: eje.eje2 || '', temas: ['', '', '', '', '', ''] },
            { nombre: eje.eje3 || '', temas: ['', '', '', '', '', ''] },
            { nombre: eje.eje4 || '', temas: ['', '', '', '', '', ''] },
            { nombre: eje.eje5 || '', temas: ['', '', '', '', '', ''] },
            { nombre: eje.eje6 || '', temas: ['', '', '', '', '', ''] }
          ]
        };
      }
    });
    this.cdr.detectChanges();
  }

  eliminarEjes(item: CalCareerView): void {
    const confirmar = confirm(`¿Está seguro de eliminar todos los ejes de "${item.career.nombre}"?\n\nEsta acción no se puede deshacer.`);
    
    if (!confirmar) {
      return;
    }

    this.axlesTsuService.getByCalCareerId(item.id!).subscribe({
      next: (ejes) => {
        if (ejes.length === 0) {
          alert('ℹ️ No hay ejes para eliminar');
          return;
        }

        const deleteObservables = ejes.map(eje => 
          this.axlesTsuService.delete(String(eje.id!))
        );

        forkJoin(deleteObservables).subscribe({
          next: () => {
            alert('✅ Ejes eliminados exitosamente');
            this.carrerasConEjes.set(item.id!, false);
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al eliminar ejes:', err);
            alert('❌ Error al eliminar los ejes. Por favor intente nuevamente.');
          }
        });
      },
      error: (err) => {
        console.error('Error al obtener ejes:', err);
        alert('❌ Error al obtener los ejes');
      }
    });
  }

  abrirModal(): void {
    this.showModal = true;
    this.currentStep = 0;
  }

  cerrarModal(): void {
    this.showModal = false;
    this.carreraSeleccionada = undefined;
    this.currentStep = 0;
    this.modoEdicion = false;
    this.ejesExistentes = [];
    this.resetNiveles();
  }

  resetNiveles(): void {
    // Cada nivel tendrá 6 ejes con nombre por defecto
    this.niveles = Array(4).fill(null).map((_, index) => ({
      nombre: `Nivel ${index + 1}`,
      ejes: Array(6).fill(null).map(() => ({ nombre: '', temas: ['', '', '', '', '', ''] }))
    }));
  }

  nextStep(): void {
    if (this.currentStep < this.niveles.length - 1) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    this.currentStep = step;
  }

  guardarEjes(): void {
    if (!this.carreraSeleccionada) {
      alert('❌ No hay carrera seleccionada');
      return;
    }

    // Validar que al menos un nivel tenga un eje
    const hayEjes = this.niveles.some(nivel => 
      nivel.ejes.some(eje => eje.nombre.trim() !== '')
    );

    if (!hayEjes) {
      alert('⚠️ Debe completar al menos un eje en algún nivel');
      return;
    }

    if (this.modoEdicion) {
      this.actualizarEjes();
    } else {
      this.crearNuevosEjes();
    }
  }

  crearNuevosEjes(): void {
    const ejesParaGuardar = this.niveles
      .filter(nivel => nivel.ejes.some(eje => eje.nombre.trim() !== ''))
      .map((nivel, index) => {
        const axle: AxlesTsu = {
          calCareer: { id: this.carreraSeleccionada!.id! },
          nivel: nivel.nombre.trim() !== '' ? nivel.nombre : `Nivel ${index + 1}`,
          eje1: nivel.ejes[0]?.nombre || '',
          eje2: nivel.ejes[1]?.nombre || '',
          eje3: nivel.ejes[2]?.nombre || '',
          eje4: nivel.ejes[3]?.nombre || '',
          eje5: nivel.ejes[4]?.nombre || '',
          eje6: nivel.ejes[5]?.nombre || ''
        };
        return this.axlesTsuService.save(axle);
      });

    if (ejesParaGuardar.length === 0) {
      alert('⚠️ No hay ejes para guardar');
      return;
    }

    forkJoin(ejesParaGuardar).subscribe({
      next: () => {
        alert(`✅ Estructura guardada exitosamente para la carrera:\n"${this.carreraSeleccionada!.career.nombre}"`);
        this.carrerasConEjes.set(this.carreraSeleccionada!.id!, true);
        this.cerrarModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al guardar:', err);
        alert('❌ Error al guardar la estructura. Por favor intente nuevamente.');
      }
    });
  }

  actualizarEjes(): void {
    if (this.ejesExistentes.length === 0) {
      this.crearNuevosEjes();
      return;
    }

    // Primero eliminar todos los ejes existentes
    const deleteObservables = this.ejesExistentes.map(eje => 
      this.axlesTsuService.delete(String(eje.id!))
    );

    forkJoin(deleteObservables).subscribe({
      next: () => {
        // Luego crear los nuevos
        this.crearNuevosEjes();
      },
      error: (err) => {
        console.error('❌ Error al actualizar:', err);
        alert('❌ Error al actualizar los ejes. Por favor intente nuevamente.');
      }
    });
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