import type { NextFunction, Request, Response } from 'express';
import { ifaceCorrect } from '../utils/index.js';

export const checkInterface = (req: Request, res: Response, next: NextFunction): void => {
  const ifacePOST = req.body?.iface as string | undefined;
  const ifaceGET = req.query?.iface as string | undefined;
  if (!ifaceCorrect(ifacePOST) && !ifaceCorrect(ifaceGET)) {
    res.status(422).json({ success: false, errors: 'Incorrect interface!' });
    return;
  }
  next();
};
