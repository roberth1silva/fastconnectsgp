// ==UserScript==
// @name         Log Radius - Final + Scroll + Fonte + Autorefresh + Texto
// @namespace    http://fastfibra.sgp.net.br/
// @version      2026-11-23.2
// @description  Scroll suave, autorefresh antecipado, reload periódico e botão Opções (tamanho do texto e ocultar clientes bloqueados)
// @author       Roberth
// @match        https://fastfibra.sgp.net.br/admin/network/logs/
// @match        http://45.164.128.5:8000/admin/network/logs/
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ---------- Configurações ----------
    const secondsRefresh = 10;       // intervalo do autorefresh e do texto "Atualizando"
    const minutesReload = 30;        // reload completo da página (só com a aba visível)
    const scrollDistance = 280;
    const scrollDuration = 1000;
    const maxAttempts = 10;

    const DEFAULT_FONT = 2;          // rem
    const FONT_STEP = 0.25, FONT_MIN = 0.75, FONT_MAX = 4;
    const DEFAULT_HIDE_BLOCKED = true;

    // Cliente bloqueado = IP começando em 10. OU pool "from bloqueados" na linha
    // (se aparecerem IPs 10.x de clientes que NÃO são bloqueados, restrinja: 10\.24\.)
    const BLOCKED = [/(?<![\d.])10\.\d{1,3}\.\d{1,3}\.\d{1,3}/, /from\s*bloqueados/i];

    // ---------- Preferências (sobrevivem ao reload) ----------
    const store = {
        get(k, d) {
            try { const v = localStorage.getItem('lr:' + k); return v === null ? d : JSON.parse(v); } catch { return d; }
        },
        set(k, v) {
            try { localStorage.setItem('lr:' + k, JSON.stringify(v)); } catch { /* ignora */ }
        }
    };
    let fontSize = store.get('font', DEFAULT_FONT);

    // ---------- Estilo ----------
    const root = document.documentElement;
    const css = document.createElement('style');
    css.textContent = `
        td, td > strong, td > span, td > via { font-size: var(--lr-fs, ${DEFAULT_FONT}rem) !important; }
        html.lr-hide-blocked tr[data-lr-blk="1"] { display: none !important; }

        #lr-opts { display: inline-block; vertical-align: middle; margin-right: 12px; font: 14px/1.3 sans-serif; }
        #lr-opts.lr-float { position: fixed; right: 16px; bottom: 16px; margin: 0; z-index: 99999; }
        #lr-opts button, #lr-panel button { cursor: pointer; border: 1px solid #555; border-radius: 5px; background: #3a3a3a; color: #eee; padding: 7px 12px; font-weight: 700; }
        #lr-opts button:hover, #lr-panel button:hover { background: #4a4a4a; }
        #lr-panel { display: none; position: fixed; z-index: 99999; width: 290px; padding: 14px; font: 14px/1.3 sans-serif;
            background: #2b2b2b; color: #eee; border: 1px solid #555; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
        #lr-panel .lr-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 12px; }
        #lr-panel .lr-row:last-child { margin-bottom: 0; }
        #lr-panel .lr-ctl { display: flex; align-items: center; gap: 6px; }
        #lr-panel .lr-ctl b { min-width: 52px; text-align: center; }
        #lr-panel small { opacity: .7; margin-left: 4px; }
        #lr-panel input[type=checkbox] { width: 18px; height: 18px; accent-color: #f57c00; cursor: pointer; }
    `;
    document.head.appendChild(css);

    // ---------- Botão (na barra, antes do "NAS:") e painel ----------
    const box = document.createElement('span');
    box.id = 'lr-opts';
    box.innerHTML = '<button type="button" id="lr-btn">⚙️ Opções</button>';

    const $panel = document.createElement('div');
    $panel.id = 'lr-panel';
    $panel.innerHTML = `
        <div class="lr-row">
            <span>Texto</span>
            <div class="lr-ctl">
                <button type="button" data-step="-1" title="Diminuir">A−</button>
                <b id="lr-fs"></b>
                <button type="button" data-step="1" title="Aumentar">A+</button>
                <button type="button" id="lr-fs-reset" title="Tamanho padrão">↺</button>
            </div>
        </div>
        <label class="lr-row">
            <span>Ocultar bloqueados<small id="lr-count"></small></span>
            <input type="checkbox" id="lr-hide">
        </label>`;
    document.body.appendChild($panel);

    const $btn = box.querySelector('#lr-btn');
    const $fs = $panel.querySelector('#lr-fs');
    const $count = $panel.querySelector('#lr-count');
    const $hide = $panel.querySelector('#lr-hide');

    // Procura o rótulo "NAS:" (ou o select de NAS) para colocar o botão antes dele
    function findAnchor() {
        const sel = document.querySelector('select[id*="nas" i], select[name*="nas" i]');
        const label = (sel && sel.id && document.querySelector(`label[for="${sel.id}"]`))
            || [...document.querySelectorAll('label')].find(l => /^\s*nas\s*:?\s*$/i.test(l.textContent));
        return label || sel || null;
    }

    function place() {
        const anchor = findAnchor();
        if (anchor) {
            box.classList.remove('lr-float');
            anchor.parentNode.insertBefore(box, anchor);
        } else {
            box.classList.add('lr-float'); // não achou a barra: botão flutuante no canto
            if (box.parentNode !== document.body) document.body.appendChild(box);
        }
    }

    const isOpen = () => $panel.style.display === 'block';
    const closePanel = () => { $panel.style.display = 'none'; };

    function openPanel() {
        const r = $btn.getBoundingClientRect();
        $panel.style.display = 'block';
        const w = $panel.offsetWidth, h = $panel.offsetHeight;
        const below = r.bottom + 8 + h <= innerHeight || r.top < h + 8;
        $panel.style.top = (below ? r.bottom + 8 : r.top - h - 8) + 'px';
        $panel.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    }

    function setFont(v) {
        fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(v * 100) / 100));
        store.set('font', fontSize);
        root.style.setProperty('--lr-fs', fontSize + 'rem');
        $fs.textContent = fontSize + 'rem';
    }

    function setHide(on) {
        store.set('hide', on);
        root.classList.toggle('lr-hide-blocked', on);
        $hide.checked = on;
    }

    $btn.addEventListener('click', () => (isOpen() ? closePanel() : openPanel()));
    $panel.addEventListener('click', e => {
        const step = e.target.closest('[data-step]');
        if (step) setFont(fontSize + FONT_STEP * +step.dataset.step);
        if (e.target.closest('#lr-fs-reset')) setFont(DEFAULT_FONT);
    });
    $hide.addEventListener('change', () => setHide($hide.checked));
    document.addEventListener('click', e => { if (!box.contains(e.target) && !$panel.contains(e.target)) closePanel(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
    addEventListener('scroll', () => { if (isOpen()) openPanel(); }, { passive: true }); // acompanha o botão
    addEventListener('resize', () => { if (isOpen()) openPanel(); });

    place();
    setFont(fontSize);
    setHide(store.get('hide', DEFAULT_HIDE_BLOCKED));

    // ---------- Marcação das linhas bloqueadas ----------
    // Usa a tabela do log (a que tem o cabeçalho DataTables); se não achar, todas as tabelas
    function logTables() {
        const t = [...new Set([...document.querySelectorAll('.DataTables_sort_wrapper')].map(e => e.closest('table')).filter(Boolean))];
        return t.length ? t : [...document.querySelectorAll('table')];
    }

    function tagRows() {
        let n = 0;
        logTables().forEach(table => table.querySelectorAll('tbody tr').forEach(tr => {
            const blocked = BLOCKED.some(re => re.test(tr.textContent));
            if (blocked) { n++; tr.dataset.lrBlk = '1'; } else delete tr.dataset.lrBlk;
        }));
        const label = n ? `(${n})` : '';
        if ($count.textContent !== label) $count.textContent = label;
    }

    // Reaplica a cada atualização do log, sem esperar o próximo ciclo
    let queued = false;
    new MutationObserver(muts => {
        if (queued || muts.every(m => box.contains(m.target) || $panel.contains(m.target))) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            // reposiciona o botão se a barra foi recriada ou se a barra só apareceu depois
            if (!box.isConnected || (box.classList.contains('lr-float') && findAnchor())) place();
            tagRows();
        });
    }).observe(document.body, { childList: true, subtree: true });
    tagRows();

    // ---------- Scroll suave ----------
    function smoothScrollTo(target, duration) {
        const start = window.scrollY || document.documentElement.scrollTop;
        const change = target - start;
        const t0 = performance.now();
        (function step(now) {
            const p = Math.min((now - t0) / duration, 1);
            const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
            window.scrollTo(0, start + change * ease);
            if (p < 1) requestAnimationFrame(step);
        })(t0);
    }

    // ---------- Autorefresh ----------
    function enableAutoRefresh() {
        const secInput = document.getElementById('id_sec');
        const refreshChk = document.getElementById('id_refresh');
        if (secInput) {
            secInput.value = secondsRefresh;
            secInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (refreshChk && !refreshChk.checked) refreshChk.click();
        return !!(secInput && refreshChk);
    }

    // Tenta ativar logo no início, antes do load completo
    let attempts = 0;
    const early = setInterval(() => {
        if (enableAutoRefresh() || ++attempts >= maxAttempts) clearInterval(early);
    }, 300);

    // ---------- Depois do carregamento ----------
    function onLoaded() {
        setTimeout(() => smoothScrollTo(scrollDistance, scrollDuration), 200);

        // Texto visual reaplicado a cada ciclo de atualização
        setInterval(() => {
            document.querySelectorAll('.DataTables_sort_wrapper').forEach(el => {
                if (el.textContent !== 'Log - Atualizando') el.textContent = 'Log - Atualizando';
                el.style.color = '#00A8FF';
            });
        }, secondsRefresh * 1000);

        // Reload periódico apenas com a aba ativa
        setInterval(() => {
            if (document.visibilityState === 'visible') location.reload();
        }, minutesReload * 60 * 1000);
    }

    if (document.readyState === 'complete') onLoaded();
    else window.addEventListener('load', onLoaded);
})();