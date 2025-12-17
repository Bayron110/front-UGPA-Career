import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReporteAnual } from './reporte-anual';

describe('ReporteAnual', () => {
  let component: ReporteAnual;
  let fixture: ComponentFixture<ReporteAnual>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReporteAnual]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReporteAnual);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
