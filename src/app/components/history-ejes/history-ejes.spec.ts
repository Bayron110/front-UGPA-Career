import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoryEjes } from './history-ejes';

describe('HistoryEjes', () => {
  let component: HistoryEjes;
  let fixture: ComponentFixture<HistoryEjes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryEjes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoryEjes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
