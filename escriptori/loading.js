// Download progress uses a fixed byte budget, including responses without Content-Length.
// Preparation has its own milestones; 100% is reserved for the first complete frame.
export function createLoadingIndicator(element) {
  const meter = element.querySelector('[role=progressbar]');
  const value = element.querySelector('.loading-value');
  const label = element.querySelector('.loading-label');
  const message = element.querySelector('.loading-message');
  const messages = [
    'Traient la pols de sobre la taula…',
    'Endreçant una mica els papers antics…',
    'Revisant què hem de tornar a la canalla…',
    'Fent lloc entre llibretes i arxivadors…',
    'Buscant aquell bolígraf que sempre desapareix…',
    'Comprovant que la grapadora encara té grapes…',
    'Posant a mà els materials de demà…',
    'Deixant un raconet de taula per a tu…',
    'Rescatant un llapis del fons del calaix…',
    'Allunyant la tassa de les fitxes noves…',
    'Fent veure que la taula està endreçada…',
    'Trobant parella als taps dels retoladors…',
    'Desfent un embús a la perforadora…',
    'Decidint si aquest paper encara pot servir…',
    'Allisant una cantonada una mica tossuda…',
    'Posant cada cosa al seu lloc. Més o menys…',
    'Separant les fitxes de la llista de la compra…',
    'Buscant el principi del rotllo de cinta…',
    'Fent lloc a les idees que encara han de venir…',
    'Comprovant que avui sí que tenim goma…',
  ];
  function shuffle(previous) {
    for (let i = messages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [messages[i], messages[j]] = [messages[j], messages[i]];
    }
    if (messages[0] === previous) [messages[0], messages[1]] = [messages[1], messages[0]];
  }
  shuffle();
  if (message) message.textContent = messages[0];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let messageIndex = 0, swapTimer;
  const changeMessage = () => {
    messageIndex++;
    if (messageIndex === messages.length) {
      shuffle(messages[messageIndex - 1]);
      messageIndex = 0;
    }
    message.textContent = messages[messageIndex];
    message.classList.remove('is-changing');
  };
  const messageTimer = message ? setInterval(() => {
    if (document.hidden) return;
    if (reduced.matches) changeMessage();
    else {
      message.classList.add('is-changing');
      swapTimer = setTimeout(changeMessage, 220);
    }
  }, 5000) : null;
  const stopMessages = () => { clearInterval(messageTimer); clearTimeout(swapTimer); };
  let current = 0;
  function update(percent, text) {
    current = Math.min(100, Math.max(current, Math.floor(percent)));
    value.textContent = current + '%';
    meter.setAttribute('aria-valuenow', String(current));
    meter.setAttribute('aria-valuetext', current + '% · ' + text);
    element.style.setProperty('--loaded', String(current));
    label.textContent = text;
  }
  return {
    update,
    finish() {
      stopMessages();
      update(100, 'L’escriptori és a punt');
      element.classList.add('is-finished');
      setTimeout(() => { element.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
    },
    fail() { stopMessages(); element.hidden = true; },
  };
}

export function createResourceLoader(manifest, base, report) {
  const canonical = value => { const url = new URL(value, base); url.search = ''; url.hash = ''; return url.href; };
  const expected = new Map(Object.entries(manifest.assets).map(([path, size]) => [canonical(path), size]));
  const total = [...expected.values()].reduce((sum, size) => sum + size, 0);
  const received = new Map();
  function progress(url, bytes) {
    const key = canonical(url);
    if (!expected.has(key)) return;
    received.set(key, Math.min(expected.get(key), Math.max(received.get(key) || 0, bytes)));
    report(10 + 80 * [...received.values()].reduce((sum, value) => sum + value, 0) / total, 'Carregant els models i les textures…');
  }
  async function buffer(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('No s’ha pogut carregar ' + new URL(url).pathname);
    const size = expected.get(canonical(url));
    if (!response.body) {
      const data = await response.arrayBuffer(); progress(url, size || data.byteLength); return data;
    }
    const reader = response.body.getReader(), chunks = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); length += value.byteLength; progress(url, length);
    }
    progress(url, size || length);
    const data = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
    return data.buffer;
  }
  return {
    buffer,
    async load(url, decode) {
      const data = await buffer(url);
      const objectURL = URL.createObjectURL(new Blob([data]));
      try { return await decode(objectURL); }
      finally { URL.revokeObjectURL(objectURL); }
    },
  };
}
