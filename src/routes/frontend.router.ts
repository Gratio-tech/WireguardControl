import express, { Router } from 'express';
import { PUBLIC_DIR, PUBLIC_ASSETS_DIR } from '../utils/constants.js';

const router = Router({ mergeParams: true });

router.use('/', express.static(PUBLIC_DIR));
router.use('/assets', express.static(PUBLIC_ASSETS_DIR, { cacheControl: false }));

export default router;
