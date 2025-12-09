import { appendFileSync, readdir, readFileSync, writeFileSync } from 'fs';
export const appendDataToConfig = async (filePath, data) => {
    const stringToAppend = `\n${data}\n`;
    try {
        appendFileSync(filePath, stringToAppend, 'utf-8');
    }
    catch (error) {
        console.error(`Error on appendDataToConfig to file: "${filePath}":`, error);
        throw error;
    }
};
export const formatObjectToConfigSection = (sectionName, configObject) => {
    if (!sectionName || !Object.keys(configObject).length) {
        console.log('Incorrect data for formatObjectToConfigSection: ', sectionName, configObject);
    }
    let output = `[${sectionName}]\n`;
    Object.entries(configObject).forEach(([key, value]) => {
        output += `${key} = ${value}\n`;
    });
    output += '\n';
    return output;
};
export const formatConfigToString = (configObject) => {
    let output = '';
    for (const section in configObject) {
        if (section.toLowerCase() === 'peers') {
            configObject[section].forEach((peer) => {
                if (!('PublicKey' in peer) || !('PresharedKey' in peer) || !('AllowedIPs' in peer)) {
                    console.log('Incorrect peer in configObject: ', peer);
                    return;
                }
                output += formatObjectToConfigSection('Peer', peer);
            });
            continue;
        }
        output += formatObjectToConfigSection(section, configObject[section]);
    }
    return output;
};
export const getAllConfigs = async () => {
    const allConfFiles = await new Promise((resolve, reject) => {
        readdir('/etc/wireguard', (err, files) => {
            if (err) {
                reject(err);
            }
            else {
                const confFiles = [];
                files.forEach(file => {
                    if (file.endsWith('.conf')) {
                        confFiles.push(file.replace(/\.[^.]*$/, ''));
                    }
                });
                resolve(confFiles);
            }
        });
    });
    if (!Array.isArray(allConfFiles)) {
        console.error('getAllConfigs error when getting the configs files: ', allConfFiles);
        return { success: false, errors: 'Error when get configs' };
    }
    if (!allConfFiles.length) {
        return { success: false, errors: 'Seems like WireGuard is not configured yet (no .conf files in /etc/wireguard)' };
    }
    return { success: true, data: allConfFiles };
};
export const removePeerFromConfig = (iface, pubKey) => {
    const configPath = `/etc/wireguard/${iface}.conf`;
    let configData = readFileSync(configPath, 'utf8');
    const sections = configData.split(/(?=\[)/g);
    let peerFound = false;
    const newSections = sections.filter(section => {
        if (section.startsWith('[Peer]')) {
            const peerPublicKeyMatch = section.match(/PublicKey\s*=\s*([^\s]+)/);
            if (peerPublicKeyMatch && peerPublicKeyMatch[1] === pubKey) {
                peerFound = true;
                return false;
            }
        }
        return true;
    });
    if (peerFound) {
        writeFileSync(configPath, newSections.join(''), 'utf8');
    }
    return peerFound;
};
