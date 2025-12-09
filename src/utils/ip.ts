import path from 'path';
import { readJSON } from 'boma';
import { isExistAndNotNull } from 'vanicom';
import { PeerStorage } from '../types/config.js';
import { PEERS_PATH } from './constants.js';
import { getIfaceParams } from './memoryConfig.js';

export const isValidSubnetMask = (mask: string): boolean => {
  const regex = /^((255|254|252|248|240|224|192|128|0)\.){3}(255|254|252|248|240|224|192|128|0)$/;
  if (!regex.test(mask)) {
    return false;
  }
  const parts = mask.split('.').map(Number);
  let foundZero = false;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 0) {
      foundZero = true;
    } else if (foundZero && parts[i] !== 0) {
      return false;
    }
  }
  return true;
};

export const getInterfacePeersIPs = (iface: string): string[] => {
  const ifaceParams = getIfaceParams(iface);
  if (!ifaceParams.success || !ifaceParams.data) {
    throw new Error(`Failed to get interface params: ${ifaceParams.errors}`);
  }
  const { peers: peersKeys, ip: serverIP } = ifaceParams.data;
  const parsedPeers = readJSON({
    filePath: path.resolve(PEERS_PATH),
    parseJSON: true,
    createIfNotFound: {},
  }) as PeerStorage;
  const busyIPs = new Set<string>();
  for (const peerKey of peersKeys) {
    const peer = parsedPeers[peerKey];
    if (!isExistAndNotNull(peer)) continue;
    const ipsList = peer.ip.split(',').map(ip => ip.trim().split('/')[0]);
    for (const rawIP of ipsList) {
      const cleanedIP = rawIP.trim();
      if (cleanedIP === '0.0.0.0') continue;
      if (busyIPs.has(cleanedIP)) {
        console.error(`Interface ${iface} has a possible conflict of IP: ${cleanedIP}`);
      }
      busyIPs.add(cleanedIP);
    }
  }
  busyIPs.add(serverIP);
  return Array.from(busyIPs);
};

export const getFirstAvailableIP = (occupiedIPs: string[], cidr: number): string | null => {
  const occupiedNumbers = occupiedIPs
    .map(ip => {
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4 || parts.some(part => Number.isNaN(part))) {
        return null;
      }
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    })
    .filter((ipNumber): ipNumber is number => ipNumber !== null)
    .sort((a, b) => a - b);

  if (!occupiedNumbers.length) {
    return null;
  }

  const networkIP = occupiedNumbers[0] & (~0 << (32 - cidr));
  const broadcastIP = networkIP | (~0 >>> cidr);
  const occupiedSet = new Set(occupiedNumbers);
  for (let ipNum = networkIP + 1; ipNum < broadcastIP; ipNum++) {
    if (!occupiedSet.has(ipNum)) {
      return [(ipNum >>> 24) & 0xff, (ipNum >>> 16) & 0xff, (ipNum >>> 8) & 0xff, ipNum & 0xff].join('.');
    }
  }
  return null;
};
