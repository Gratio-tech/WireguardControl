import fs from 'fs';
import { getNameFromSavedData, normalizeLineBreaks } from './tools.js';
import { resolveWireguardPath } from './constants.js';

interface ParsedStatus {
  interface: Record<string, string>;
  peers: Array<Record<string, string>>;
}

export const parseStatus = (rawStatus: string): ParsedStatus => {
  const parsedStatus: ParsedStatus = { interface: {}, peers: [] };
  const sections = rawStatus.split(/(?:\s*(interface|peer)\s*:)/gi).filter(line => line);
  for (let i = 0; i < sections.length; i += 2) {
    if (typeof sections[i + 1] === 'undefined') continue;
    const sectionName = sections[i].trim().toLowerCase();
    const sectionContent = normalizeLineBreaks(sections[i + 1].trim()).split(/\n/);
    const parsedSection: Record<string, string> = { name: '' };
    sectionContent.forEach((item, index) => {
      if (index === 0) {
        parsedSection.name = item;
      } else {
        parsedSection[item.split(':')[0].trim()] = item.slice(item.indexOf(':') + 1).trim();
      }
    });
    if (sectionName === 'peer') {
      parsedSection['public key'] = parsedSection.name;
      parsedSection.name = getNameFromSavedData(parsedSection.name);
      parsedStatus.peers.push(parsedSection);
    } else {
      parsedStatus[sectionName as 'interface'] = parsedSection;
    }
  }
  return parsedStatus;
};

interface SplitSections {
  interface?: string;
  peers: string[];
  [key: string]: string | string[] | undefined;
}

export const splitBySections = (content: string): SplitSections => {
  const result: SplitSections = { peers: [] };
  if (typeof content !== 'string' || !content.length) {
    return result;
  }
  const sections = content.split(/\[(.+?)\]/g);
  for (let i = 1; i < sections.length; i += 2) {
    const sectionName = sections[i].trim().toLowerCase();
    const sectionContent = normalizeLineBreaks(sections[i + 1].trim());
    if (sectionName === 'peer') {
      result.peers.push(sectionContent);
    } else {
      result[sectionName] = sectionContent;
    }
  }
  return result;
};

const parseLine = (line: string): Record<string, string> | undefined => {
  const trimmedLine = line.trim();
  if (!trimmedLine.startsWith('#') && !trimmedLine.startsWith(';')) {
    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      return { [key]: value };
    }
  }
  return undefined;
};

export const parseInterfaceConfig = (iface: string) => {
  if (!iface || typeof iface !== 'string') {
    throw new Error('Interface must be a string!');
  }
  const interfacePath = resolveWireguardPath(iface);
  if (!fs.existsSync(interfacePath)) {
    throw new Error('Incorrect interface!');
  }
  console.log(`Try to parse interface ${interfacePath}`);
  try {
    const data = fs.readFileSync(interfacePath, 'utf8');
    const splittedData = splitBySections(data);
    const configObject: { interface: Record<string, string>; peers: Array<Record<string, string>> } = {
      interface: {},
      peers: [],
    };
    for (const section in splittedData) {
      const sectionName = section.toLowerCase();
      if (sectionName === 'peers') {
        const peerBlocks = splittedData[section];
        if (Array.isArray(peerBlocks)) {
          configObject.peers = peerBlocks.map((peerData: string) => {
            const peer: Record<string, string> = {};
            peerData.split('\n').forEach(line => {
              const parsed = parseLine(line);
              if (parsed) Object.assign(peer, parsed);
            });
            if (peer.PublicKey) {
              peer.name = getNameFromSavedData(peer.PublicKey);
            }
            return peer;
          });
        }
      } else if (sectionName === 'interface') {
        const interfaceData = splittedData[section];
        if (typeof interfaceData === 'string') {
          interfaceData.split('\n').forEach(line => {
            const parsed = parseLine(line);
            if (parsed) {
              configObject.interface = {
                ...configObject.interface,
                ...parsed,
              };
            }
          });
        }
      }
    }
    return configObject;
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to parse config file: ${err.message}`);
  }
};
