import { Component, output, signal } from '@angular/core';

@Component({
  selector: 'app-achievement',
  standalone: true,
  template: `
    <div class="panel">
      <h3 id="modal-achievement-title">成就</h3>
      <ul>
        @for (a of list(); track a.id) {
          <li [class.done]="a.done">
            <span class="name">{{ a.name }}</span>
            <span class="badge">{{ a.done ? '已解锁' : '未达成' }}</span>
          </li>
        }
      </ul>
      <button type="button" class="close" (click)="closed.emit()">关闭</button>
    </div>
  `,
  styles: [
    `
      .panel {
        width: 100%;
        max-width: 440px;
        box-sizing: border-box;
        padding: 14px 16px;
        background: rgba(18, 14, 30, 0.95);
        border-radius: 12px;
        border: 1px solid rgba(186, 104, 200, 0.45);
        color: #eceff1;
      }
      h3 {
        margin: 0 0 10px;
        color: #e1bee7;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        font-size: 14px;
      }
      li.done .name {
        color: #fff59d;
      }
      .badge {
        font-size: 12px;
        color: #b0bec5;
      }
      li.done .badge {
        color: #a5d6a7;
      }
      .close {
        width: 100%;
        margin-top: 12px;
        border: none;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        background: #4a148c;
        color: #f3e5f5;
      }
    `,
  ],
})
export class AchievementComponent {
  readonly closed = output<void>();
  readonly list = signal([
    { id: 'first', name: '第一笔生意', done: true },
    { id: 'combo5', name: '连击达到 5', done: false },
    { id: 'rich', name: '累计金钱 500', done: false },
  ]);
}
