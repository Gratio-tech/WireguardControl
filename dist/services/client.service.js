import { readJSON, saveJSON } from 'boma';
import Crypt from '@gratio/crypt';
import path from 'path';
import { appendDataToConfig, formatConfigToString, formatObjectToConfigSection, genNewClientKeys, getClientEncryptionPass, getCurrentEndpoint, getFrontendConfig, getInterfacePeersIPs, getIfaceParams, getFirstAvailableIP, loadServerConfig, removePeerFromConfig, } from '../utils/index.js';
import { PEERS_PATH } from '../utils/constants.js';
import { decryptSecret, encryptSecret } from '../utils/crypto.js';
const encryptMsg = Crypt.serverCrypt.encryptMsg;
const readPeers = () => {
    return readJSON({ filePath: path.resolve(PEERS_PATH), parseJSON: true, createIfNotFound: {} });
};
const persistPeers = (peers) => {
    saveJSON(PEERS_PATH, JSON.parse(JSON.stringify(peers)), true);
};
const buildClientConfig = (params) => {
    const { clientIp, iface, secretKey, presharedKey, serverPubKey, serverPort, dns } = params;
    const endpoint = getCurrentEndpoint();
    return formatConfigToString({
        Interface: {
            PrivateKey: secretKey,
            Address: clientIp,
            DNS: dns.join(', '),
        },
        Peer: {
            PresharedKey: presharedKey,
            PublicKey: serverPubKey,
            AllowedIPs: '0.0.0.0/0',
            Endpoint: `${endpoint}:${serverPort}`,
            PersistentKeepalive: 25,
        },
    });
};
export const addNewClient = async (req, res, next) => {
    const requestedIP = req.body?.ip;
    const newName = req.body?.name;
    const iface = req.body?.iface;
    try {
        const ifaceParams = getIfaceParams(iface);
        if (!ifaceParams.success || !ifaceParams.data) {
            res.status(400).json(ifaceParams);
            return;
        }
        const { cidr: serverCIDR, pubkey: serverPubKey, port: serverWGPort } = ifaceParams.data;
        const busyIPs = getInterfacePeersIPs(iface);
        if (typeof requestedIP === 'string' && requestedIP.trim().length > 0 && busyIPs.includes(requestedIP)) {
            res.status(400).json({ success: false, errors: 'Requested IP for new client is already in use' });
            return;
        }
        const newClientData = await genNewClientKeys();
        const newIP = requestedIP ?? getFirstAvailableIP(busyIPs, serverCIDR);
        if (!newIP) {
            res.status(409).json({ success: false, errors: 'No free IPs left in this interface CIDR' });
            return;
        }
        const clientIP = newIP;
        await appendDataToConfig(`/etc/wireguard/${iface}.conf`, formatObjectToConfigSection('Peer', {
            PublicKey: newClientData.pubKey,
            PresharedKey: newClientData.presharedKey,
            AllowedIPs: clientIP,
        }));
        const peers = readPeers();
        const encryptionPass = getClientEncryptionPass();
        const now = new Date().toISOString();
        peers[newClientData.pubKey] = {
            name: newName ?? '',
            active: true,
            ip: clientIP,
            presharedKey: encryptSecret(newClientData.presharedKey, encryptionPass),
            secretKey: encryptSecret(newClientData.randomKey, encryptionPass),
            iface,
            createdAt: now,
            updatedAt: now,
        };
        persistPeers(peers);
        const { dns, frontendPasskey } = getFrontendConfig();
        const configString = buildClientConfig({
            iface,
            clientIp: clientIP,
            secretKey: newClientData.randomKey,
            presharedKey: newClientData.presharedKey,
            serverPubKey,
            serverPort: serverWGPort,
            dns,
        });
        await loadServerConfig();
        const payload = {
            client: {
                pubKey: newClientData.pubKey,
                name: newName ?? '',
                ip: clientIP,
                iface,
            },
            config: configString,
        };
        const cipher = encryptMsg({ message: payload, pass: frontendPasskey });
        res.status(201).json({
            success: true,
            data: cipher,
        });
    }
    catch (e) {
        console.error('addNewClient service error: ', e);
        res.status(520).json({ success: false, errors: 'Can`t add new client' });
        next(e);
    }
};
export const removeClient = async (req, res, next) => {
    const iface = req.body?.iface;
    const pubKey = req.body?.pubKey;
    if (!pubKey || typeof pubKey !== 'string' || pubKey.trim().length !== 44) {
        res.status(422).json({ success: false, errors: 'Incorrect public key!' });
        return;
    }
    try {
        const peers = readPeers();
        if (!peers[pubKey]) {
            res.status(404).json({ success: false, errors: 'Peer not found' });
            return;
        }
        const removedFromConfig = removePeerFromConfig(iface, pubKey);
        if (!removedFromConfig) {
            res.status(404).json({ success: false, errors: 'Peer not found in config' });
            return;
        }
        delete peers[pubKey];
        persistPeers(peers);
        await loadServerConfig();
        res.status(200).json({ success: true });
    }
    catch (e) {
        console.error('removeClient service error: ', e);
        res.status(520).json({ success: false, errors: 'Can`t remove client' });
        next(e);
    }
};
export const getClientConfig = async (req, res, next) => {
    const pubKey = req.params.pubKey;
    try {
        if (!pubKey) {
            res.status(400).json({ success: false, errors: 'Public key is required' });
            return;
        }
        const peers = readPeers();
        const peer = peers[pubKey];
        if (!peer || !peer.iface) {
            res.status(404).json({ success: false, errors: 'Client not found' });
            return;
        }
        const ifaceParams = getIfaceParams(peer.iface);
        if (!ifaceParams.success || !ifaceParams.data) {
            res.status(400).json(ifaceParams);
            return;
        }
        const encryptionPass = getClientEncryptionPass();
        if (!peer.secretKey || !peer.presharedKey) {
            res.status(400).json({ success: false, errors: 'Client secrets are missing' });
            return;
        }
        const secretKey = decryptSecret(peer.secretKey, encryptionPass);
        const presharedKey = decryptSecret(peer.presharedKey, encryptionPass);
        const { dns, frontendPasskey } = getFrontendConfig();
        const configString = buildClientConfig({
            iface: peer.iface,
            clientIp: peer.ip,
            secretKey,
            presharedKey,
            serverPubKey: ifaceParams.data.pubkey,
            serverPort: ifaceParams.data.port,
            dns,
        });
        const payload = { client: { pubKey, name: peer.name, ip: peer.ip, iface: peer.iface }, config: configString };
        const cipher = encryptMsg({ message: payload, pass: frontendPasskey });
        res.status(200).json({ success: true, data: cipher });
    }
    catch (e) {
        console.error('getClientConfig service error: ', e);
        res.status(520).json({ success: false, errors: 'Can`t build client config' });
        next(e);
    }
};
