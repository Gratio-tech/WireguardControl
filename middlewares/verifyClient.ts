import { Request, Response, NextFunction } from 'express';

// В продакшене следует менять код постоянно!
const VERIFICATION_CODE = 'HGJGRGSADF12342kjSJF3riuhfkds3';

// Данный посредник проверяет, валиден ли клиент отправивший данные
export const verifyClient = async (req: Request, res: Response, next:NextFunction): Promise<void> => {
  const verificationCode = req.headers['x-verification-code'];

  if (typeof verificationCode !== 'string' || verificationCode !== VERIFICATION_CODE) {
    console.log('Incorrect client detected');
    res.status(403).json({ message: 'Forbidden' }).end();
  } else {
    next();
  }
};
