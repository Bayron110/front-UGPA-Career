import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivarFormularios } from './activar-formularios';

describe('ActivarFormularios', () => {
  let component: ActivarFormularios;
  let fixture: ComponentFixture<ActivarFormularios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivarFormularios]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActivarFormularios);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
