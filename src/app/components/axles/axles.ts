import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalCareerView } from '../../Interface/CalCareerView';

@Component({
  selector: 'app-axles',
  standalone: true, // ← ¡Importante si estás usando Angular standalone!
  imports: [CommonModule, FormsModule],
  templateUrl: './axles.html',
  styleUrls: ['./axles.css']
})
export class Axles {
  @Input() calCareer?: CalCareerView;

  showModal: boolean = false;
  ejes: string[] = ['', '', '', ''];

  abrirModal() {
    this.showModal = true;
    this.ejes = ['', '', '', ''];
  }

  cerrarModal() {
    this.showModal = false;
  }

  guardarEjes() {
    const ejesFiltrados = this.ejes.filter(e => e.trim() !== '');
    if (ejesFiltrados.length === 0) {
      alert('Debe ingresar al menos un eje');
      return;
    }
    console.log('Ejes guardados:', ejesFiltrados);
    alert(`Se guardaron ${ejesFiltrados.length} ejes correctamente`);
    this.cerrarModal();
  }

  onSubmit() {
    this.guardarEjes();
  }
}
