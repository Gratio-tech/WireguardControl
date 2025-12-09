## Wireguard Control — Web Interface for WireGuard
[![npm version](https://img.shields.io/npm/v/@gratio/wg?color=%23047dec)](https://www.npmjs.org/package/@gratio/wg)

A simple web interface for WireGuard VPN that allows using existing configurations or setting up new ones.

### Features and Characteristics
- Adding and removing clients via the web interface with live QR preview
- Tracking status in the interface
- Reloading WireGuard via the web interface
- Working with multiple `.conf` files (interfaces)
- Written in JS, with a maximally simple and open interface, allowing on-the-fly edits without the need for building
- Rotating runtime verification tokens (no hardcoded secrets in the repo)
- Client secrets are stored encrypted in `.data/peers.json`
- Does not use any databases (data is stored in JSON)

### Disadvantages
- Applying a configuration (*e.g., after adding a client*) requires a WireGuard reload
- Requires NodeJS to be installed, and preferably PM2 for automatic restart support

### Preparation
WireGuard and NodeJS are required. The guide below is for Ubuntu.
```bash
sudo apt install wireguard
```
The easiest way to install the required version of NodeJS is via [NVM](https://github.com/nvm-sh/nvm). This project was tested on NodeJS v.20.10, but it will likely work on older versions as well (probably even on version 12), so you can try installing NodeJS via `apt`. Below are example commands for installing NVM:
```bash
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

source ~/.bashrc
```
You can check if `nvm` is installed by running `nvm -v`. After that, install the recommended NodeJS version:
```bash
nvm install 20.10.0
```

### Installation (from sources)
Clone the repository into a convenient folder (here, for example, it's `/var/@gratio/wg`):
```bash
git clone https://github.com/Gratio-tech/WireguardControl.git /var/@gratio/wg
```

Navigate to the created folder and install the dependencies, then build:
```bash
cd /var/@gratio/wg
npm i
npm run build
```

### Launch
Navigate to the previously created folder and start the server:
```bash
cd /var/@gratio/wg

npm run start
```
Don't forget to specify your settings in the file `config.example.json` (on first launch it will be renamed to `config.json` file). You should set the default WG-interface and add your server's IP (in VPN network) to `allowedOrigins`. Also ensure that the `webServerPort` used by this server by default (`8877`) is open in the firewall (if you have port blocking enabled).

**BE SURE TO CHANGE ALL DEFAULT SECRETS!**

Note that you can generate a random key for yourself directly in bash, for example in the following ways:
```bash
# Using openssl:
openssl rand -base64 16
# Using /dev/urandom and base64:
head -c 16 /dev/urandom | base64
```
Or run it in the developer console in the browser, opening the Wireguard Control web interface:
```javascript
// The forge library is used in public\index.html for encryption
forge.util.encode64(forge.random.getBytes(16));
```

After this, the interface will be accessible in your browser at your server's address, for example, `http://10.8.2.1:9876/`.
If you did this before manually creating the first client for WireGuard, you need to add your public IP and the `webServerPort` not blocked by your firewall to `allowedOrigins`.

Next, add the server script to autostart. There are several ways to do this, but the most convenient and simple is to use the `pm2` tool, which, among other things, allows for load distribution and memory usage monitoring.

```bash
npm install pm2 -g
cd /var/@gratio/wg && pm2 start demon.json --watch --ignore-watch="node_modules"
pm2 startup
pm2 save
```
Now, to monitor the server's status, simply run `pm2 monit`.

### Additional Information
Additional client data is stored in the `.data` folder in the `peers.json` file in the following format:
```JSON
{
  "PEER1_PUBLIC_KEY":{"name":"PEER1_NAME"},
  "PEER2_PUBLIC_KEY":{"name":"PEER2_NAME"}
}
```

When loading, `Wireguard-Control` searches for all available configs in `/etc/wireguard`, parses them, and loads them into memory, so the system does not access configuration files when requesting status.

### Config file

The `config.json` file (created from `config.example.json` on the first launch) now contains the following fields:

| Key | Description |
| --- | --- |
| `defaultInterface` | Interface name (without `.conf`) that will be selected by default |
| `frontServerPort` | Port used by the Express server |
| `allowedOrigins` | List of URLs allowed for CORS |
| `frontendPasskey` | Key that is used to encrypt API responses in the browser (enter it on the UI to read data) |
| `dns` | Array of DNS servers that will be inserted into generated configs |
| `clientEncryptionPass` | Passphrase used to AES-encrypt client private keys and preshared keys in `.data/peers.json` |
| `runtimeRotationMinutes` | Interval for regenerating the runtime verification script (`public/assets/runtime.js`) |

### CLI / npm usage

The project exposes a small CLI so you can install it globally or run with `npx`:

```bash
npm install -g @gratio/wg          # or use npx @gratio/wg ...
@gratio/wg init-config             # copies config.example.json -> config.json if needed
@gratio/wg serve                   # starts the Express server (same as npm run start)
```

The CLI commands run from the current working directory, so make sure you execute them inside the project folder (or a folder that contains your `config.json` and `.data` directory). This makes it easier to distribute the tool through a private registry and keep the runtime up to date with `npm update -g @gratio/wg`.

### Additional Information

Additional client data is stored in the `.data` folder in the `peers.json` file. Each entry now also contains encrypted `secretKey` and `presharedKey` fields, so even if somebody reads the file they still need `clientEncryptionPass` from `config.json` to obtain real values. Only the readable metadata (name, IP, interface) is kept in plain-text.

### Additional Resources

[Example WireGuard configuration for a corporate network](./sample.conf.md)
