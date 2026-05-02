import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="panel">
      <h3 id="modal-settings-title">设置</h3>
      <label class="row">
        <span>静音（占位）</span>
        <input type="checkbox" [(ngModel)]="muteModel" />
      </label>
      <p class="note">音效与音乐可在后续版本接入。</p>
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
        background: rgba(15, 23, 28, 0.96);
        border-radius: 12px;
        border: 1px solid rgba(100, 181, 246, 0.4);
        color: #eceff1;
      }
      h3 {
        margin: 0 0 12px;
        color: #90caf9;
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        font-size: 14px;
      }
      .note {
        font-size: 12px;
        color: #90a4ae;
        margin: 0 0 12px;
      }
      .close {
        width: 100%;
        border: none;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        background: #1565c0;
        color: #e3f2fd;
      }
    `,
  ],
})
export class SettingsComponent {
  readonly closed = output<void>();
  readonly mute = signal(false);

  get muteModel(): boolean {
    return this.mute();
  }
  set muteModel(v: boolean) {
    this.mute.set(v);
  }
}
