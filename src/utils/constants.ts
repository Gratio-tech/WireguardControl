import fs from 'fs';
import os from 'os';
import path from 'path';

const safeCwd = (() => {
  try {
    return fs.realpathSync(process.cwd());
  } catch (_) {
    return process.cwd();
  }
})();

export const PROJECT_ROOT = safeCwd;

export const resolveProjectPath = (...segments: string[]): string => path.resolve(PROJECT_ROOT, ...segments);

export const DATA_DIR = resolveProjectPath('.data');
export const PEERS_PATH = path.resolve(DATA_DIR, 'peers.json');
export const INTERFACES_PATH = path.resolve(DATA_DIR, 'interfaces.json');
export const CONFIG_PATH = resolveProjectPath('config.json');
export const CONFIG_EXAMPLE_PATH = resolveProjectPath('config.example.json');
export const PUBLIC_DIR = resolveProjectPath('public');
export const PUBLIC_ASSETS_DIR = path.resolve(PUBLIC_DIR, 'assets');
export const RUNTIME_FILE_PATH = path.resolve(PUBLIC_ASSETS_DIR, 'runtime.js');
export const DEFAULT_RUNTIME_ROTATION_MINUTES = 5;

const normalizeCandidate = (candidate?: string): string | undefined => {
  if (!candidate) return undefined;
  return path.isAbsolute(candidate) ? candidate : resolveProjectPath(candidate);
};

const detectWireguardDir = (): string => {
  const envCandidate = normalizeCandidate(process.env.WG_CONFIG_DIR);
  const localCandidate = resolveProjectPath('etc', 'wireguard');
  const platform = os.platform();
  const platformCandidate = platform === 'win32' ? path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'WireGuard') : '/etc/wireguard';

  const candidates = [envCandidate, localCandidate, platformCandidate].filter((dir): dir is string => Boolean(dir));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // ignore filesystem access errors
    }
  }
  return candidates[0] || localCandidate;
};

export const WIREGUARD_DIR = detectWireguardDir();

export const resolveWireguardPath = (iface: string): string => {
  const sanitized = iface.trim().replace(/\.conf$/i, '');
  const fileName = `${sanitized}.conf`;
  return path.resolve(WIREGUARD_DIR, fileName);
};
