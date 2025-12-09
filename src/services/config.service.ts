import type { NextFunction, Request, Response } from 'express';
import Crypt from '@gratio/crypt';
import { readJSON, saveJSON } from 'boma';
import { FrontendConfigFile } from '../types/config.js';
import { CONFIG_PATH } from '../utils/constants.js';
import { initRuntimeGuard } from '../core/runtimeGuard.js';
import {
  getActiveInterfaceses,
  getCurrentEndpoint,
  getDefaultInterface,
  getFrontendConfig,
  getIfaceParams,
  getInterfacePeersIPs,
  getFirstAvailableIP,
  loadServerConfig,
  parseInterfaceConfig,
} from '../utils/index.js';

type EncryptMsgFn = (params: { message: unknown; pass: string }) => unknown;
const encryptMsg: EncryptMsgFn = (Crypt as any).serverCrypt.encryptMsg;

export const getInterfaceConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const iface = req.query.iface as string;
  try {
    const currentConfig = await parseInterfaceConfig(iface);
    currentConfig.interface['External IP'] = getCurrentEndpoint();
    const { frontendPasskey } = getFrontendConfig();
    const cipher = encryptMsg({ message: currentConfig, pass: frontendPasskey });
    res.status(200).json({ success: true, data: cipher });
  } catch (e) {
    console.error('getConfig service error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t get Wireguard config' });
    next(e);
  }
};

export const getInterfaces = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activeInterfacesList = getActiveInterfaceses();
    const defaultIface = getDefaultInterface();
    const interfacesListForSelect = activeInterfacesList.map(file => ({ checked: file === defaultIface, value: file }));
    res.status(200).json({
      success: true,
      data: interfacesListForSelect,
    });
  } catch (e) {
    console.error('getInterfaces service error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t get Wireguard Interfaces' });
    next(e);
  }
};

export const getFirstFreeIP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const iface = req.query.iface as string;
  try {
    const ifaceParams = getIfaceParams(iface);
    if (!ifaceParams.success || !ifaceParams.data) {
      res.status(422).json(ifaceParams);
      return;
    }
    const busyIPs = getInterfacePeersIPs(iface);
    const { cidr } = ifaceParams.data;
    res.status(200).json({
      success: true,
      data: getFirstAvailableIP(busyIPs, cidr),
    });
  } catch (e) {
    console.error('getFirstFreeIP service error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t get new free IP' });
    next(e);
  }
};

export const updateFrontendSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { dns, frontendPasskey, runtimeRotationMinutes } = req.body as Partial<FrontendConfigFile> & { runtimeRotationMinutes?: number };
  try {
    const config = readJSON({ filePath: CONFIG_PATH, parseJSON: true, createIfNotFound: {} }) as FrontendConfigFile;
    if (Array.isArray(dns)) {
      config.dns = dns.filter(Boolean);
    } else if (typeof dns === 'string') {
      config.dns = dns
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    }
    if (frontendPasskey && typeof frontendPasskey === 'string' && frontendPasskey.trim()) {
      config.frontendPasskey = frontendPasskey.trim();
    }
    if (typeof runtimeRotationMinutes === 'number' && runtimeRotationMinutes > 0) {
      config.runtimeRotationMinutes = runtimeRotationMinutes;
    }
    saveJSON(CONFIG_PATH, JSON.parse(JSON.stringify(config)), true);
    await loadServerConfig();
    initRuntimeGuard(config.runtimeRotationMinutes ?? 5);
    res.status(200).json({ success: true });
  } catch (e) {
    console.error('updateFrontendSettings error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t update frontend settings' });
    next(e);
  }
};

export const getFrontendSettings = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dns, runtimeRotationMinutes } = getFrontendConfig();
    res.status(200).json({ success: true, data: { dns, runtimeRotationMinutes } });
  } catch (e) {
    console.error('getFrontendSettings error: ', e);
    res.status(520).json({ success: false, errors: 'Can`t load frontend settings' });
    next(e);
  }
};
