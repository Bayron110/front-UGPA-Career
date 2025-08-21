import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CarreraI } from './carrera-i';

describe('CarreraI', () => {
  let component: CarreraI;
  let fixture: ComponentFixture<CarreraI>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarreraI]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CarreraI);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
