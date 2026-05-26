import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export class IpmLogger {
  readonly sessionDir: string;
  private counter = 0;

  constructor(logDir: string) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 19).replace(/:/g, '');
    this.sessionDir = join(logDir, date, time);
    mkdirSync(this.sessionDir, { recursive: true });
  }

  save(name: string, content: string | Buffer): string {
    const n = String(++this.counter).padStart(3, '0');
    const filePath = join(this.sessionDir, `${n}_${name}`);
    writeFileSync(filePath, content);
    return filePath;
  }
}
