#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG_EXAMPLE_PATH, CONFIG_PATH } from './utils/constants.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const command = process.argv[2] ?? 'serve';
const help = () => {
    console.log(`wg-control CLI

Commands:
  serve             Start the WireGuard Control server
  init-config       Create config.json from config.example.json
  help              Show this message
`);
};
const initConfig = () => {
    if (fs.existsSync(CONFIG_PATH)) {
        console.log('config.json already exists');
        return;
    }
    if (!fs.existsSync(CONFIG_EXAMPLE_PATH)) {
        console.error('config.example.json not found. Cannot initialize config.');
        process.exit(1);
    }
    fs.copyFileSync(CONFIG_EXAMPLE_PATH, CONFIG_PATH);
    console.log('config.json created from config.example.json');
};
const serve = async () => {
    await import('./server.js');
};
(async () => {
    switch (command) {
        case 'serve':
            await serve();
            break;
        case 'init-config':
            initConfig();
            break;
        case 'help':
        case '--help':
        case '-h':
            help();
            break;
        default:
            console.warn(`Unknown command: ${command}`);
            help();
            process.exit(1);
    }
})();
