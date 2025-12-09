import type { NextFunction, Request, Response } from 'express';
import Crypt from '@gratio/crypt';
import { getFrontendConfig, getStatusFromBash, executeSingleCommand, setWGStatus } from '../utils/index.js';

type EncryptMsgFn = (params: { message: unknown; pass: string }) => unknown;
const encryptMsg: EncryptMsgFn = (Crypt as any).serverCrypt.encryptMsg;

export const getWGStatus = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsedStatus = await getStatusFromBash();
    if (!parsedStatus.success || !parsedStatus.data) {
      res.status(520).json({ success: false, error: parsedStatus.error || 'Unable to retrieve WireGuard status' });
      return;
    }
    const { frontendPasskey } = getFrontendConfig();
    const cipher = encryptMsg({ message: parsedStatus.data, pass: frontendPasskey });
    res.status(200).json({
      success: true,
      data: cipher,
    });
  } catch (e) {
    console.error('getWGStatus service error: ', e);
    const errorMessage =
      process.env.NODE_ENV === 'production' ? 'Unable to retrieve WireGuard status' : `getWGStatus error: ${(e as Error).message}`;
    res.status(520).json({ success: false, error: errorMessage });
    next(e);
  }
};

export const rebootWGinterface = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const iface = req.query.iface as string;
  try {
    let wgStatus = await executeSingleCommand('wg');
    if (wgStatus === '') {
      setWGStatus(false);
      console.log('WireGuard is down, attempting restart');
      await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
    } else {
      setWGStatus(true);
      console.log('WireGuard is running, attempting to stop');
      await executeSingleCommand('bash', ['-c', `wg-quick down ${iface}`]);
      wgStatus = await executeSingleCommand('wg');
      if (wgStatus === '') {
        setWGStatus(false);
        console.log('WireGuard stopped, attempting restart');
        await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
      } else {
        res.status(500).json({ success: false, error: 'Failed to stop WireGuard' });
        return;
      }
    }
    setWGStatus(true);
    console.log('WireGuard successfully restarted');
    res.status(200).json({ success: true, data: 'WireGuard restarted successfully' });
  } catch (e) {
    console.error('rebootWGinterface service error: ', e);
    const errorMessage =
      process.env.NODE_ENV === 'production' ? 'Error during WireGuard restart' : `rebootWGinterface error: ${(e as Error).message}`;
    res.status(520).json({ success: false, error: errorMessage });
    next(e);
  }
};
