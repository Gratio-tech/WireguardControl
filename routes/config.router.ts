import { Router, json } from 'express';

import { checkInterface } from '@middlewares';
import { addNewClient, getInterfaceConfig, getInterfaces, getFirstFreeIP, removeClient, renameClient } from '@services';

const router = Router({ mergeParams: true });

const jsonParser = json({ limit: '10mb' });

// Получить конфиг конкретного интерфейса (api/config?iface=wg)
router.get('/', checkInterface, getInterfaceConfig);

// Проверяются только загруженные в память конфиги! Для проверки сохранённых написать отдельный метод.
router.get('/interfaces', getInterfaces);
router.get('/freeIP', checkInterface, getFirstFreeIP); // Получаем первый свободный IP для интерфейса
router.post('/client/add', jsonParser, checkInterface, addNewClient);
router.post('/client/remove', jsonParser, checkInterface, removeClient);
router.post('/client/rename', jsonParser, checkInterface, renameClient);
// Для удаления нужно отправить POST-запрос вида { "iface": "wg0", "pubKey": "публичный_ключ_клиента" }

export default router;
