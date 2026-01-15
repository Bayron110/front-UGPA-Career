import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DescargaG } from './descarga-g';

describe('DescargaG', () => {
  let component: DescargaG;
  let fixture: ComponentFixture<DescargaG>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DescargaG]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DescargaG);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
