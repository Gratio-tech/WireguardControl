#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG_EXAMPLE_PATH, CONFIG_PATH } from './utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const command = process.argv[2] ?? 'serve';

const help = (): void => {
  console.log(`Gratio WireguardControl (@gratio/wg) CLI

Commands:
  init              Initialize project files (public/, config.example.json, demon.json) in current directory
  serve             Start the WireGuard Control server
  init-config       Create config.json from config.example.json
  help              Show this message
`);
};

const copyDirRecursive = (src: string, dest: string): void => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

const init = (): void => {
  const cwd = process.cwd();
  // Package directory is where this compiled script is located
  const packageDir = path.resolve(__dirname, '..');

  console.log('Initializing WireguardControl in current directory...');

  // Copy public directory
  const publicSrc = path.join(packageDir, 'public');
  const publicDest = path.join(cwd, 'public');

  if (fs.existsSync(publicDest)) {
    console.log('Directory "public" already exists, skipping...');
  } else if (fs.existsSync(publicSrc)) {
    copyDirRecursive(publicSrc, publicDest);
    console.log('✓ Copied public/ directory');
  } else {
    console.warn('⚠️  Warning: "public" directory not found in package');
  }

  // Copy config.example.json
  const configExampleSrc = path.join(packageDir, 'config.example.json');
  const configExampleDest = path.join(cwd, 'config.json');

  if (fs.existsSync(configExampleDest)) {
    console.log('config.json already exists, skipping...');
  } else if (fs.existsSync(configExampleSrc)) {
    fs.copyFileSync(configExampleSrc, configExampleDest);
    console.log('✓ Created config.json');
  }

  // Copy demon.json (for PM2)
  const demonSrc = path.join(packageDir, 'demon.json');
  const demonDest = path.join(cwd, 'demon.json');

  if (fs.existsSync(demonDest)) {
    console.log('demon.json already exists, skipping...');
  } else if (fs.existsSync(demonSrc)) {
    // Update demon.json to use the global package
    const demonContent = JSON.parse(fs.readFileSync(demonSrc, 'utf-8'));
    if (demonContent.apps && demonContent.apps[0]) {
      demonContent.apps[0].script = '@gratio/wg';
      demonContent.apps[0].args = 'serve';
    }
    fs.writeFileSync(demonDest, JSON.stringify(demonContent, null, 2));
    console.log('✓ Copied demon.json (configured for global npm package);');
  }

  console.log('Initialization complete! \n');
  console.log('Next steps:');
  console.log('  1. Edit config.example.json and rename it to config.json');
  console.log('  2. Run: @gratio/wg serve');
  console.log('  3. [Optional] Use PM2: pm2 start demon.json');
};

const initConfig = (): void => {
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

const serve = async (): Promise<void> => {
  await import('./server.js');
};

(async () => {
  switch (command) {
    case 'init':
      init();
      break;
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
