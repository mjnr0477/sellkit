import { mkdir, copyFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const sourceFiles = ['index.html', 'social-features.js'];
const output = resolve(root, 'www');

await mkdir(output, { recursive: true });
for (const file of sourceFiles) {
  const from = resolve(root, file);
  const to = resolve(output, file);
  await access(from);
  await copyFile(from, to);
}
console.log('Prepared VYBORA web assets for Capacitor:', sourceFiles.join(', '));
