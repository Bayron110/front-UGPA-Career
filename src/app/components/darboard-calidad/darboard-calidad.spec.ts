import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DarboardCalidad } from './darboard-calidad';

describe('DarboardCalidad', () => {
  let component: DarboardCalidad;
  let fixture: ComponentFixture<DarboardCalidad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DarboardCalidad]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DarboardCalidad);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
