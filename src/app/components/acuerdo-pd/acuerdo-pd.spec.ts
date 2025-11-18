import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcuerdoPD } from './acuerdo-pd';

describe('AcuerdoPD', () => {
  let component: AcuerdoPD;
  let fixture: ComponentFixture<AcuerdoPD>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcuerdoPD]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcuerdoPD);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
