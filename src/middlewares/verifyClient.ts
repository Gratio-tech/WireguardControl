import type { NextFunction, Request, Response } from 'express';
import { isValidRuntimeCode } from '../core/runtimeGuard.js';

export const verifyClient = (req: Request, res: Response, next: NextFunction): void => {
  const verificationCode = req.headers['x-verification-code'];
  if (!isValidRuntimeCode(verificationCode)) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  next();
};
