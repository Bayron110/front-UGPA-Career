import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {

  constructor(private router: Router) { }

  irACarrera(): void {
    this.router.navigate(['/Carrera']);
  }
  irATipo(): void {
    this.router.navigate(['/Tipo'])
  }

  irACalCareer(): void{
    this.router.navigate(['/Cal'])
  }

  irAHistory(): void{
    this.router.navigate(['/history'])
  }
}
