import path from 'path';
import { readJSON } from 'boma';

import { executeSingleCommand, parseStatus } from './index.js';

// Меняем все переводы строк на одинаковые
export const normalizeLineBreaks = (data: string) => data.replace(/\r\n/g, '\n');

export const getNameFromSavedData = (key: string) => {
  const savedPeers = readJSON({ filePath: path.resolve(process.cwd(), './.data/peers.json'), parseJSON: true });
  const hasSavedData = Object.keys(savedPeers).length > 0;

  // Подставляем в данные имена из сохранёнок
  if (hasSavedData && savedPeers.hasOwnProperty(key)) {
    return savedPeers[key].name || '[UNNAMED PEER]';
  }

  return '';
};

export const getStatusFromBash = async (): Promise<AppResult> => {
  const rawStatus = await executeSingleCommand('wg');
  if (rawStatus.includes('not found, but')) {
    return { success: false, error: 'Seems like Wireguard does not installed on server' };
  } else if (rawStatus === '') {
    return { success: false, error: 'Wireguard is disabled' };
  }
  const parsedStatus = parseStatus(rawStatus);
  return {
    success: true,
    data: { ...parsedStatus },
  };
};

export const transCyrilic = (str: string) => {
  return str.replace(
    /[ЁёА-я]/g,
    c =>
      ({
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
      })[c] || c
  );
};
