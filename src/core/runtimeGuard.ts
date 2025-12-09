import fs from 'fs';
import path from 'path';
import { generateRuntimeCode } from '../utils/crypto.js';
import { PUBLIC_ASSETS_DIR, RUNTIME_FILE_PATH } from '../utils/constants.js';

interface RuntimeGuardState {
  code: string;
  expiresAt: number;
  rotationIntervalMs: number;
  timer?: NodeJS.Timeout;
}

const state: RuntimeGuardState = {
  code: '',
  expiresAt: 0,
  rotationIntervalMs: 5 * 60 * 1000,
};

const ensureRuntimeDir = (): void => {
  if (!fs.existsSync(PUBLIC_ASSETS_DIR)) {
    fs.mkdirSync(PUBLIC_ASSETS_DIR, { recursive: true });
  }
};

const buildRuntimeScript = (): string => {
  return `window.__WG_RUNTIME__ = Object.freeze({\n  verificationCode: '${state.code}',\n  generatedAt: ${Date.now()},\n  expiresAt: ${state.expiresAt},\n  rotationIntervalMs: ${state.rotationIntervalMs}\n});\n`;
};

const writeRuntimeScript = (): void => {
  ensureRuntimeDir();
  fs.writeFileSync(RUNTIME_FILE_PATH, buildRuntimeScript(), 'utf-8');
};

const rotateCode = (): void => {
  state.code = generateRuntimeCode();
  state.expiresAt = Date.now() + state.rotationIntervalMs;
  writeRuntimeScript();
};

export const initRuntimeGuard = (rotationMinutes: number): void => {
  const rotationMs = Math.max(1, rotationMinutes) * 60 * 1000;
  state.rotationIntervalMs = rotationMs;
  if (state.timer) {
    clearInterval(state.timer);
  }
  rotateCode();
  state.timer = setInterval(rotateCode, rotationMs);
};

export const getRuntimeCode = (): string => state.code;

export const isValidRuntimeCode = (code?: string | string[]): boolean => {
  const incoming = Array.isArray(code) ? code[0] : code;
  return Boolean(incoming) && incoming === state.code;
};

export const forceRotateRuntimeCode = (): void => {
  rotateCode();
};

export const getRuntimeScriptPath = (): string => path.relative(process.cwd(), RUNTIME_FILE_PATH);

export const getRuntimeMetadata = (): { expiresAt: number; rotationIntervalMs: number } => ({
  expiresAt: state.expiresAt,
  rotationIntervalMs: state.rotationIntervalMs,
});
