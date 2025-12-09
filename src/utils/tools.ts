import path from 'path';
import { readJSON } from 'boma';
import { executeSingleCommand } from './exec.js';
import { parseStatus } from './parsers.js';
import { PeerStorage } from '../types/config.js';
import { PEERS_PATH } from './constants.js';

export const normalizeLineBreaks = (data: string): string => data.replace(/\r\n/g, '\n');

export const getNameFromSavedData = (key: string): string => {
  const savedPeers = readJSON({ filePath: path.resolve(PEERS_PATH), parseJSON: true, createIfNotFound: {} }) as PeerStorage;
  const hasSavedData = Object.keys(savedPeers).length > 0;
  if (hasSavedData && Object.prototype.hasOwnProperty.call(savedPeers, key)) {
    return savedPeers[key].name || '[UNNAMED PEER]';
  }
  return '';
};

export interface ParsedStatusResult {
  success: boolean;
  data?: ReturnType<typeof parseStatus>;
  error?: string;
}

export const getStatusFromBash = async (): Promise<ParsedStatusResult> => {
  const rawStatus = await executeSingleCommand('wg');
  if (rawStatus.includes('not found, but')) {
    return { success: false, error: 'Seems like WireGuard is not installed on server' };
  }
  if (rawStatus === '') {
    return { success: false, error: 'WireGuard is disabled' };
  }
  const parsedStatus = parseStatus(rawStatus);
  return {
    success: true,
    data: { ...parsedStatus },
  };
};

export const transCyrilic = (str: string): string => {
  return str.replace(/[ЁёА-я ]/g, c => translitMap[c as keyof typeof translitMap] ?? c);
};

const translitMap = {
  'Ё': 'Yo',
  'ё': 'yo',
  'А': 'A',
  'а': 'a',
  'Б': 'B',
  'б': 'b',
  'В': 'V',
  'в': 'v',
  'Г': 'G',
  'г': 'g',
  'Д': 'D',
  'д': 'd',
  'Е': 'E',
  'е': 'e',
  'Ж': 'Zh',
  'ж': 'zh',
  'З': 'Z',
  'з': 'z',
  'И': 'I',
  'и': 'i',
  'Й': 'Y',
  'й': 'y',
  'К': 'K',
  'к': 'k',
  'Л': 'L',
  'л': 'l',
  'М': 'M',
  'м': 'm',
  'Н': 'N',
  'н': 'n',
  'О': 'O',
  'о': 'o',
  'П': 'P',
  'п': 'p',
  'Р': 'R',
  'р': 'r',
  'С': 'S',
  'с': 's',
  'Т': 'T',
  'т': 't',
  'У': 'U',
  'у': 'u',
  'Ф': 'F',
  'ф': 'f',
  'Х': 'Kh',
  'х': 'kh',
  'Ц': 'Ts',
  'ц': 'ts',
  'Ч': 'Ch',
  'ч': 'ch',
  'Ш': 'Sh',
  'ш': 'sh',
  'Щ': 'Shch',
  'щ': 'shch',
  'Ъ': '',
  'ъ': '',
  'Ы': 'Y',
  'ы': 'y',
  'Ь': '',
  'ь': '',
  'Э': 'E',
  'э': 'e',
  'Ю': 'Yu',
  'ю': 'yu',
  'Я': 'Ya',
  'я': 'ya',
  ' ': '_',
} as const;
