import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Axles } from './axles';

describe('Axles', () => {
  let component: Axles;
  let fixture: ComponentFixture<Axles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Axles]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Axles);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
