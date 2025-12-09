import { Router } from 'express';
import { checkInterface } from '../middlewares/index.js';
import { getWGStatus, rebootWGinterface } from '../services/index.js';

const router = Router({ mergeParams: true });

router.get('/status', getWGStatus);
router.get('/reboot', checkInterface, rebootWGinterface);

export default router;
