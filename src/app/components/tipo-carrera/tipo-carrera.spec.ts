import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TipoCarrera } from './tipo-carrera';

describe('TipoCarrera', () => {
  let component: TipoCarrera;
  let fixture: ComponentFixture<TipoCarrera>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TipoCarrera]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TipoCarrera);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
