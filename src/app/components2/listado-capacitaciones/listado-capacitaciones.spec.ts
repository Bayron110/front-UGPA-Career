import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListadoCapacitaciones } from './listado-capacitaciones';

describe('ListadoCapacitaciones', () => {
  let component: ListadoCapacitaciones;
  let fixture: ComponentFixture<ListadoCapacitaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListadoCapacitaciones]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListadoCapacitaciones);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
