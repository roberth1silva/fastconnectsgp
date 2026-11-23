// ==UserScript==
// @name         SGP Galeria
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  SGP Galeria - visualizador próprio com zoom suave, pré-carregamento e player de vídeo
// @author       Roberth
// @match        https://fastconnect.sgp.net.br/admin/atendimento/ocorrencia/os/*
// @match        https://fastfibra.sgp.net.br/admin/atendimento/ocorrencia/os/*
// @match        https://sgp.fastconnect.net.br/admin/atendimento/ocorrencia/os/*
// @match        https://sgp.fastfibra.net.br/admin/atendimento/ocorrencia/os/*
// @match        http://45.164.128.5:8000/admin/atendimento/ocorrencia/os/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/sgpgaleria.user.js
// @updateURL    https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/sgpgaleria.user.js
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================
    // CONFIGURAÇÕES
    // =========================================================
    const MAX_PRELOAD = 3;          // arquivos sendo pré-carregados ao mesmo tempo
    const AUTOPLAY_VIDEO = true;    // começa a tocar ao abrir um vídeo na galeria
    const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

    // Versões de qualidade de um vídeo. Retorne uma lista [{ label, url }].
    // Por padrão só existe o arquivo original, então o seletor de qualidade fica oculto.
    // Se o servidor gerar versões, por exemplo:
    //   return [{ label: '1080p', url }, { label: '720p', url: url.replace(/\.mp4$/i, '_720.mp4') }];
    // o seletor aparece sozinho no menu de engrenagem do player.
    function resolveSources(url) {
        return [{ label: 'Original', url }];
    }

    const IMG_EXT = /^(jpe?g|png|gif|webp|bmp|avif|svg)$/;
    const VID_EXT = /^(mp4|webm|mov|m4v|ogv)$/;

    // =========================================================
    // HELPERS
    // =========================================================
    const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const extOf = s => (String(s).split(/[?#]/)[0].split('.').pop() || '').trim().toLowerCase();
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const store = {
        get(k, d) { try { const v = localStorage.getItem('sgpg:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
        set(k, v) { try { localStorage.setItem('sgpg:' + k, JSON.stringify(v)); } catch { /* ignora */ } }
    };

    const svg = (inner, fill) => `<svg viewBox="0 0 24 24" width="22" height="22" ${fill
        ? 'fill="currentColor"'
        : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${inner}</svg>`;
    const ICON = {
        close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
        prev: svg('<path d="M15 5l-7 7 7 7"/>'),
        next: svg('<path d="M9 5l7 7-7 7"/>'),
        zin: svg('<circle cx="11" cy="11" r="6.5"/><path d="M21 21l-5-5M11 8v6M8 11h6"/>'),
        zout: svg('<circle cx="11" cy="11" r="6.5"/><path d="M21 21l-5-5M8 11h6"/>'),
        fit: svg('<path d="M9 4v5H4M15 4v5h5M15 20v-5h5M9 20v-5H4"/>'),
        fs: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
        rotl: svg('<path d="M3 4v5h5"/><path d="M3.5 9A9 9 0 1 1 3 12"/>'),
        dl: svg('<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>'),
        thumbs: svg('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'),
        play: svg('<path d="M8 5v14l11-7z"/>', true),
        pause: svg('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>', true),
        vol: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9a4.5 4.5 0 0 1 0 6"/>'),
        mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
        gear: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>')
    };
    const btn = (a, title, inner) => `<button type="button" class="g-btn" data-a="${a}" title="${title}">${inner}</button>`;

    // =========================================================
    // CSS
    // =========================================================
    const CSS = `
    #sgpg { position: fixed; inset: 0; z-index: 2147483000; background: rgba(10,10,12,.97); color: #eee; font: 14px/1.3 system-ui, sans-serif;
        opacity: 0; visibility: hidden; transition: opacity .2s, visibility .2s; -webkit-tap-highlight-color: transparent; }
    #sgpg.open { opacity: 1; visibility: visible; }
    #sgpg button { font: inherit; color: inherit; }
    #sgpg .g-sp { flex: 1; }
    #sgpg .g-top { position: absolute; top: 0; left: 0; right: 0; height: 52px; display: flex; align-items: center; gap: 4px; padding: 0 10px; z-index: 3;
        background: linear-gradient(rgba(0,0,0,.6), transparent); }
    #sgpg .g-count { font-weight: 700; margin: 0 10px 0 4px; white-space: nowrap; }
    #sgpg .g-name { opacity: .75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    #sgpg .g-tools { display: flex; align-items: center; gap: 2px; margin-right: 8px; }
    #sgpg .g-zoom { min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; opacity: .85; }
    #sgpg .g-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; height: 40px; padding: 0 6px; border: 0; border-radius: 8px;
        background: transparent; cursor: pointer; color: #eee; text-decoration: none; transition: background .15s; }
    #sgpg .g-btn:hover { background: rgba(255,255,255,.14); }
    #sgpg .g-txt { font-weight: 700; font-size: 13px; }
    #sgpg .g-flip { display: inline-flex; transform: scaleX(-1); }
    #sgpg.is-video .g-img-only { display: none; }

    #sgpg .g-stage { position: absolute; top: 52px; bottom: 100px; left: 0; right: 0; overflow: hidden; touch-action: none; }
    #sgpg.no-strip .g-stage { bottom: 0; }
    #sgpg .g-slide { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; animation: g-fade .22s ease-out; }
    #sgpg .g-slide.from-r { animation-name: g-in-r; }
    #sgpg .g-slide.from-l { animation-name: g-in-l; }
    @keyframes g-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes g-in-r { from { opacity: 0; transform: translateX(48px); } to { opacity: 1; transform: none; } }
    @keyframes g-in-l { from { opacity: 0; transform: translateX(-48px); } to { opacity: 1; transform: none; } }
    @keyframes g-rot { to { transform: rotate(360deg); } }
    #sgpg .g-img { display: block; flex: none; user-select: none; -webkit-user-drag: none; touch-action: none; will-change: transform;
        transition: transform .2s cubic-bezier(.2,.7,.3,1); }
    #sgpg .g-stage.dragging .g-img { cursor: grabbing !important; }
    #sgpg .g-spin, #sgpg .vp-spin { position: absolute; width: 52px; height: 52px; border: 4px solid rgba(255,255,255,.2); border-top-color: #f57c00;
        border-radius: 50%; animation: g-rot .8s linear infinite; pointer-events: none; }
    #sgpg .g-err, #sgpg .vp-msg { position: absolute; padding: 12px 18px; border-radius: 8px; background: rgba(0,0,0,.6); color: #ffab91; text-align: center; }
    #sgpg .vp-cache { position: absolute; inset: 0; z-index: 2; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
        background: rgba(0,0,0,.28); pointer-events: none; }
    #sgpg .vp.caching .vp-cache { display: flex; }
    #sgpg .vp.caching .vp-big { display: none; }
    #sgpg .vp-cache-text { padding: 8px 14px; border-radius: 6px; background: rgba(0,0,0,.7); font-size: 13px; }
    #sgpg .vp-cache-bar { width: min(320px, 70%); height: 6px; border-radius: 3px; background: rgba(255,255,255,.25); overflow: hidden; }
    #sgpg .vp-cache-bar i { display: block; width: 0; height: 100%; background: #f57c00; transition: width .15s; }

    #sgpg .g-nav { position: absolute; top: 50%; margin-top: -26px; width: 52px; height: 52px; border: 0; border-radius: 50%; z-index: 3; cursor: pointer;
        background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; transition: background .15s; }
    #sgpg .g-nav:hover { background: rgba(0,0,0,.65); }
    #sgpg .g-prev { left: 12px; } #sgpg .g-next { right: 12px; }
    #sgpg.single .g-nav, #sgpg.single [data-a=thumbs] { display: none; }

    #sgpg .g-strip { position: absolute; left: 0; right: 0; bottom: 0; height: 100px; display: flex; align-items: center; gap: 8px; padding: 0 12px;
        overflow-x: auto; overflow-y: hidden; position: absolute; background: rgba(0,0,0,.35); scrollbar-width: thin; }
    #sgpg.no-strip .g-strip { display: none; }
    #sgpg .g-th { position: relative; flex: none; width: 104px; height: 72px; padding: 0; border: 2px solid transparent; border-radius: 6px; overflow: hidden;
        background: #1c1c1f; cursor: pointer; opacity: .6; transition: opacity .15s, border-color .15s, transform .15s; }
    #sgpg .g-th:hover { opacity: .9; }
    #sgpg .g-th.on { opacity: 1; border-color: #f57c00; transform: translateY(-2px); }
    #sgpg .g-th img { width: 100%; height: 100%; object-fit: cover; display: block; }
    #sgpg .g-play { position: absolute; right: 4px; bottom: 4px; padding: 1px 5px; border-radius: 4px; background: rgba(0,0,0,.7); font-size: 11px; }

    /* ---------- player de vídeo ---------- */
    #sgpg .vp { position: relative; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; user-select: none; }
    #sgpg .vp-video { width: 100%; height: 100%; object-fit: contain; background: #000; }
    #sgpg .vp-spin { display: none; }
    #sgpg .vp.loading .vp-spin { display: block; }
    #sgpg .vp-msg { display: none; }
    #sgpg .vp.err .vp-msg { display: block; }
    #sgpg .vp-big { position: absolute; width: 76px; height: 76px; border: 0; border-radius: 50%; background: rgba(0,0,0,.55); cursor: pointer;
        display: none; align-items: center; justify-content: center; transition: transform .15s, background .15s; }
    #sgpg .vp-big svg { width: 36px; height: 36px; }
    #sgpg .vp-big:hover { background: #f57c00; transform: scale(1.06); }
    #sgpg .vp.paused:not(.loading):not(.err) .vp-big { display: flex; }
    #sgpg .vp-ctl { position: absolute; left: 0; right: 0; bottom: 0; padding: 30px 12px 8px; transition: opacity .2s;
        background: linear-gradient(transparent, rgba(0,0,0,.8)); }
    #sgpg .vp.idle { cursor: none; }
    #sgpg .vp.idle .vp-ctl { opacity: 0; pointer-events: none; }
    #sgpg .vp-bar { position: relative; height: 5px; margin: 0 4px 8px; border-radius: 3px; background: rgba(255,255,255,.25); cursor: pointer; touch-action: none; transition: height .1s; }
    #sgpg .vp-bar::before { content: ''; position: absolute; left: 0; right: 0; top: -9px; bottom: -9px; }
    #sgpg .vp-bar:hover, #sgpg .vp.scrubbing .vp-bar { height: 8px; }
    #sgpg .vp-buf { position: absolute; inset: 0; border-radius: 3px; overflow: hidden; }
    #sgpg .vp-buf i { position: absolute; top: 0; bottom: 0; background: rgba(255,255,255,.4); }
    #sgpg .vp-played { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 3px; background: #f57c00; }
    #sgpg .vp-knob { position: absolute; top: 50%; left: 0; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: #f57c00;
        transform: scale(0); transition: transform .1s; }
    #sgpg .vp-bar:hover .vp-knob, #sgpg .vp.scrubbing .vp-knob { transform: scale(1); }
    #sgpg .vp-tip { position: absolute; bottom: 18px; left: 0; transform: translateX(-50%); padding: 2px 7px; border-radius: 4px; background: rgba(0,0,0,.85);
        font-size: 12px; opacity: 0; pointer-events: none; }
    #sgpg .vp-bar:hover .vp-tip { opacity: 1; }
    #sgpg .vp-row { display: flex; align-items: center; gap: 2px; }
    #sgpg .vp-b { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; }
    #sgpg .vp-b:hover { background: rgba(255,255,255,.15); }
    #sgpg .vp-vol { position: relative; flex: none; width: 84px; height: 30px; margin: 0 8px 0 2px; cursor: pointer; touch-action: none; }
    #sgpg .vp-vol-track { position: absolute; left: 6px; right: 6px; top: 50%; height: 5px; margin-top: -2.5px; border-radius: 3px; background: rgba(255,255,255,.25); }
    #sgpg .vp-vol-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; border-radius: 3px; background: #f57c00; }
    #sgpg .vp-vol-knob { position: absolute; top: 50%; left: 100%; width: 12px; height: 12px; margin: -6px 0 0 -6px;
        border-radius: 50%; background: #f57c00; pointer-events: none; }
    #sgpg .vp-time { margin-left: 6px; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    #sgpg .vp-menu { display: none; position: absolute; right: 12px; bottom: 56px; min-width: 160px; padding: 6px; border-radius: 8px; background: rgba(28,28,30,.97);
        box-shadow: 0 8px 24px rgba(0,0,0,.5); }
    #sgpg .vp-menu.open { display: block; }
    #sgpg .vp-mh { padding: 6px 10px 3px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; opacity: .55; }
    #sgpg .vp-menu button { display: block; width: 100%; padding: 7px 10px; border: 0; border-radius: 5px; background: transparent; text-align: left; cursor: pointer; }
    #sgpg .vp-menu button:hover { background: rgba(255,255,255,.12); }
    #sgpg .vp-menu button.on { color: #ffb74d; }
    #sgpg .vp-menu button.on::after { content: ' ✓'; }

    @media (max-width: 640px) {
        #sgpg .g-stage { bottom: 76px; } #sgpg.no-strip .g-stage { bottom: 0; }
        #sgpg .g-strip { height: 76px; } #sgpg .g-th { width: 72px; height: 54px; }
        #sgpg .g-name, #sgpg .vp-vol { display: none; }
        #sgpg .g-nav { width: 42px; height: 42px; margin-top: -21px; }
    }`;

    // =========================================================
    // COLETA DOS ANEXOS (mesma lógica de antes: seção "Anexos")
    // =========================================================
    function collect() {
        const links = [];
        document.querySelectorAll('span').forEach(s => {
            if (!s.textContent.includes('Anexos')) return;
            s.parentElement?.nextElementSibling?.querySelectorAll('a').forEach(a => { if (!links.includes(a)) links.push(a); });
        });
        links.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        return links;
    }

    function init() {
        const links = collect();
        if (!links.length) return;

        const savedQ = store.get('quality', null);
        const items = [];
        links.forEach(a => {
            const href = a.getAttribute('href');
            if (!href) return;
            const name = a.textContent.trim() || href;
            const ext = [extOf(name), extOf(href)].find(e => IMG_EXT.test(e) || VID_EXT.test(e));
            const url = new URL(href, location.href).href;
            if (!ext || items.some(i => i.url === url)) return; // ignora PDFs etc. e duplicados
            const item = { i: items.length, type: VID_EXT.test(ext) ? 'video' : 'image', url, name };
            if (item.type === 'video') {
                item.sources = resolveSources(url);
                item.srcIndex = Math.max(0, item.sources.findIndex(s => s.label === savedQ));
            }
            items.push(item);
        });
        if (!items.length) return;

        const style = el('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        // Botão: mesmo lugar e mesmo visual de antes
        const openBtn = el('a', 'button blue');
        openBtn.id = 'opengallery';
        openBtn.textContent = ' Abrir Galeria ';
        (links[0].parentElement?.parentElement?.parentElement || links[0].parentElement).prepend(openBtn);

        // =====================================================
        // PRÉ-CARREGAMENTO
        // =====================================================
        let built = false;
        const strip = el('div', 'g-strip');

        function makeThumb(source, w, h) {
            if (!w || !h) return null;
            try {
                const W = 160, H = 120, c = el('canvas');
                c.width = W; c.height = H;
                const s = Math.max(W / w, H / h);
                c.getContext('2d').drawImage(source, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s);
                return c.toDataURL('image/jpeg', 0.7);
            } catch { return null; } // canvas "tainted" (arquivo de outra origem)
        }

        function updateThumb(item) {
            if (!built || !item.thumb) return;
            const b = strip.querySelector(`[data-i="${item.i}"]`);
            if (b && !b.querySelector('img')) b.insertAdjacentHTML('afterbegin', `<img src="${item.thumb}" alt="">`);
        }

        function loadImage(item) {
            if (item.promise) return item.promise;
            item.promise = new Promise(resolve => {
                const img = new Image();
                img.decoding = 'async';
                img.onload = () => {
                    Promise.resolve(img.decode?.()).catch(() => {}).then(() => {
                        item.thumb = makeThumb(img, img.naturalWidth, img.naturalHeight);
                        updateThumb(item);
                        resolve();
                    });
                };
                img.onerror = () => { item.error = true; resolve(); };
                img.src = item.url;
                item.img = img;
            });
            return item.promise;
        }

        function loadVideo(item) {
            if (item.promise) return item.promise;
            item.promise = new Promise(resolve => {
                const v = el('video');
                v.preload = 'metadata';
                v.playsInline = true;
                v.src = item.sources[item.srcIndex].url + '#t=0.1';
                v.addEventListener('loadeddata', () => {
                    item.thumb = makeThumb(v, v.videoWidth, v.videoHeight);
                    updateThumb(item);
                    resolve();
                }, { once: true });
                v.addEventListener('error', () => { item.error = true; resolve(); }, { once: true });
                setTimeout(resolve, 8000); // nunca prende a fila
                item.video = v;
            });
            return item.promise;
        }

        // Baixa o vídeo inteiro para um Blob. Com o arquivo em memória o navegador
        // consegue buscar qualquer ponto, mesmo quando o servidor não aceita Range.
        function getVideoCache(item) {
            if (item.cache) return item.cache;
            const c = item.cache = { promise: null, url: null, blob: null, progress: 0 };
            c.promise = (async () => {
                try {
                    const res = await fetch(item.sources[item.srcIndex].url, { credentials: 'same-origin' });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const type = res.headers.get('Content-Type') || '';
                    if (/^text\/html/i.test(type)) throw new Error('resposta HTML (login?)');
                    const ext = extOf(item.sources[item.srcIndex].url);
                    const mime = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg' }[ext] || 'video/mp4';
                    const blobType = /^video\//i.test(type) ? type : mime;
                    const total = Number(res.headers.get('Content-Length')) || 0;
                    let blob;

                    if (!res.body || !total) {
                        blob = new Blob([await res.blob()], { type: blobType });
                        c.progress = 1;
                        item.onCacheProgress?.(1);
                    } else {
                        const reader = res.body.getReader();
                        const chunks = [];
                        let received = 0;
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(value);
                            received += value.length;
                            c.progress = Math.min(1, received / total);
                            item.onCacheProgress?.(c.progress);
                        }
                        blob = new Blob(chunks, { type: blobType });
                    }

                    c.blob = blob;
                    c.url = URL.createObjectURL(blob);
                    c.progress = 1;
                    item.onCacheProgress?.(1);
                    return c.url;
                } catch (err) {
                    console.warn('[Galeria] Não foi possível cachear o vídeo; usando streaming direto.', err);
                    item.cache = null;
                    return null;
                }
            })();
            return c;
        }

        const load = item => (item.type === 'video' ? loadVideo(item) : loadImage(item));
        const pending = items.map(i => i.i);
        let running = 0;

        function pump() {
            while (running < MAX_PRELOAD && pending.length) {
                const item = items[pending.shift()];
                if (item.promise) continue;
                running++;
                load(item).finally(() => { running--; pump(); });
            }
        }
        function prioritize(i) {
            const p = pending.indexOf(i);
            if (p > 0) { pending.splice(p, 1); pending.unshift(i); }
            pump();
        }
        function warm(i) { // vizinhos: já carrega a miniatura/metadados
            const it = items[i];
            if (!it) return;
            if (it.type === 'video') loadVideo(it); else prioritize(i);
        }

        if (items[0].type === 'video') loadVideo(items[0]);
        (window.requestIdleCallback || (f => setTimeout(f, 300)))(pump);

        // =====================================================
        // VISUALIZADOR
        // =====================================================
        let root, stage, elCount, elName, elDl, elZoom;
        let cur = -1, isOpen = false, token = 0, player = null;
        let view = { s: 1, tx: 0, ty: 0, rot: 0, img: null };

        function build() {
            built = true;
            root = el('div');
            root.id = 'sgpg';
            if (items.length < 2) root.classList.add('single');
            root.innerHTML = `
                <div class="g-top">
                    <span class="g-count"></span><span class="g-name"></span><span class="g-sp"></span>
                    <span class="g-tools g-img-only">
                        ${btn('zout', 'Diminuir (-)', ICON.zout)}<span class="g-zoom">100%</span>${btn('zin', 'Ampliar (+)', ICON.zin)}
                        ${btn('actual', 'Tamanho real (1)', '<span class="g-txt">1:1</span>')}
                        ${btn('fit', 'Ajustar à tela (0)', ICON.fit)}
                        ${btn('rotl', 'Girar à esquerda', ICON.rotl)}
                        ${btn('rotr', 'Girar à direita (R)', `<span class="g-flip">${ICON.rotl}</span>`)}
                    </span>
                    <a class="g-btn" data-a="dl" download title="Baixar" href="#">${ICON.dl}</a>
                    ${btn('thumbs', 'Miniaturas', ICON.thumbs)}${btn('fs', 'Tela cheia', ICON.fs)}${btn('close', 'Fechar (Esc)', ICON.close)}
                </div>
                <div class="g-stage"></div>
                <button type="button" class="g-nav g-prev" data-a="prev" title="Anterior (← / A / PgUp)">${ICON.prev}</button>
                <button type="button" class="g-nav g-next" data-a="next" title="Próximo (→ / D / PgDn)">${ICON.next}</button>`;
            strip.innerHTML = items.map(it =>
                `<button type="button" class="g-th" data-i="${it.i}" title="${esc(it.name)}">${it.thumb ? `<img src="${it.thumb}" alt="">` : ''}${it.type === 'video' ? '<span class="g-play">▶</span>' : ''}</button>`).join('');
            root.appendChild(strip);
            document.body.appendChild(root);

            stage = root.querySelector('.g-stage');
            elCount = root.querySelector('.g-count');
            elName = root.querySelector('.g-name');
            elDl = root.querySelector('[data-a=dl]');
            elZoom = root.querySelector('.g-zoom');

            root.addEventListener('click', onRootClick);
            bindStage();
        }

        // ---------- navegação ----------
        function go(d) { show((cur + d + items.length) % items.length, d); }

        function teardown() {
            token++;
            player?.destroy();
            player = null;
            ptrs.clear();
            down = null;
            view = { s: 1, tx: 0, ty: 0, rot: 0, img: null };
            stage.innerHTML = '';
        }

        function show(i, dir = 0) {
            if (i < 0 || i >= items.length) return;
            teardown();
            cur = i;
            const item = items[i];
            root.classList.toggle('is-video', item.type === 'video');
            elCount.textContent = `${i + 1} / ${items.length}`;
            elName.textContent = item.name;
            elDl.href = item.url;
            elDl.setAttribute('download', item.name);
            elZoom.textContent = '100%';

            const holder = el('div', 'g-slide' + (dir > 0 ? ' from-r' : dir < 0 ? ' from-l' : ''));
            stage.appendChild(holder);
            if (item.type === 'video') showVideo(item, holder); else showImage(item, holder);

            strip.querySelectorAll('.g-th').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
            const b = strip.querySelector(`[data-i="${i}"]`);
            if (b) strip.scrollTo({ left: b.offsetLeft - strip.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' });

            warm(i); warm(i + 1); warm(i - 1);
        }

        // ---------- imagem: zoom, arraste, rotação ----------
        const stageSize = () => [stage.clientWidth, stage.clientHeight];

        function showImage(item, holder) {
            const gen = token;
            const spin = el('div', 'g-spin');
            holder.appendChild(spin);
            loadImage(item).then(() => {
                if (gen !== token) return;
                spin.remove();
                if (item.error) { holder.insertAdjacentHTML('beforeend', '<div class="g-err">Não foi possível carregar a imagem.</div>'); return; }
                const img = item.img;
                img.className = 'g-img';
                img.draggable = false;
                img.alt = item.name;
                img.style.cssText = '';
                holder.appendChild(img);
                view.img = img;
                layoutImg();
                applyView(false);
            });
        }

        // A caixa da imagem sempre cabe na área; na rotação de 90° uma escala-base compensa a troca de eixos
        function layoutImg() {
            if (!view.img) return;
            const [sw, sh] = stageSize();
            view.img.style.maxWidth = sw + 'px';
            view.img.style.maxHeight = sh + 'px';
        }
        function baseScale() {
            const img = view.img;
            if (!img || view.rot % 180 === 0) return 1;
            const [sw, sh] = stageSize();
            return Math.min(1, sw / img.offsetHeight, sh / img.offsetWidth);
        }
        function clampPan() {
            const img = view.img;
            if (!img) return;
            const E = view.s * baseScale();
            const swap = view.rot % 180 !== 0;
            const w = (swap ? img.offsetHeight : img.offsetWidth) * E;
            const h = (swap ? img.offsetWidth : img.offsetHeight) * E;
            const [sw, sh] = stageSize();
            const mx = Math.max(0, (w - sw) / 2), my = Math.max(0, (h - sh) / 2);
            view.tx = clamp(view.tx, -mx, mx);
            view.ty = clamp(view.ty, -my, my);
        }
        function applyView(animate = true) {
            const img = view.img;
            if (!img) return;
            const E = view.s * baseScale();
            img.style.transition = animate ? '' : 'none';
            img.style.transform = `translate(${view.tx}px, ${view.ty}px) rotate(${view.rot}deg) scale(${E})`;
            img.style.cursor = view.s > 1 ? 'grab' : 'default';
            elZoom.textContent = Math.round(E * img.offsetWidth / (img.naturalWidth || img.offsetWidth) * 100) + '%';
        }
        function zoomTo(newS, px, py, animate = true) {
            const img = view.img;
            if (!img) return;
            const [sw, sh] = stageSize();
            const maxS = Math.max(4, 3 * img.naturalWidth / Math.max(1, img.offsetWidth));
            newS = clamp(newS, 1, maxS);
            const cx = (px ?? sw / 2) - sw / 2, cy = (py ?? sh / 2) - sh / 2; // ponto fixo, relativo ao centro
            const r = newS / view.s;
            view.tx = cx - (cx - view.tx) * r;
            view.ty = cy - (cy - view.ty) * r;
            view.s = newS;
            clampPan();
            applyView(animate);
        }
        function resetView() { view.s = 1; view.tx = 0; view.ty = 0; applyView(); }
        function rotate(d) {
            if (!view.img) return;
            view.rot += d;
            view.s = 1; view.tx = 0; view.ty = 0;
            applyView();
        }
        function actualSize() {
            const img = view.img;
            if (!img) return;
            zoomTo(img.naturalWidth / img.offsetWidth / baseScale());
        }

        // ponteiro: arrastar, pinça, toque duplo, deslizar para trocar
        const ptrs = new Map();
        let down = null, tap = { t: 0, x: 0, y: 0 };

        function bindStage() {
            const rectXY = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

            stage.addEventListener('wheel', e => {
                if (!view.img) return;
                e.preventDefault();
                const [x, y] = rectXY(e);
                zoomTo(view.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), x, y);
            }, { passive: false });

            stage.addEventListener('pointerdown', e => {
                if (!view.img || e.button > 0) return;
                stage.setPointerCapture(e.pointerId);
                ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
                down = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, id: e.pointerId } : null;
                if (view.s > 1) stage.classList.add('dragging');
            });

            stage.addEventListener('pointermove', e => {
                const p = ptrs.get(e.pointerId);
                if (!p || !view.img) return;
                if (ptrs.size === 2) { // pinça
                    const [a0, b0] = [...ptrs.values()].map(q => ({ ...q }));
                    p.x = e.clientX; p.y = e.clientY;
                    const [a1, b1] = [...ptrs.values()];
                    const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y), d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
                    const r = stage.getBoundingClientRect();
                    const c0x = (a0.x + b0.x) / 2, c0y = (a0.y + b0.y) / 2, c1x = (a1.x + b1.x) / 2, c1y = (a1.y + b1.y) / 2;
                    if (d0 > 0) zoomTo(view.s * d1 / d0, c0x - r.left, c0y - r.top, false);
                    view.tx += c1x - c0x; view.ty += c1y - c0y;
                    clampPan(); applyView(false);
                    return;
                }
                const dx = e.clientX - p.x, dy = e.clientY - p.y;
                p.x = e.clientX; p.y = e.clientY;
                if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
                if (view.s > 1) { view.tx += dx; view.ty += dy; clampPan(); applyView(false); }
            });

            const end = e => {
                if (!ptrs.has(e.pointerId)) return;
                ptrs.delete(e.pointerId);
                stage.classList.remove('dragging');
                if (view.img && down && down.id === e.pointerId && e.type === 'pointerup') {
                    const dx = e.clientX - down.x, dy = e.clientY - down.y, now = performance.now();
                    if (!down.moved && now - down.t < 350) { // toque/clique curto
                        if (now - tap.t < 320 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) {
                            tap.t = 0;
                            const [x, y] = rectXY(e);
                            zoomTo(view.s > 1.05 ? 1 : 2.5, x, y);
                        } else tap = { t: now, x: e.clientX, y: e.clientY };
                    } else if (e.pointerType !== 'mouse' && view.s <= 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                        go(dx < 0 ? 1 : -1); // deslizar no celular
                    }
                }
                down = null;
            };
            stage.addEventListener('pointerup', end);
            stage.addEventListener('pointercancel', end);
        }

        // ---------- vídeo ----------
        function showVideo(item, holder) {
            loadVideo(item);
            if (item.error && !item.video.src) {
                holder.insertAdjacentHTML('beforeend', '<div class="g-err">Não foi possível carregar o vídeo.</div>');
                return;
            }
            player = buildPlayer(item, holder);
            player.load();
        }

        function buildPlayer(item, host) {
            const v = el('video');
            const offs = [];
            const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); offs.push(() => t.removeEventListener(type, fn, o)); };
            let scrub = null, raf = 0, idleT = 0, volDrag = false, destroyed = false;

            const vp = el('div', 'vp paused');
            vp.innerHTML = `
                <div class="vp-spin"></div>
                <div class="vp-msg"></div>
                <button type="button" class="vp-big" aria-label="Reproduzir">${ICON.play}</button>
                <div class="vp-cache">
                    <div class="vp-cache-text">Preparando vídeo...</div>
                    <div class="vp-cache-bar"><i></i></div>
                </div>
                <div class="vp-ctl">
                    <div class="vp-bar"><div class="vp-buf"></div><div class="vp-played"></div><div class="vp-knob"></div><div class="vp-tip">0:00</div></div>
                    <div class="vp-row">
                        <button type="button" class="vp-b" data-p="play" title="Reproduzir/Pausar (espaço)"></button>
                        <button type="button" class="vp-b" data-p="mute" title="Mudo (m)"></button>
                        <div class="vp-vol" role="slider" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" title="Volume: 100%">
                            <div class="vp-vol-track"><div class="vp-vol-fill"></div><div class="vp-vol-knob"></div></div>
                        </div>
                        <span class="vp-time">0:00 / 0:00</span><span class="g-sp"></span>
                        <button type="button" class="vp-b" data-p="settings" title="Velocidade e qualidade">${ICON.gear}</button>
                        <button type="button" class="vp-b" data-p="fs" title="Tela cheia (f)">${ICON.fs}</button>
                    </div>
                    <div class="vp-menu"></div>
                </div>`;
            vp.prepend(v);
            host.appendChild(vp);

            v.className = 'vp-video';
            v.controls = false;
            v.preload = 'auto';
            v.volume = store.get('vol', 1);
            v.muted = store.get('muted', false);

            const q = s => vp.querySelector(s);
            const bar = q('.vp-bar'), played = q('.vp-played'), knob = q('.vp-knob'), tip = q('.vp-tip'), buf = q('.vp-buf');
            const time = q('.vp-time'), vol = q('.vp-vol'), menu = q('.vp-menu');
            const volFill = q('.vp-vol-fill');
            const volKnob = q('.vp-vol-knob');
            const playBtn = q('[data-p=play]'), muteBtn = q('[data-p=mute]');

            const fmt = t => {
                if (!isFinite(t)) return '0:00';
                t = Math.floor(t);
                const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
                return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
            };

            function renderProgress() {
                const d = v.duration, t = scrub ?? v.currentTime;
                time.textContent = `${fmt(t)} / ${fmt(d)}`;
                if (!isFinite(d) || !d) return;
                const pct = t / d * 100;
                played.style.width = pct + '%';
                knob.style.left = pct + '%';
            }
            function renderBuffer() {
                const d = v.duration;
                if (!isFinite(d) || !d) return;
                let html = '';
                for (let i = 0; i < v.buffered.length; i++) {
                    const a = v.buffered.start(i) / d * 100, b = v.buffered.end(i) / d * 100;
                    html += `<i style="left:${a}%;width:${b - a}%"></i>`;
                }
                buf.innerHTML = html;
            }
            function renderState() {
                playBtn.innerHTML = v.paused ? ICON.play : ICON.pause;
                vp.classList.toggle('paused', v.paused);
                if (!v.paused) { cancelAnimationFrame(raf); raf = requestAnimationFrame(function tick() { renderProgress(); raf = requestAnimationFrame(tick); }); }
                else cancelAnimationFrame(raf);
                renderProgress();
                wake();
            }
            function renderVol() {
                const pct = (v.muted ? 0 : v.volume) * 100;
                muteBtn.innerHTML = v.muted || v.volume === 0 ? ICON.mute : ICON.vol;
                volFill.style.width = pct + '%';
                volKnob.style.left = pct + '%';
                vol.setAttribute('aria-valuenow', String(Math.round(pct)));
                vol.title = `Volume: ${Math.round(pct)}%`;
            }

            // controles somem após alguns segundos tocando
            const menuOpen = () => menu.classList.contains('open');
            function wake() {
                vp.classList.remove('idle');
                clearTimeout(idleT);
                if (!v.paused && !menuOpen()) idleT = setTimeout(() => vp.classList.add('idle'), 2500);
            }

            const toggle = () => {
                if (v.ended) v.currentTime = 0;
                if (v.paused) v.play().catch(() => {}); else v.pause();
            };
            const seek = s => { v.currentTime = clamp(v.currentTime + s, 0, v.duration || 0); };
            const toggleMute = () => { if (v.muted || v.volume === 0) { v.muted = false; if (v.volume === 0) v.volume = 0.5; } else v.muted = true; };
            const fullscreen = () => { if (document.fullscreenElement === vp) document.exitFullscreen(); else vp.requestFullscreen?.(); };

            // menu de velocidade/qualidade
            function renderMenu() {
                let html = '<div class="vp-mh">Velocidade</div>' + SPEEDS.map(r =>
                    `<button type="button" data-rate="${r}" class="${v.playbackRate === r ? 'on' : ''}">${r === 1 ? 'Normal' : r + '×'}</button>`).join('');
                if (item.sources.length > 1) {
                    html += '<div class="vp-mh">Qualidade</div>' + item.sources.map((s, i) =>
                        `<button type="button" data-q="${i}" class="${i === item.srcIndex ? 'on' : ''}">${esc(s.label)}</button>`).join('');
                }
                menu.innerHTML = html;
            }
            function setQuality(i) {
                if (i === item.srcIndex) return;
                const t = v.currentTime, wasPlaying = !v.paused, rate = v.playbackRate;
                item.srcIndex = i;
                item.cache = null; // arquivo diferente: novo cache
                store.set('quality', item.sources[i].label);
                item.onCacheProgress = cacheProgressUI();
                getVideoCache(item).promise.then(url => {
                    item.onCacheProgress = null;
                    if (destroyed) return;
                    vp.classList.remove('caching');
                    v.src = url || item.sources[i].url;
                    v.addEventListener('loadedmetadata', () => {
                        if (destroyed) return;
                        v.currentTime = t;
                        v.playbackRate = rate;
                        if (wasPlaying) v.play().catch(() => {});
                    }, { once: true });
                    v.load();
                });
            }

            // eventos do <video>
            on(v, 'timeupdate', renderProgress);
            on(v, 'progress', renderBuffer);
            on(v, 'loadedmetadata', () => { renderProgress(); renderBuffer(); });
            on(v, 'durationchange', () => { renderProgress(); renderBuffer(); });
            ['play', 'pause', 'ended'].forEach(t => on(v, t, renderState));
            on(v, 'waiting', () => vp.classList.add('loading'));
            on(v, 'seeking', () => vp.classList.add('loading'));
            ['playing', 'canplay', 'seeked'].forEach(t => on(v, t, () => vp.classList.remove('loading')));
            on(v, 'volumechange', () => { renderVol(); store.set('vol', v.volume); store.set('muted', v.muted); });
            on(v, 'error', () => {
                vp.classList.remove('loading');
                vp.classList.add('err');
                q('.vp-msg').textContent = 'Não foi possível reproduzir este vídeo (formato ou conexão).';
            });
            on(v, 'click', () => { if (menuOpen()) menu.classList.remove('open'); else toggle(); });
            on(v, 'dblclick', fullscreen);

            // controles
            on(q('.vp-big'), 'click', toggle);
            on(playBtn, 'click', toggle);
            on(muteBtn, 'click', toggleMute);
            const setVolFrom = e => {
                const r = vol.getBoundingClientRect();
                const pct = clamp((e.clientX - r.left - 6) / Math.max(1, r.width - 12), 0, 1);
                v.muted = false;
                v.volume = pct;
            };
            on(vol, 'pointerdown', e => {
                volDrag = true;
                vol.setPointerCapture(e.pointerId);
                setVolFrom(e);
                e.preventDefault();
            });
            on(vol, 'pointermove', e => { if (volDrag) setVolFrom(e); });
            on(vol, 'pointerup', () => { volDrag = false; });
            on(vol, 'pointercancel', () => { volDrag = false; });
            on(q('[data-p=fs]'), 'click', fullscreen);
            on(q('[data-p=settings]'), 'click', () => { renderMenu(); menu.classList.toggle('open'); wake(); });
            on(menu, 'click', e => {
                const b = e.target.closest('button');
                if (!b) return;
                if (b.dataset.rate) v.playbackRate = +b.dataset.rate;
                if (b.dataset.q) setQuality(+b.dataset.q);
                menu.classList.remove('open');
                wake();
            });

            // barra de progresso: clique, arraste e dica de tempo
            const posToTime = e => {
                const r = bar.getBoundingClientRect();
                return clamp((e.clientX - r.left) / r.width, 0, 1) * (v.duration || 0);
            };
            on(bar, 'pointerdown', e => {
                if (!v.duration) return;
                bar.setPointerCapture(e.pointerId);
                scrub = posToTime(e);
                vp.classList.add('scrubbing');
                renderProgress();
            });
            on(bar, 'pointermove', e => {
                const r = bar.getBoundingClientRect(), t = posToTime(e);
                tip.textContent = fmt(t);
                tip.style.left = clamp(e.clientX - r.left, 0, r.width) + 'px';
                if (scrub !== null) { scrub = t; renderProgress(); }
            });
            const endScrub = commit => e => {
                if (scrub === null) return;
                if (commit) v.currentTime = scrub;
                scrub = null;
                vp.classList.remove('scrubbing');
                renderProgress();
            };
            on(bar, 'pointerup', endScrub(true));
            on(bar, 'pointercancel', endScrub(false));

            on(vp, 'pointermove', wake);
            on(vp, 'pointerdown', wake);

            renderProgress(); renderBuffer(); renderState(); renderVol();
            if (v.readyState < 2 && !v.paused) vp.classList.add('loading');

            function cacheProgressUI() {
                const cacheText = q('.vp-cache-text');
                const cacheBar = q('.vp-cache-bar i');
                vp.classList.add('caching');
                cacheBar.style.width = '0%';
                return p => {
                    if (destroyed) return;
                    const pct = Math.round(clamp(p, 0, 1) * 100);
                    cacheText.textContent = `Preparando vídeo... ${pct}%`;
                    cacheBar.style.width = pct + '%';
                };
            }

            async function load() {
                item.onCacheProgress = cacheProgressUI();
                const url = await getVideoCache(item).promise;
                if (destroyed) return;
                item.onCacheProgress = null;
                vp.classList.remove('caching');
                v.src = url || item.sources[item.srcIndex].url;
                v.load();
                const start = () => {
                    if (destroyed) return;
                    if (AUTOPLAY_VIDEO) v.play().catch(() => {});
                };
                if (v.readyState >= 1) start();
                else v.addEventListener('loadedmetadata', start, { once: true });
            }

            return {
                load,
                play: () => v.play().catch(() => {}),
                closeMenu: () => { const o = menuOpen(); menu.classList.remove('open'); return o; },
                key(e) {
                    switch (e.key) {
                        case ' ': case 'k': case 'K': toggle(); return true;
                        case 'ArrowLeft': seek(-5); return true;
                        case 'ArrowRight': seek(5); return true;
                        case 'j': case 'J': seek(-10); return true;
                        case 'l': case 'L': seek(10); return true;
                        case 'ArrowUp': v.muted = false; v.volume = clamp(v.volume + 0.1, 0, 1); return true;
                        case 'ArrowDown': v.volume = clamp(v.volume - 0.1, 0, 1); return true;
                        case 'm': case 'M': toggleMute(); return true;
                        case 'f': case 'F': fullscreen(); return true;
                        case 'Home': v.currentTime = 0; return true;
                    }
                    return false;
                },
                destroy() {
                    destroyed = true;
                    item.onCacheProgress = null;
                    cancelAnimationFrame(raf);
                    clearTimeout(idleT);
                    offs.forEach(f => f());
                    v.pause();
                    v.removeAttribute('src');
                    v.load();
                    if (document.fullscreenElement === vp) document.exitFullscreen();
                    vp.remove();
                }
            };
        }

        // ---------- abrir / fechar / atalhos ----------
        function onRootClick(e) {
            const t = e.target.closest('[data-a], .g-th');
            if (!t) return;
            if (t.classList.contains('g-th')) { const i = +t.dataset.i; show(i, i > cur ? 1 : -1); return; }
            switch (t.dataset.a) {
                case 'close': closeGallery(); break;
                case 'prev': go(-1); break;
                case 'next': go(1); break;
                case 'zin': zoomTo(view.s * 1.4); break;
                case 'zout': zoomTo(view.s / 1.4); break;
                case 'actual': actualSize(); break;
                case 'fit': resetView(); break;
                case 'rotl': rotate(-90); break;
                case 'rotr': rotate(90); break;
                case 'thumbs': root.classList.toggle('no-strip'); onResize(); break;
                case 'fs': if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen?.(); break;
            }
        }

        function onKey(e) {
            if (!isOpen) return;
            const item = items[cur];
            const ae = document.activeElement;
            const typing = !!ae && (ae.tagName === 'TEXTAREA' || ae.isContentEditable ||
                (ae.tagName === 'INPUT' && /^(text|search|email|url|tel|password|number)$/i.test(ae.type)));
            const plain = !e.ctrlKey && !e.altKey && !e.metaKey && !typing;
            const navPrev = plain && (e.key === 'a' || e.key === 'A');
            const navNext = plain && (e.key === 'd' || e.key === 'D');
            let handled = true;
            if (e.key === 'Escape') {
                if (!player?.closeMenu()) closeGallery();
            } else if (e.key === 'PageUp' || navPrev) go(-1);
            else if (e.key === 'PageDown' || navNext) go(1);
            else if (item.type === 'video' && player?.key(e)) { /* tratado pelo player */ }
            else if (item.type === 'image') {
                switch (e.key) {
                    case 'ArrowLeft': go(-1); break;
                    case 'ArrowRight': go(1); break;
                    case '+': case '=': zoomTo(view.s * 1.4); break;
                    case '-': zoomTo(view.s / 1.4); break;
                    case '0': resetView(); break;
                    case '1': actualSize(); break;
                    case 'r': case 'R': rotate(90); break;
                    default: handled = false;
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { handled = false; }
            else handled = false;
            if (handled) { e.preventDefault(); e.stopPropagation(); }
        }

        function onResize() {
            if (!isOpen || !view.img) return;
            layoutImg(); clampPan(); applyView(false);
        }

        let prevOverflow = '';
        function openGallery(start = 0) {
            if (!built) build();
            isOpen = true;
            root.classList.add('open');
            prevOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            document.addEventListener('keydown', onKey, true);
            window.addEventListener('resize', onResize);
            show(start);
        }
        function closeGallery() {
            teardown();
            isOpen = false;
            root.classList.remove('open');
            document.documentElement.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', onResize);
            if (document.fullscreenElement) document.exitFullscreen();
        }

        openBtn.addEventListener('click', e => { e.preventDefault(); openGallery(0); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
