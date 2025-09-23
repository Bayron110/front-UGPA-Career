import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuardadoTsu } from './guardado-tsu';

describe('GuardadoTsu', () => {
  let component: GuardadoTsu;
  let fixture: ComponentFixture<GuardadoTsu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuardadoTsu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuardadoTsu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
