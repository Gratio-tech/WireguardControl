var timerId;
var freeIP = '';

const defaultUpdateInterval = 5000;
const ipRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
const validateIPWithSubnet = (input) => ipRegex.test(input);

var runtimeRefreshPromise = null;

function getRuntimeState() {
  return window.__WG_RUNTIME__ || null;
}

function runtimeNeedsRefresh() {
  const runtime = getRuntimeState();
  if (!runtime) return true;
  const ttl = runtime.expiresAt - Date.now();
  const threshold = Math.max(5000, Math.floor(runtime.rotationIntervalMs * 0.2));
  return ttl < threshold;
}

function refreshRuntimeCode(force) {
  if (!force && runtimeRefreshPromise) {
    return runtimeRefreshPromise;
  }
  runtimeRefreshPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `/assets/runtime.js?ts=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = err => {
      script.remove();
      console.error('Unable to refresh runtime code', err);
      reject(err);
    };
    document.head.appendChild(script);
  }).finally(() => {
    runtimeRefreshPromise = null;
  });
  return runtimeRefreshPromise;
}

function ensureRuntimeFresh(callback) {
  if (!runtimeNeedsRefresh()) {
    callback();
    return;
  }
  refreshRuntimeCode(true).finally(callback);
}

function makeRequest(makeRequestArguments) {
  var requestContentType = (typeof(makeRequestArguments.contentType) !== 'undefined') ? makeRequestArguments.contentType : 'application/json';
  var httpRequest = null;

  if (window.XMLHttpRequest) { // Mozilla, Safari, etc...
    httpRequest = new XMLHttpRequest();
  } else if (window.ActiveXObject) { // IE
    try { httpRequest = new ActiveXObject("Msxml2.XMLHTTP"); }
    catch (e) {
      try { httpRequest = new ActiveXObject("Microsoft.XMLHTTP"); }
      catch (e) { console.error(e); }
    }
  }
  if (!httpRequest) {
    console.error('Cannot create an XMLHTTP instance');
    return false;
  }

  if (makeRequestArguments.processHandlers) {
    var incorrectProcessInit =
      (typeof(makeRequestArguments.processHandlers.onprogress) !== 'function') ||
      (typeof(makeRequestArguments.processHandlers.onload) !== 'function') ||
      (typeof(makeRequestArguments.processHandlers.onerror) !== 'function');
    if (incorrectProcessInit) {
      console.log('Incorrect XMLHttpRequest process initialization');
    } else {
      httpRequest.upload.onprogress = makeRequestArguments.processHandlers.onprogress; // (event) => alert(`Отправлено ${event.loaded} из ${event.total} байт`)
      httpRequest.upload.onload = makeRequestArguments.processHandlers.onload;
      httpRequest.upload.onerror = makeRequestArguments.processHandlers.onerror; // () => alert(`Произошла ошибка во время отправки: ${httpRequest.status}`);
    }
  }

  function serveContent(){
    if (httpRequest.readyState === 4) {
      var responseStatus = parseInt(httpRequest.status, 10);
      if (responseStatus < 200 || responseStatus >= 400) {
				// Все штатные (через PHP) ответы сервера, даже с ошибкой, имеют код 200
				// Пробуем распарсить текст ошибки
        toast('Server return error: ' + responseStatus);
				try {
					JSON.parse(httpRequest.responseText);
				} catch (parseErr) {
					console.error('Problem with the request. Request: ', httpRequest);
					console.log('MakeRequest arguments: ', makeRequestArguments);
					return;
				} // Если ошибка распарсилась, можно возвращать в штатный обработчик
      }

			if (typeof(makeRequestArguments.callback) === 'function') {
        var contentType = httpRequest.getResponseHeader('Content-Type');
        if (contentType && contentType.includes('application/json')) {
          makeRequestArguments.callback.call(makeRequestArguments.context, httpRequest.responseText);
        } else {
          makeRequestArguments.callback.call(makeRequestArguments.context, httpRequest);
        }
			} else {
				console.log('Request parse success, there is no callback in params. Received data: ', httpRequest);
			}
    }
  }

  function sendRequest() {
    httpRequest.onreadystatechange = serveContent;
    httpRequest.open(makeRequestArguments.type, makeRequestArguments.url, true);
    var runtime = getRuntimeState();
    if (runtime && runtime.verificationCode) {
      httpRequest.setRequestHeader('X-verification-code', runtime.verificationCode);
    }
    if (makeRequestArguments.token) { httpRequest.setRequestHeader('X-CSRF-TOKEN', makeRequestArguments.token); }
    if (!makeRequestArguments.setContentTypeByBrowser) { httpRequest.setRequestHeader('Content-Type', requestContentType); }
    if (makeRequestArguments.type === 'GET') { httpRequest.send(); }
    else { httpRequest.send(makeRequestArguments.data); }
  }

  ensureRuntimeFresh(sendRequest);
}

function responseHandler(response, passkey) {
  var result = { success: false, data: null };
  var convertedResponse;
  if (typeof(response) === "string") {
		if (!response.length) {
			console.log('Response is empty.');
			return result;
		}
    try {
      convertedResponse = JSON.parse(response);
      if (passkey) {
        if (convertedResponse.hasOwnProperty('v') && convertedResponse.hasOwnProperty('data')) {
          const { data, v: vector } = convertedResponse;
          // Распаковка данных
          const decrypted = JSON.parse(decrypt(unpack(data), passkey, unpack(vector)));
          convertedResponse.data = decrypted;
        } else {
          console.error('Incorrect encrypted response: ', convertedResponse);
        }
      } else if (!convertedResponse.hasOwnProperty('success')) {
        console.error('Response seems incorrect: ', convertedResponse);
      }
    } catch (parseErr) {
      console.log('Error in responseHandler on parsing response: ', parseErr);
      console.log('Response is: ', response);
    }
  } else if (response.hasOwnProperty('success')) {
    console.log('Seems like response is already encoded: ', response);
    convertedResponse = response;
  } else {
    console.log("Unknown type of response: ", response);
  }

  result.success = (typeof(convertedResponse) !== "string") && convertedResponse && !convertedResponse.errors;
  result.data = !result.success ? convertedResponse.errors : convertedResponse.data;
  return result;
}

function objectToHTML(json, level = 0) {
    let html = '';

    if (typeof json === 'object' && json !== null) {
        for (const key in json) {
            if (json.hasOwnProperty(key)) {
              let value = json[key];
              let valueHTML = '';

              if (typeof value === 'object' && value !== null) {
                valueHTML = objectToHTML(value, level + 1);
              } else {
                valueHTML = String(value);
              }
                html += `<div style="margin-left: ${level * 20}px;"><strong>${key}:</strong> ${valueHTML}</div>`;
            }
        }
    } else {
       html += String(json);
    }

    return html;
}

function renderPeerBlocks(peersData = []) {
  let html = '<h3>Peers</h3>';
  peersData.map((peer) => {
    const pubKey = peer['public key'] || peer.PublicKey;
    const jsSafePubKey = pubKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"'); // Экранирование для JS строки

    html += `<div class="peerblock"><div class="peerblock__head"><h4>${peer.name || '[peer.name not setted]'}</h4>`;
    html += `<div class="peerblock__actions"><button class="link-button" onclick="openClientConfig('${jsSafePubKey}')">Конфиг</button>`;
    html += `<button class="delete-button" onclick="deleteClient('${jsSafePubKey}')">Удалить</button></div></div>`;
    html += `<div class="pubkeyblock">${pubKey}</div>`;
    html += '<div>';
    if (peer.PresharedKey) { html += `<b>Preshared Key: </b>${peer.PresharedKey} <br />` };
    if (peer.endpoint) { html += `<b>Peer public IP: </b>${peer.endpoint} <br />` };
    if (peer['allowed ips'] || peer.AllowedIPs) { html += `<b>Allowed IPs: </b>${peer['allowed ips'] || peer.AllowedIPs} <br />` };
    if (peer['latest handshake']) { html += `<b>Last connect: </b>${peer['latest handshake']} <br />` };
    if (peer.transfer) {html += `<b>Traffic: </b>${peer.transfer} <br />` };
    html += '</div></div>';
  });
  return html;
}

function renderInterfaceList(buttonsArray, listBlock) {
  buttonsArray.map(radiobtn => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.setAttribute('type', 'radio');
    input.setAttribute('name', 'interfaces');  // имя группы радиокнопок должно быть одинаковым
    input.setAttribute('checked', radiobtn.checked);
    input.value = radiobtn.value;
    label.appendChild(input);
    label.appendChild(document.createTextNode(radiobtn.value));
    listBlock.appendChild(label);
    listBlock.appendChild(document.createElement('br')); // добавляем перенос строки после каждого элемента
  });
}

function clearErrorAndTimeout() {
  if (timerId) { clearTimeout(timerId); }
  var errorBlock = document.getElementById('error-block');
  var errorCode = document.getElementById('errors-code');
  errorBlock.style.display = 'none';
  errorCode.innerHTML = '';
}

function renderError(err) {
  var errorBlock = document.getElementById('error-block');
  var errorCode = document.getElementById('errors-code');
  errorBlock.style.display = 'block';
  errorCode.innerHTML = (typeof(err) === 'object') ? objectToHTML(err) : `<pre>${err}</pre>`;
}

function download(blob, filename) {
	if (typeof blob == "object") {
		if (window.navigator.msSaveBlob) return window.navigator.msSaveBlob(blob,filename);
		blob = window.URL.createObjectURL(blob);
	}
	var s = document.createElement("a");
	s.href = blob,
	s.download = filename,
	document.body.appendChild(s),
	s.click(),
	setTimeout(function(){
		window.URL.revokeObjectURL(blob);
		document.body.removeChild(s);
		s.remove();
	}, 300);
}

// var blob = new Blob(["111111\n2222222\n333333"], { type: "text/plain" });
// download(blob, "test.txt");
