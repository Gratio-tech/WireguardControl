/* global makeRequest, responseHandler, renderError, clearErrorAndTimeout, objectToHTML, renderPeerBlocks, validateIPWithSubnet, toast, download, defaultUpdateInterval, freeIP, timerId */

(() => {
  const state = {
    frontendSettings: { dns: [], runtimeRotationMinutes: 5 },
    modal: {
      configText: '',
      fileName: 'Client.conf',
      autoDownload: true,
      mode: 'create'
    }
  };

  const currentIface = () => document.querySelector('#ifaces-list input[type="radio"]:checked')?.value;
  const getPass = () => unpack(document.querySelector('#passkey-input')?.value || '');
  const configDetailsNode = document.getElementById('config-details');
  const settingsPanel = document.getElementById('frontend-settings-panel');
  const settingsForm = document.getElementById('frontend-settings-form');
  const dnsInput = document.getElementById('dns-input');
  const passUpdateInput = document.getElementById('frontend-passkey-update');
  const runtimeInput = document.getElementById('runtime-rotation-input');

  function savePasskey() {
    const inputVal = document.querySelector('#passkey-input')?.value || '';
    if (inputVal === '') {
      localStorage.removeItem('ps');
    } else {
      localStorage.setItem('ps', String(inputVal));
    }
    getStatus();
  }

  function getFreeIP() {
    makeRequest({
      url: `/api/config/freeIP?iface=${currentIface()}`,
      type: 'GET',
      callback: response => {
        const res = responseHandler(response);
        if (!res.success) {
          console.error('Error on get free IP: ', res.data);
          renderError(res.data);
        } else if (res.data) {
          freeIP = res.data;
          const ipInput = document.getElementById('client-ip-input');
          if (ipInput && ipInput.value === '') {
            ipInput.value = freeIP || '';
          }
        }
      }
    });
  }

  function getStatus() {
    clearErrorAndTimeout();
    const statusTab = document.getElementById('status-tab');
    const configTab = document.getElementById('config-tab');
    if (!statusTab || !configTab) return;
    statusTab.style.display = 'block';
    configTab.style.display = 'none';

    makeRequest({
      url: '/api/wireguard/status',
      type: 'GET',
      callback: response => {
        const res = responseHandler(response, getPass());
        if (!res.success) {
          renderError(res.data);
          return;
        }
        const statsData = res.data;
        if (!statsData || !Object.hasOwnProperty(statsData, 'interface')) {
          renderError('Некорректный ключ расшифровки, либо данные не валидны');
          return;
        }
        const statusBlock = document.getElementById('status-block');
        if (!statusBlock) return;
        statusBlock.innerHTML = '';
        const divElem = document.createElement('div');
        divElem.innerHTML =
          `<b>Interface name: </b> ${statsData.interface.name} <br />
          <b>Public key: </b>${statsData.interface['public key']} <br />
          <b>Listening port: </b>${statsData.interface['listening port']} <br /><br />
          ${renderPeerBlocks(statsData.peers)} <br />`;
        statusBlock.append(divElem);
        timerId = setTimeout(getStatus, defaultUpdateInterval);
      }
    });
  }

  function getConfig() {
    clearErrorAndTimeout();
    const statusTab = document.getElementById('status-tab');
    const configTab = document.getElementById('config-tab');
    if (!statusTab || !configTab) return;
    statusTab.style.display = 'none';
    configTab.style.display = 'block';

    makeRequest({
      url: `/api/config?iface=${currentIface()}`,
      type: 'GET',
      callback: response => {
        const res = responseHandler(response, getPass());
        if (!res.success) {
          renderError(res.data);
          return;
        }
        const configData = res.data;
        if (!configData) {
          renderError('Некорректный ключ расшифровки');
          return;
        }
        if (configDetailsNode) {
          configDetailsNode.innerHTML = '<h3>Interface</h3>' + objectToHTML(configData.interface) + '<br />' + renderPeerBlocks(configData.peers);
        }
        if (settingsPanel) {
          settingsPanel.classList.remove('hidden');
        }
      }
    });
  }

  function tryReboot() {
    clearErrorAndTimeout();
    const statusTab = document.getElementById('status-tab');
    const configTab = document.getElementById('config-tab');
    if (statusTab && configTab) {
      statusTab.style.display = 'block';
      configTab.style.display = 'none';
    }
    makeRequest({
      url: `/api/wireguard/reboot?iface=${currentIface()}`,
      type: 'GET',
      callback: response => {
        const res = responseHandler(response);
        if (!res.success) {
          renderError(res.data);
        } else {
          const preblock = document.getElementById('status-block');
          if (preblock) preblock.innerHTML = res.data;
        }
      }
    });
  }

  function deleteClient(pubKey) {
    if (!confirm('Вы уверены, что хотите удалить клиента? Это действие необратимо.')) return;
    makeRequest({
      url: '/api/config/client/remove',
      type: 'POST',
      callback: response => {
        const res = responseHandler(response);
        if (!res.success) {
          renderError(res.data);
        } else {
          toast({ message: "Клиент удалён. Не забудьте перезапустить WireGuard", duration: 5000 });
          const statusTab = document.getElementById('status-tab');
          if (statusTab && statusTab.style.display !== 'none') {
            getStatus();
          } else {
            getConfig();
          }
        }
      },
      data: JSON.stringify({ iface: currentIface(), pubKey })
    });
  }

  function fetchInterfaces() {
    makeRequest({
      url: '/api/config/interfaces',
      type: 'GET',
      callback: response => {
        const res = responseHandler(response);
        if (!res.success || !Array.isArray(res.data)) {
          renderError(res.data);
          return;
        }
        renderInterfaceList(res.data, document.getElementById('ifaces-list'));
        getFreeIP();
        setTimeout(getStatus, 1000);
      }
    });
  }

  function fetchFrontendSettings() {
    makeRequest({
      url: '/api/config/frontend',
      type: 'GET',
      callback: response => {
        const res = responseHandler(response);
        if (res.success && res.data) {
          state.frontendSettings = res.data;
          applyFrontendSettingsToForm();
        }
      }
    });
  }

  function applyFrontendSettingsToForm() {
    if (dnsInput && Array.isArray(state.frontendSettings.dns)) {
      dnsInput.value = state.frontendSettings.dns.join(', ');
    }
    if (runtimeInput && state.frontendSettings.runtimeRotationMinutes) {
      runtimeInput.value = state.frontendSettings.runtimeRotationMinutes;
    }
    if (settingsPanel) {
      settingsPanel.classList.remove('hidden');
    }
  }

  function handleFrontendSettingsSubmit(event) {
    event.preventDefault();
    const payload = {
      dns: dnsInput?.value || '',
      frontendPasskey: passUpdateInput?.value || undefined,
      runtimeRotationMinutes: runtimeInput?.value ? Number(runtimeInput.value) : undefined
    };
    makeRequest({
      url: '/api/config/frontend',
      type: 'POST',
      data: JSON.stringify(payload),
      callback: response => {
        const res = responseHandler(response);
        if (!res.success) {
          renderError(res.data);
        } else {
          toast({ message: 'Настройки сохранены', duration: 4000 });
          if (passUpdateInput) passUpdateInput.value = '';
          fetchFrontendSettings();
          refreshRuntimeCode(true);
        }
      }
    });
  }

  function setupClientModal() {
    const form = document.getElementById('client-form');
    if (form) {
      form.addEventListener('submit', handleClientFormSubmit);
    }
  }

  function openClientModal(mode = 'create') {
    state.modal.mode = mode;
    const modal = document.getElementById('client-modal');
    const createState = document.getElementById('client-modal-create');
    const resultState = document.getElementById('client-modal-result');
    const errorBlock = document.getElementById('client-form-error');
    if (!modal || !createState || !resultState || !errorBlock) return;
    errorBlock.innerText = '';
    if (mode === 'create') {
      createState.classList.remove('hidden');
      resultState.classList.add('hidden');
      const nameInput = document.getElementById('client-name-input');
      const ipInput = document.getElementById('client-ip-input');
      const checkbox = document.getElementById('client-download-checkbox');
      if (nameInput) nameInput.value = 'Client';
      if (ipInput) ipInput.value = freeIP || '';
      if (checkbox) checkbox.checked = true;
    } else {
      createState.classList.add('hidden');
      resultState.classList.remove('hidden');
    }
    modal.classList.remove('hidden');
  }

  function closeClientModal() {
    const modal = document.getElementById('client-modal');
    if (modal) modal.classList.add('hidden');
  }

  function handleClientFormSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('client-name-input')?.value || '';
    const ip = document.getElementById('client-ip-input')?.value || '';
    const checkbox = document.getElementById('client-download-checkbox');
    state.modal.autoDownload = Boolean(checkbox?.checked);
    if (ip && !validateIPWithSubnet(ip)) {
      showClientFormError('Введён некорректный IP: ' + ip);
      return;
    }
    const iface = currentIface();
    if (!iface) {
      showClientFormError('Сначала выберите интерфейс');
      return;
    }
    setClientFormDisabled(true);
    makeRequest({
      url: '/api/config/client/add',
      type: 'POST',
      data: JSON.stringify({ name, ip, iface }),
      callback: response => {
        setClientFormDisabled(false);
        const res = responseHandler(response, getPass());
        if (!res.success) {
          showClientFormError(typeof res.data === 'string' ? res.data : 'Не удалось создать клиента');
          return;
        }
        if (!res.data || !res.data.client || !res.data.config) {
          showClientFormError('Некорректный ответ сервера');
          return;
        }
        openClientResult(res.data);
        getFreeIP();
        getStatus();
      }
    });
  }

  function showClientFormError(message) {
    const errorBlock = document.getElementById('client-form-error');
    if (errorBlock) {
      errorBlock.innerText = message;
    } else {
      renderError(message);
    }
  }

  function setClientFormDisabled(flag) {
    const form = document.getElementById('client-form');
    if (!form) return;
    Array.from(form.elements).forEach(el => {
      el.disabled = flag;
    });
  }

  function openClientResult(payload) {
    state.modal.mode = 'result';
    state.modal.configText = payload.config;
    const safeName = (payload.client.name || 'Client').replace(/[^A-Za-z0-9_-]+/g, '_');
    state.modal.fileName = `${safeName}.conf`;
    const resultMeta = document.getElementById('client-result-meta');
    if (resultMeta) {
      resultMeta.innerHTML = `<b>${payload.client.name || 'Client'}</b> — ${payload.client.ip}`;
    }
    const preview = document.getElementById('client-config-preview');
    if (preview) {
      preview.value = payload.config;
    }
    openClientModal('result');
    renderClientQR(payload.config);
    if (state.modal.autoDownload) {
      downloadClientConfig();
    }
  }

  function openClientConfig(pubKey) {
    openClientModal('result');
    const preview = document.getElementById('client-config-preview');
    if (preview) preview.value = 'Загрузка...';
    const resultMeta = document.getElementById('client-result-meta');
    if (resultMeta) resultMeta.innerHTML = '';
    makeRequest({
      url: `/api/config/client/${encodeURIComponent(pubKey)}/config`,
      type: 'GET',
      callback: response => {
        const res = responseHandler(response, getPass());
        if (!res.success) {
          renderError(res.data);
          return;
        }
        if (!res.data || !res.data.config || !res.data.client) {
          renderError('Некорректный ответ сервера');
          return;
        }
        state.modal.autoDownload = false;
        openClientResult(res.data);
      }
    });
  }

  function renderClientQR(configText) {
    const qrNode = document.getElementById('client-qr');
    if (!qrNode || typeof QRCode === 'undefined') return;
    qrNode.innerHTML = '';
    // eslint-disable-next-line no-new
    new QRCode(qrNode, {
      text: configText,
      width: 220,
      height: 220,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function downloadClientConfig() {
    if (!state.modal.configText) return;
    const blob = new Blob([state.modal.configText], { type: 'text/plain' });
    download(blob, state.modal.fileName || 'Client.conf');
  }

  function copyClientConfig() {
    if (!state.modal.configText) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(state.modal.configText).then(() => toast({ message: 'Сконфиг скопирован', duration: 2500 }));
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = state.modal.configText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      toast({ message: 'Сконфиг скопирован', duration: 2500 });
    }
  }

  function addNewClient() {
    openClientModal('create');
  }

  function initPassInput() {
    const passInput = document.querySelector('#passkey-input');
    const savedKey = localStorage.getItem('ps');
    if (passInput && savedKey) {
      passInput.value = savedKey;
    }
  }

  function initApp() {
    initPassInput();
    setupClientModal();
    if (settingsForm) {
      settingsForm.addEventListener('submit', handleFrontendSettingsSubmit);
    }
    fetchInterfaces();
    fetchFrontendSettings();
    refreshRuntimeCode();
    setInterval(() => refreshRuntimeCode(), 60000);
  }

  document.addEventListener('DOMContentLoaded', initApp);

  // expose functions for HTML buttons
  window.getStatus = getStatus;
  window.getConfig = getConfig;
  window.addNewClient = addNewClient;
  window.tryReboot = tryReboot;
  window.deleteClient = deleteClient;
  window.savePasskey = savePasskey;
  window.closeClientModal = closeClientModal;
  window.downloadClientConfig = downloadClientConfig;
  window.copyClientConfig = copyClientConfig;
  window.openClientConfig = openClientConfig;
})();
