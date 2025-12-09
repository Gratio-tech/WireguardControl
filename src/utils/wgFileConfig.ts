import { appendFileSync, readdir, readFileSync, writeFileSync } from 'fs';
import { WIREGUARD_DIR, resolveWireguardPath } from './constants.js';

export const appendDataToConfig = async (filePath: string, data: string): Promise<void> => {
  const stringToAppend = `\n${data}\n`;
  try {
    appendFileSync(filePath, stringToAppend, 'utf-8');
  } catch (error) {
    console.error(`Error on appendDataToConfig to file: "${filePath}":`, error);
    throw error;
  }
};

export const formatObjectToConfigSection = (sectionName: string, configObject: Record<string, string | number>): string => {
  if (!sectionName || !Object.keys(configObject).length) {
    console.log('Incorrect data for formatObjectToConfigSection: ', sectionName, configObject);
  }
  let output = `[${sectionName}]\n`;
  Object.entries(configObject).forEach(([key, value]) => {
    output += `${key} = ${value}\n`;
  });
  output += '\n';
  return output;
};

export const formatConfigToString = (configObject: Record<string, any>): string => {
  let output = '';
  for (const section in configObject) {
    if (section.toLowerCase() === 'peers') {
      configObject[section].forEach((peer: Record<string, string>) => {
        if (!('PublicKey' in peer) || !('PresharedKey' in peer) || !('AllowedIPs' in peer)) {
          console.log('Incorrect peer in configObject: ', peer);
          return;
        }
        output += formatObjectToConfigSection('Peer', peer);
      });
      continue;
    }
    output += formatObjectToConfigSection(section, configObject[section]);
  }
  return output;
};

export const getAllConfigs = async (): Promise<{ success: boolean; data?: string[]; errors?: string }> => {
  const allConfFiles = await new Promise<string[]>((resolve, reject) => {
    readdir(WIREGUARD_DIR, (err, files) => {
      if (err) {
        reject(err);
      } else {
        const confFiles: string[] = [];
        files.forEach(file => {
          if (file.endsWith('.conf')) {
            confFiles.push(file.replace(/\.[^.]*$/, ''));
          }
        });
        resolve(confFiles);
      }
    });
  });
  if (!Array.isArray(allConfFiles)) {
    console.error('getAllConfigs error when getting the configs files: ', allConfFiles);
    return { success: false, errors: 'Error when get configs' };
  }
  if (!allConfFiles.length) {
    return { success: false, errors: `Seems like WireGuard is not configured yet (no .conf files in ${WIREGUARD_DIR})` };
  }
  return { success: true, data: allConfFiles };
};

export const removePeerFromConfig = (iface: string, pubKey: string): boolean => {
  const configPath = resolveWireguardPath(iface);
  let configData = readFileSync(configPath, 'utf8');
  const sections = configData.split(/(?=\[)/g);
  let peerFound = false;
  const newSections = sections.filter(section => {
    if (section.startsWith('[Peer]')) {
      const peerPublicKeyMatch = section.match(/PublicKey\s*=\s*([^\s]+)/);
      if (peerPublicKeyMatch && peerPublicKeyMatch[1] === pubKey) {
        peerFound = true;
        return false;
      }
    }
    return true;
  });
  if (peerFound) {
    writeFileSync(configPath, newSections.join(''), 'utf8');
  }
  return peerFound;
};
