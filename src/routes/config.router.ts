import { Router, json } from 'express';
import { checkInterface } from '../middlewares/index.js';
import { addNewClient, getClientConfig, removeClient } from '../services/client.service.js';
import {
  getFirstFreeIP,
  getInterfaceConfig,
  getInterfaces,
  getFrontendSettings,
  updateFrontendSettings,
} from '../services/config.service.js';

const router = Router({ mergeParams: true });
const jsonParser = json({ limit: '10mb' });

router.get('/', checkInterface, getInterfaceConfig);
router.get('/interfaces', getInterfaces);
router.get('/freeIP', checkInterface, getFirstFreeIP);
router.get('/frontend', getFrontendSettings);
router.post('/frontend', jsonParser, updateFrontendSettings);
router.post('/client/add', jsonParser, checkInterface, addNewClient);
router.post('/client/remove', jsonParser, checkInterface, removeClient);
router.get('/client/:pubKey/config', getClientConfig);

export default router;
