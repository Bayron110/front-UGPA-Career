import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginService } from '../../firebase/login';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  correo = '';
  contrasena = '';
  mostrarContrasena = false;

  cargando = false;
  error = '';
  mensajeExito = '';
  mensajePendiente = '';   // 👈 esta línea es la que falta

  constructor(
    private loginService: LoginService,
    private router: Router
  ) {}

  // ... resto del código igual

async ingresar(): Promise<void> {
  this.error = '';
  this.mensajeExito = '';
  this.mensajePendiente = ''; // 👈 nuevo

  const correoLimpio = this.correo.trim();

  if (!correoLimpio || !this.contrasena) { this.error = 'Ingresa tu correo y contraseña.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) { this.error = 'Ingresa un correo válido.'; return; }
  if (this.contrasena.length < 6) { this.error = 'La contraseña debe tener al menos 6 caracteres.'; return; }

  this.cargando = true;
  try {
    const resultado = await this.loginService.iniciarSesionORegistrar(correoLimpio, this.contrasena);

    if (resultado.pendiente) {
      this.mensajePendiente = resultado.mensaje; // 👈 mensaje especial, no es error
      return;
    }
    if (!resultado.exito) {
      this.error = resultado.mensaje;
      return;
    }

    sessionStorage.setItem('usuarioActual', JSON.stringify({
      correo: resultado.usuario?.correo,
      rol: resultado.usuario?.rol,
      permisos: resultado.usuario?.permisos
    }));

    this.mensajeExito = resultado.mensaje;
    setTimeout(() => this.router.navigate(['/Home']), 600);

  } catch (e) {
    console.error('Error en login:', e);
    this.error = 'Ocurrió un error al conectar con la base de datos.';
  } finally {
    this.cargando = false;
  }
}
}