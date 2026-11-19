import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoomCreatePage } from './room-create.page';

describe('RoomCreatePage', () => {
  let component: RoomCreatePage;
  let fixture: ComponentFixture<RoomCreatePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RoomCreatePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
