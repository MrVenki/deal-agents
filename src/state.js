import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
const abs = (p) => path.join(ROOT, p);

export function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(abs(p), 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeText(p, text) {
  fs.mkdirSync(path.dirname(abs(p)), { recursive: true });
  fs.writeFileSync(abs(p), text);
}

export const writeJson = (p, v) => writeText(p, JSON.stringify(v, null, 2) + '\n');

export const loadConfig = () => readJson('config.json', {});

export const today = () => new Date().toISOString().slice(0, 10);

export function loadState() {
  return { paused: false, posted: [], llm: {}, niches: {}, ...readJson('data/state.json', {}) };
}

export function saveState(state) {
  state.posted = state.posted.slice(-500);
  writeJson('data/state.json', state);
}
