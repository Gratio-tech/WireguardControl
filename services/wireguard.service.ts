import Crypt from '@gratio/crypt';
import { getDateTime } from 'vanicom';

import { getFrontendConfig, executeSingleCommand, getStatusFromBash, setWGStatus, restartProcess } from '../utils/index.js';

import type { Request, Response, NextFunction } from 'express';

const { encryptMsg } = Crypt.serverCrypt;

export const getWGStatus = async (_: Request, res: Response<AppResult>, next: NextFunction) => {
  try {
    const parsedStatus = await getStatusFromBash();
    const { frontendPasskey } = getFrontendConfig();
    const cipher = encryptMsg({ message: parsedStatus, pass: frontendPasskey });

    res.status(200).json({
      success: true,
      data: cipher,
    });
  } catch (e) {
    console.error(`[${getDateTime()}] getWGStatus service error: `, e);
    const errorMessage =
      process.env.NODE_ENV === 'production' ? 'Unable to retrieve WireGuard status' : `getWGStatus error: ${(e as Error).message}`;

    res.status(520).json({
      success: false,
      error: errorMessage,
    });
    next(e);
  }
};

export const rebootWGinterface = async (req: Request, res: Response<AppResult>, next: NextFunction) => {
  const iface = req.query.iface as string; // Проверяется в мидлваре
  try {
    let wgStatus = await executeSingleCommand('wg');

    if (wgStatus === '') {
      setWGStatus(false);
      console.log(`[${getDateTime()}] WireGuard is down, attempting restart`);
      await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
    } else {
      setWGStatus(true);
      console.log(`[${getDateTime()}] WireGuard is running, attempting to stop`);
      await executeSingleCommand('bash', ['-c', `wg-quick down ${iface}`]);

      wgStatus = await executeSingleCommand('wg');
      if (wgStatus === '') {
        setWGStatus(false);
        console.log(`[${getDateTime()}] WireGuard stopped, attempting restart`);
        await executeSingleCommand('bash', ['-c', `wg-quick up ${iface}`]);
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to stop WireGuard',
        });
      }
    }

    setWGStatus(true);
    console.log(`[${getDateTime()}] WireGuard successfully restarted`);

    setTimeout(restartProcess, 2000); // Перезагружаем процесс

    res.status(200).json({
      success: true,
      data: 'WireGuard restarted successfully',
    });
  } catch (e) {
    console.error(`[${getDateTime()}] rebootWGinterface service error: `, e);
    const errorMessage =
      process.env.NODE_ENV === 'production' ? 'Error during WireGuard restart' : `rebootWGinterface error: ${(e as Error).message}`;

    res.status(520).json({
      success: false,
      error: errorMessage,
    });
    next(e);
  }
};
