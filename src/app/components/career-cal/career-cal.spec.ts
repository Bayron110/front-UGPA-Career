import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CareerCal } from './career-cal';

describe('CareerCal', () => {
  let component: CareerCal;
  let fixture: ComponentFixture<CareerCal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CareerCal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CareerCal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
