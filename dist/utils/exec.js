import { spawn } from 'child_process';
export const COLORS = {
    Reset: '\x1b[0m',
    Red: '\x1b[31m',
    Green: '\x1b[32m',
    Yellow: '\x1b[33m',
    Blue: '\x1b[34m',
    Magenta: '\x1b[35m',
    Cyan: '\x1b[36m',
    White: '\x1b[37m',
};
export const executeSingleCommand = (command, args = []) => {
    return new Promise((resolve, reject) => {
        const childProcess = spawn(command, args);
        let stdoutData = '';
        let stderrData = '';
        childProcess.stdout.on('data', data => {
            stdoutData += data.toString();
        });
        childProcess.stderr.on('data', data => {
            stderrData += data.toString();
        });
        childProcess.on('close', code => {
            if (code !== 0) {
                reject(new Error(`executeSingleCommand failed with code ${code}: ${stderrData}`));
            }
            else {
                resolve(stdoutData.trim());
            }
        });
    });
};
export const genPubKey = async (privateKey) => {
    const pubKey = await executeSingleCommand('bash', ['-c', `echo ${privateKey} | wg pubkey`]);
    return pubKey;
};
export const genNewClientKeys = async () => {
    const randomKey = await executeSingleCommand('wg', ['genkey']);
    const presharedKey = await executeSingleCommand('wg', ['genpsk']);
    const pubKey = await genPubKey(randomKey);
    return { randomKey, presharedKey, pubKey };
};
export const getServerIP = async () => {
    const externalInterface = await executeSingleCommand('bash', ['-c', `ip route | awk '/default/ {print $5; exit}'`]);
    const command = `ip addr show ${externalInterface} | grep "inet" | grep -v "inet6" | head -n 1 | awk '/inet/ {print $2}' | awk -F/ '{print $1}'`;
    const pubIP = await executeSingleCommand('bash', ['-c', command]);
    return pubIP;
};
