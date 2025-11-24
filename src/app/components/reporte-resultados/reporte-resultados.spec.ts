import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReporteResultados } from './reporte-resultados';

describe('ReporteResultados', () => {
  let component: ReporteResultados;
  let fixture: ComponentFixture<ReporteResultados>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReporteResultados]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReporteResultados);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
