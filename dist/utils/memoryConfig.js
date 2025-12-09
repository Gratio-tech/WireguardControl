import fs from 'fs';
import path from 'path';
import { readJSON, saveJSON } from 'boma';
import { isExistAndNotNull } from 'vanicom';
import { COLORS, genPubKey, getAllConfigs, getServerIP, getStatusFromBash } from './index.js';
import { parseInterfaceConfig } from './parsers.js';
import { CONFIG_EXAMPLE_PATH, CONFIG_PATH, INTERFACES_PATH, PEERS_PATH, DEFAULT_RUNTIME_ROTATION_MINUTES } from './constants.js';
const ensureDataFile = (filePath) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '{}', 'utf-8');
    }
};
const loadFrontendConfig = () => {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.log('config.json not found');
        if (fs.existsSync(CONFIG_EXAMPLE_PATH)) {
            fs.copyFileSync(CONFIG_EXAMPLE_PATH, CONFIG_PATH);
            console.log('config.example.json copied to config.json');
        }
        else {
            console.log(COLORS.Red, ' ');
            console.error(`No config files found! Create a config.json file in the project root with the params: {
  "defaultInterface": (string),
  "frontServerPort": (number),
  "allowedOrigins": [string, string],
  "frontendPasskey": (string),
  "dns": [string],
  "clientEncryptionPass": (string)
}`);
            console.log(COLORS.Reset, ' ');
            throw new Error('Config files not found');
        }
    }
    const config = readJSON({ filePath: CONFIG_PATH, createIfNotFound: {}, parseJSON: true });
    if (!Array.isArray(config.allowedOrigins)) {
        config.allowedOrigins = [];
    }
    if (!config.frontendPasskey) {
        throw new Error('frontendPasskey is required in config.json');
    }
    if (!config.clientEncryptionPass) {
        throw new Error('clientEncryptionPass is required in config.json');
    }
    if (!config.dns) {
        config.dns = ['10.8.1.1'];
    }
    return config;
};
const normalizeDNS = (dns) => {
    if (Array.isArray(dns)) {
        return dns.map(value => value.trim()).filter(Boolean);
    }
    if (typeof dns === 'string') {
        return dns
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);
    }
    return ['10.8.1.1'];
};
export const loadServerConfig = async () => {
    ensureDataFile(PEERS_PATH);
    ensureDataFile(INTERFACES_PATH);
    let frontendSettings = loadFrontendConfig();
    let savedPeers = readJSON({ filePath: PEERS_PATH, createIfNotFound: {}, parseJSON: true });
    const savedInterfaces = readJSON({ filePath: INTERFACES_PATH, createIfNotFound: {}, parseJSON: true });
    const interfacesCount = Object.keys(savedInterfaces).length;
    const allConfiguredInterfaces = await getAllConfigs();
    const externalIP = await getServerIP();
    const wgStatus = await getStatusFromBash();
    const dns = normalizeDNS(frontendSettings.dns);
    const runtimeRotationMinutes = frontendSettings.runtimeRotationMinutes ?? DEFAULT_RUNTIME_ROTATION_MINUTES;
    const { allowedOrigins, defaultInterface, frontServerPort, frontendPasskey, clientEncryptionPass } = frontendSettings;
    const configInMemory = {
        allowedOrigins,
        frontServerPort,
        frontendPasskey,
        dns,
        runtimeRotationMinutes,
        clientEncryptionPass,
        wgIsWorking: wgStatus.success,
        configIsOk: true,
        endpoint: externalIP,
        defaultInterface: defaultInterface || '',
        interfaces: {},
    };
    let allActivePeers = [];
    if (allConfiguredInterfaces.success && allConfiguredInterfaces.data) {
        for (const confFile of allConfiguredInterfaces.data) {
            try {
                const { interface: currentInterface, peers } = await parseInterfaceConfig(confFile);
                const pubkey = await genPubKey(currentInterface.PrivateKey);
                const interfacePeers = [];
                peers.forEach(peer => {
                    if (!peer.PublicKey)
                        return;
                    interfacePeers.push(peer.PublicKey);
                    savedPeers = {
                        ...savedPeers,
                        [peer.PublicKey]: {
                            ...savedPeers[peer.PublicKey],
                            name: savedPeers[peer.PublicKey]?.name ?? '',
                            active: true,
                            ip: peer.AllowedIPs,
                            iface: confFile,
                        },
                    };
                });
                const configAddress = currentInterface.Address.trim().split('/');
                const serverIP = configAddress.shift();
                const serverCIDR = Number(configAddress.length > 0 ? configAddress[0] : '24');
                configInMemory.interfaces[confFile] = {
                    ip: serverIP,
                    cidr: serverCIDR,
                    port: Number(currentInterface.ListenPort),
                    pubkey,
                    peers: interfacePeers,
                };
                allActivePeers = [...allActivePeers, ...interfacePeers];
                if (isExistAndNotNull(defaultInterface) && confFile === defaultInterface) {
                    configInMemory.defaultInterface = confFile;
                }
            }
            catch (err) {
                console.error(`loadServerConfig fail on parse .conf file ${confFile}.conf: `, err);
            }
        }
        Object.keys(savedPeers).forEach(peerKey => {
            if (!allActivePeers.includes(peerKey))
                savedPeers[peerKey].active = false;
        });
        saveJSON(PEERS_PATH, JSON.parse(JSON.stringify(savedPeers)), true);
    }
    const correctParsedIfaces = Object.keys(configInMemory.interfaces);
    if (interfacesCount === 0 && !wgStatus.success) {
        configInMemory.configIsOk = false;
        console.error('No saved settings are found and WG is off.');
    }
    if (!correctParsedIfaces.length) {
        configInMemory.configIsOk = false;
        console.error('No .conf files correctly parsed from /etc/wireguard');
    }
    else if (!isExistAndNotNull(defaultInterface) || !correctParsedIfaces.includes(defaultInterface)) {
        const firstInterface = correctParsedIfaces[0];
        frontendSettings.defaultInterface = firstInterface;
        saveJSON(CONFIG_PATH, JSON.parse(JSON.stringify(frontendSettings)), true);
        console.log('defaultInterface from ./config.json missing or incorrect, set new: ', firstInterface);
        configInMemory.defaultInterface = firstInterface;
    }
    configInMemory.wgIsWorking = wgStatus.success;
    console.log('\n', COLORS.Cyan, 'Config loaded in memory: ', configInMemory, '\n', COLORS.Reset);
    global.wgControlServerSettings = { ...configInMemory };
};
export const getActiveInterfaceses = () => {
    return Object.keys(global.wgControlServerSettings.interfaces || {});
};
export const getDefaultInterface = () => {
    return global.wgControlServerSettings.defaultInterface;
};
export const getFrontendConfig = () => {
    return {
        allowedOrigins: global.wgControlServerSettings.allowedOrigins,
        frontServerPort: global.wgControlServerSettings.frontServerPort,
        frontendPasskey: global.wgControlServerSettings.frontendPasskey,
        dns: global.wgControlServerSettings.dns,
        runtimeRotationMinutes: global.wgControlServerSettings.runtimeRotationMinutes,
    };
};
export const getClientEncryptionPass = () => global.wgControlServerSettings.clientEncryptionPass;
export const ifaceCorrect = (iface) => {
    const activeInterfacesList = getActiveInterfaceses();
    return isExistAndNotNull(iface) && activeInterfacesList.includes(String(iface));
};
export const getIfaceParams = (iface) => {
    if (!ifaceCorrect(iface)) {
        return { success: false, errors: 'Incorrect interface!' };
    }
    return { success: true, data: { ...global.wgControlServerSettings.interfaces[String(iface)] } };
};
export const getCurrentEndpoint = () => {
    return global.wgControlServerSettings.endpoint;
};
export const setWGStatus = (status) => {
    global.wgControlServerSettings.wgIsWorking = status;
};
