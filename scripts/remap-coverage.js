import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = path.join(root, 'coverage', 'lcov.info');

if (!fs.existsSync(report)) {
  throw new Error('No se encontró coverage/lcov.info para normalizar las rutas.');
}

const content = fs.readFileSync(report, 'utf8');
const normalized = content.replace(
  /^SF:.*[\\/]\.bunker-integration-[^\\/]+[\\/]runtime[\\/]services[\\/]/gm,
  'SF:services/'
);

fs.writeFileSync(report, normalized, 'utf8');
