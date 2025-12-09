import { ifaceCorrect } from '../utils/index.js';
export const checkInterface = (req, res, next) => {
    const ifacePOST = req.body?.iface;
    const ifaceGET = req.query?.iface;
    if (!ifaceCorrect(ifacePOST) && !ifaceCorrect(ifaceGET)) {
        res.status(422).json({ success: false, errors: 'Incorrect interface!' });
        return;
    }
    next();
};
