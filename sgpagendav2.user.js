// ==UserScript==
// @name         SGP Agenda Plus & Design v3.1 - Auto (Light/Dark)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  SGP Agenda Plus & Design v3.1 - Auto (Light/Dark)
// @author       Roberth
// @match        https://fastconnect.sgp.net.br/admin/atendimento/agenda/view/*
// @match        https://fastfibra.sgp.net.br/admin/atendimento/agenda/view/*
// @match        https://sgp.fastconnect.net.br/admin/atendimento/agenda/view/*
// @match        https://sgp.fastfibra.net.br/admin/atendimento/agenda/view/*
// @match        http://45.164.128.5:8000/admin/atendimento/agenda/view/*
// @match        http://192.168.5.24:8000/admin/atendimento/agenda/view/*
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        unsafeWindow
// @resource     REMOTE_CSS https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/assets/sgpstyle.css
// @resource     REMOTE_CSS_DARK https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/assets/sgpstyledark.css
// @run-at       document-start
// ==/UserScript==

/* global $, unsafeWindow, GM_getResourceText, GM_addStyle */

// =========================
// CONFIGURAÇÕES
// =========================
const MAX_TRIES = 5;          // tentativas automáticas do watchdog (recarregar a página)
const WATCHDOG_MS = 10000;    // tempo de espera pelos eventos antes de recarregar
const MAX_CONCURRENT = 6;     // requisições simultâneas à API do SGP
const DEFAULT_THEME_MODE = 'auto'; // 'auto' | 'light' | 'dark'

// =========================
// ESTADO
// =========================
const groupedByWeek = {};
const situationDay = {};
const isHoliday = {};
const osBase = {};            // dados vindos da API (por id da OS)
const osDetail = {};          // dados do detalhe da OS, carregados ao abrir o modal
const seenEvents = new Set();
let calendarCaptured = false; // true quando o FullCalendar entregou a lista de eventos
let currentIndex = 0;
let weekKeys = [];
let currentMonthDate = new Date();
let currentModalId = null;

const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
const TRIES_KEY = 'agendaTries:' + location.href;

// =========================
// HELPERS
// =========================
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
const localKey = d => d.toLocaleDateString('en-CA'); // yyyy-mm-dd no fuso local (evita o desvio do toISOString/UTC)

// Limita quantas requisições rodam ao mesmo tempo
let activeRequests = 0;
const requestQueue = [];
function limited(fn) {
    return new Promise((resolve, reject) => {
        const run = () => {
            activeRequests++;
            fn().then(resolve, reject).finally(() => {
                activeRequests--;
                if (requestQueue.length) requestQueue.shift()();
            });
        };
        if (activeRequests < MAX_CONCURRENT) run();
        else requestQueue.push(run);
    });
}

// =========================
// SEMANAS
// =========================
function formatarSemanaLabel(weekKey) {
    const [ano, semana] = weekKey.split('-W').map(Number);

    const jan1 = new Date(ano, 0, 1);
    const primeiroDomingo = new Date(jan1);
    primeiroDomingo.setDate(jan1.getDate() - jan1.getDay());

    const inicio = new Date(primeiroDomingo);
    inicio.setDate(primeiroDomingo.getDate() + (semana - 1) * 7);
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);

    const d1 = pad(inicio.getDate());
    const d2 = pad(fim.getDate());
    const m1 = inicio.toLocaleDateString('pt-BR', { month: 'long' }).toLowerCase();
    const m2 = fim.toLocaleDateString('pt-BR', { month: 'long' }).toLowerCase();
    const a1 = inicio.getFullYear();
    const a2 = fim.getFullYear();

    if (a1 !== a2) return `${d1} de ${m1} de ${a1} à ${d2} de ${m2} de ${a2}`;
    if (m1 !== m2) return `${d1} de ${m1} à ${d2} de ${m2} de ${a2}`;
    return `${d1} à ${d2} de ${m2} de ${a2}`;
}

function getWeekKey(dateLike) {
    const date = new Date(dateLike);
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - date.getDay());

    const year = sunday.getFullYear();
    const firstSunday = new Date(year, 0, 1);
    firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());

    const diffDays = Math.round((sunday - firstSunday) / 86400000);
    const week = Math.floor(diffDays / 7) + 1;

    return `${year}-W${pad(week)}`;
}

const currentWeekKey = getWeekKey(new Date());

function groupedEvents(events) {
    const mapped = events
        .map(e => ({
            id: e.id,
            title: e.title,
            situation: e.is_encerrado,
            holiday: e.is_feriado || false,
            date: new Date(e.start)
        }))
        .sort((a, b) => a.date - b.date);

    mapped.forEach(ev => {
        const dateKey = localKey(ev.date);
        const uid = ev.id ? `os-${ev.id}` : `h-${dateKey}-${ev.title}`;
        if (seenEvents.has(uid)) return; // evita duplicar se o calendário for criado 2x
        seenEvents.add(uid);

        if (ev.id) {
            const key = getWeekKey(ev.date);
            (groupedByWeek[key] ||= []).push(ev);
        }

        if (ev.holiday) {
            isHoliday[dateKey] = { holiday: true, title: ev.title };
        } else {
            const statusKey = ev.situation ? 'encerrado' : 'aberto';
            (situationDay[dateKey] ||= { encerrado: 0, aberto: 0 })[statusKey]++;
        }
    });
}

// =========================
// HOOK NO FULLCALENDAR
// =========================
(function hookCalendar() {
    const timer = setInterval(() => {
        const FC = W.FullCalendar;
        if (!FC || !FC.Calendar) return;
        clearInterval(timer);

        const OriginalCalendar = FC.Calendar;
        OriginalCalendar.prototype.render = function () {}; // bloqueia o render nativo

        FC.Calendar = function (...args) {
            const options = args[1] || {};
            if (Array.isArray(options.events)) {
                const events = options.events;
                setTimeout(() => {
                    groupedEvents(events);
                    calendarCaptured = true;
                }, 0);
            }
            return new OriginalCalendar(...args);
        };
        FC.Calendar.prototype = OriginalCalendar.prototype;
    }, 10);
    setTimeout(() => clearInterval(timer), 60000);
})();

function waitForCalendar(callback) {
    const t = setInterval(() => {
        if (calendarCaptured) {
            clearInterval(t);
            callback();
        }
    }, 100);
}

// =========================
// WATCHDOG (repete o carregamento sozinho, com limite)
// =========================
function agendaWatchdog() {
    if (calendarCaptured) return;

    const tries = +sessionStorage.getItem(TRIES_KEY) || 0;
    if (tries >= MAX_TRIES) {
        console.error(`[Agenda Watchdog] Falhou após ${MAX_TRIES} tentativas.`);
        $(function () {
            $('body').prepend(`
                <div class="agenda-retry">
                    <span>A agenda não carregou após ${MAX_TRIES} tentativas automáticas.</span>
                    <button type="button" id="agendaRetryBtn">Tentar novamente</button>
                </div>`);
            $('#agendaRetryBtn').on('click', () => {
                sessionStorage.removeItem(TRIES_KEY);
                location.reload();
            });
        });
        return;
    }

    sessionStorage.setItem(TRIES_KEY, tries + 1);
    console.warn(`[Agenda Watchdog] Sem dados após ${WATCHDOG_MS / 1000}s. Tentativa ${tries + 1}/${MAX_TRIES}, recarregando...`);
    location.reload();
}
setTimeout(agendaWatchdog, WATCHDOG_MS);

// =========================
// ESTILO
// =========================
const LIGHT_EXTRA_CSS = `
    .service.no-tech { box-shadow: inset 4px 0 0 #f59e0b; }
    .service .sem-tecnico { color: #b45309; font-weight: 700; }
    .service .sem-tecnico::before { content: "⚠ "; }
    .agenda-empty { width: 100%; padding: 28px; text-align: center; color: #6b7280; }
    .agenda-retry { display: flex; gap: 12px; align-items: center; margin: 10px 15px; padding: 10px 14px;
        background: #fff7ed; color: #9a3412; border: 1px solid #f59e0b; border-radius: 6px; }
    .agenda-retry button { background: #f59e0b; color: #fff; border: 0; border-radius: 4px; padding: 6px 12px;
        cursor: pointer; font-weight: 700; }
    .agenda-retry button:hover { background: #d97706; }
`;

const DARK_EXTRA_CSS = `
    .service.no-tech { box-shadow: inset 4px 0 0 #ff9800; }
    .service .sem-tecnico { color: #ff9800; font-weight: 700; }
    .service .sem-tecnico::before { content: "⚠ "; }
    .agenda-empty { width: 100%; padding: 28px; text-align: center; opacity: .7; }
    .agenda-retry { display: flex; gap: 12px; align-items: center; margin: 10px 15px; padding: 10px 14px;
        background: #4a2a00; color: #ffcc80; border: 1px solid #ff9800; border-radius: 6px; }
    .agenda-retry button { background: #ff9800; color: #000; border: 0; border-radius: 4px; padding: 6px 12px;
        cursor: pointer; font-weight: 700; }
`;

// =========================
// TEMA (automático + botão)
// =========================
const THEME_MODE_KEY = 'sgpAgendaThemeMode';
const THEME_MODES = ['auto', 'light', 'dark'];
const BASE_CSS = GM_getResourceText('REMOTE_CSS');
const DARK_CSS = GM_getResourceText('REMOTE_CSS_DARK');

let themeMode = 'auto';
let appliedTheme = null;
let autoConfident = false;
let themeButton = null;
let themeStyleEl = null;
let baseStyleEl = null;
let themeClickTimer = null;

function readThemeMode() {
    try {
        const saved = localStorage.getItem(THEME_MODE_KEY);
        if (THEME_MODES.includes(saved)) return saved;
    } catch (e) { /* storage indisponível */ }
    return DEFAULT_THEME_MODE;
}

function saveThemeMode(mode) {
    try {
        if (mode === 'auto') localStorage.removeItem(THEME_MODE_KEY);
        else localStorage.setItem(THEME_MODE_KEY, mode);
    } catch (e) { /* storage indisponível */ }
}

// --- Detecção do tema atual do SGP ---
function parseColor(value) {
    const m = String(value || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}

function relativeLuminance(c) {
    const f = v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function effectiveBackground(el) {
    let node = el;
    while (node && node.nodeType === 1) {
        const c = parseColor(getComputedStyle(node).backgroundColor);
        if (c && c.a > 0.2) return c;
        node = node.parentElement;
    }
    return null;
}

function storedSgpTheme() {
    try {
        for (const store of [localStorage, sessionStorage]) {
            for (let i = 0; i < store.length; i++) {
                const key = store.key(i) || '';
                if (key === THEME_MODE_KEY || !/theme|tema|dark|color|appearance|modo/i.test(key)) continue;
                const value = String(store.getItem(key) || '').toLowerCase();
                if (/\bdark\b|escuro/.test(value)) return 'dark';
                if (/\blight\b|claro/.test(value)) return 'light';
            }
        }
    } catch (e) { /* storage indisponível */ }
    return null;
}

function cookieSgpTheme() {
    try {
        for (const pair of String(document.cookie || '').toLowerCase().split(';')) {
            const [key, ...rest] = pair.trim().split('=');
            if (!/theme|tema|dark|color|appearance|modo/i.test(key)) continue;
            const value = decodeURIComponent(rest.join('='));
            if (/\bdark\b|escuro/.test(value)) return 'dark';
            if (/\blight\b|claro/.test(value)) return 'light';
        }
    } catch (e) { /* cookie inválido */ }
    return null;
}

function detectSgpTheme() {
    const html = document.documentElement;
    const body = document.body;

    // 1) Classes/atributos que indicam o tema
    const roots = [html, body];
    document.querySelectorAll('#app, #wrapper, .app, .wrapper, .main-wrapper, .content-wrapper, .layout, .theme-wrapper').forEach(el => {
        if (roots.length < 10) roots.push(el);
    });

    let darkMarker = false;
    let lightMarker = false;
    roots.forEach(el => {
        const raw = [
            typeof el.className === 'string' ? el.className : '',
            el.id || '',
            el.getAttribute('data-theme') || '',
            el.getAttribute('data-bs-theme') || '',
            el.getAttribute('data-mode') || '',
            el.getAttribute('data-color-mode') || '',
            el.getAttribute('data-skin') || ''
        ].join(' ');

        raw.split(/\s+/).forEach(token => {
            const t = token.toLowerCase().replace(/_/g, '-');
            if (!t) return;
            if (t === 'dark' || t === 'darkmode' || t === 'dark-mode' || t === 'dark-theme' ||
                t === 'theme-dark' || t === 'modo-escuro' || t === 'escuro' || t === 'skin-dark') darkMarker = true;
            if (t === 'light' || t === 'lightmode' || t === 'light-mode' || t === 'light-theme' ||
                t === 'theme-light' || t === 'modo-claro' || t === 'claro' || t === 'skin-light') lightMarker = true;
        });
    });
    if (darkMarker && !lightMarker) return { theme: 'dark', confident: true };
    if (lightMarker && !darkMarker) return { theme: 'light', confident: true };

    // 2) Cor de fundo real da página
    const bg = effectiveBackground(body) || effectiveBackground(html);
    if (bg) {
        const lum = relativeLuminance(bg);
        if (lum < 0.35) return { theme: 'dark', confident: true };
        if (lum > 0.60) return { theme: 'light', confident: true };
    }

    // 3) Preferência salva pelo próprio SGP
    const stored = storedSgpTheme();
    if (stored) return { theme: stored, confident: true };

    const cookie = cookieSgpTheme();
    if (cookie) return { theme: cookie, confident: true };

    // 4) Nome de algum CSS carregado
    const darkLink = Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).some(link => {
        if (link.disabled || link.media === 'not all') return false;
        return /(^|[\/_.-])(dark|escuro)([_.-]|$)/i.test(link.getAttribute('href') || link.href || '');
    });
    if (darkLink) return { theme: 'dark', confident: true };

    return { theme: 'light', confident: false };
}

// --- Aplicação do tema ---
function ensureBaseStyle() {
    if (baseStyleEl && baseStyleEl.isConnected) return;
    baseStyleEl = document.createElement('style');
    baseStyleEl.id = 'sgp-base-css';
    baseStyleEl.textContent = BASE_CSS;
    document.head.insertBefore(baseStyleEl, themeStyleEl || null);
}

function applyTheme(theme, force = false) {
    if (!force && theme === appliedTheme) return;
    ensureBaseStyle();

    if (!themeStyleEl || !themeStyleEl.isConnected) {
        themeStyleEl = document.createElement('style');
        themeStyleEl.id = 'sgp-theme-css';
        document.head.appendChild(themeStyleEl);
    }

    themeStyleEl.textContent = `html[data-sgp-theme="light"]{color-scheme:light}html[data-sgp-theme="dark"]{color-scheme:dark}\n` +
        (theme === 'dark' ? DARK_CSS + '\n' + DARK_EXTRA_CSS : LIGHT_EXTRA_CSS);

    appliedTheme = theme;
    document.documentElement.dataset.sgpTheme = theme;
    console.info('[Agenda Plus] Tema aplicado:', theme);
    updateThemeButton();
}

function setThemeMode(mode) {
    themeMode = THEME_MODES.includes(mode) ? mode : 'auto';
    saveThemeMode(themeMode);
    if (themeMode === 'auto') {
        applyAutoTheme(true);
    } else {
        applyTheme(themeMode, true);
    }
}

function applyAutoTheme(force = false) {
    const detected = detectSgpTheme();
    autoConfident = detected.confident;
    applyTheme(detected.theme, force);
}

// --- Botão flutuante ---
function updateThemeButton() {
    if (!themeButton) return;
    const dark = appliedTheme === 'dark';
    const auto = themeMode === 'auto';
    const showButton = !auto || !autoConfident;

    themeButton.style.display = showButton ? 'inline-flex' : 'none';

    themeButton.innerHTML = `<span aria-hidden="true" style="font-size:15px;line-height:1;">${dark ? '☾' : '☀'}</span><span>${dark ? 'Escuro' : 'Claro'}</span>${auto ? '<span style="font-size:9px;font-weight:700;letter-spacing:.5px;opacity:.65;border:1px solid currentColor;border-radius:4px;padding:2px 4px;">AUTO</span>' : ''}`;
    themeButton.title = auto
        ? `Tema automático (${dark ? 'escuro' : 'claro'}). Clique para alternar; Shift+clique, duplo clique ou botão direito volta ao automático.`
        : `Tema manual (${dark ? 'escuro' : 'claro'}). Clique para alternar; Shift+clique, duplo clique ou botão direito volta ao automático.`;
    themeButton.setAttribute('aria-label', themeButton.title);

    Object.assign(themeButton.style, {
        borderColor: dark ? '#4b5563' : '#d1d5db',
        background: dark ? '#1f2937' : '#ffffff',
        color: dark ? '#f9fafb' : '#374151',
        boxShadow: dark ? '0 8px 22px rgba(0,0,0,.5)' : '0 8px 22px rgba(15,23,42,.18)'
    });
}

function createThemeButton() {
    if (themeButton && themeButton.isConnected) return;

    themeButton = document.createElement('button');
    themeButton.id = 'sgpThemeToggle';
    themeButton.type = 'button';
    Object.assign(themeButton.style, {
        position: 'fixed',
        right: '18px',
        bottom: '18px',
        zIndex: '2147483000',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '9px 13px',
        borderRadius: '999px',
        border: '1px solid #d1d5db',
        font: '600 13px/1.1 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
        cursor: 'pointer',
        userSelect: 'none',
        opacity: '0.96',
        transition: 'background .15s, color .15s, border-color .15s, box-shadow .15s, transform .15s'
    });

    themeButton.addEventListener('click', e => {
        if (e.shiftKey) {
            clearTimeout(themeClickTimer);
            setThemeMode('auto');
            return;
        }
        clearTimeout(themeClickTimer);
        // Espera para diferenciar clique de duplo clique
        themeClickTimer = setTimeout(() => {
            setThemeMode(appliedTheme === 'dark' ? 'light' : 'dark');
        }, 220);
    });

    themeButton.addEventListener('dblclick', () => {
        clearTimeout(themeClickTimer);
        setThemeMode('auto');
    });

    themeButton.addEventListener('contextmenu', e => {
        e.preventDefault();
        clearTimeout(themeClickTimer);
        setThemeMode('auto');
    });

    themeButton.addEventListener('mouseenter', () => { themeButton.style.transform = 'translateY(-1px)'; });
    themeButton.addEventListener('mouseleave', () => { themeButton.style.transform = ''; });

    document.body.appendChild(themeButton);
    updateThemeButton();

    // Atalho de emergência: mostra/alterna o tema quando a detecção automática falhar
    document.addEventListener('keydown', e => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && String(e.key).toLowerCase() === 't') {
            e.preventDefault();
            setThemeMode(appliedTheme === 'dark' ? 'light' : 'dark');
        }
    });
}

// --- Inicialização do tema (somente no carregamento da página) ---
function initTheme() {
    themeMode = readThemeMode();
    if (themeMode === 'auto') {
        applyAutoTheme(true);
    } else {
        applyTheme(themeMode, true);
    }
}

// =========================
// ELEMENTOS DA PÁGINA
// =========================
function createElement() {
    const $modal = $(`<div class="modal" id="modalService">
        <div class="modal-content">
          <div class="modal-header">
            <span id="title-id-os"></span>
            <span class="modal-close">&times;</span>
          </div>
          <div class="modal-body">
            <div class="modal-left">
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                    <path fill-rule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clip-rule="evenodd" />
                    <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                </svg>
                <span class="modal-text-gray">Ocorrência:&nbsp;</span>
                <a href="" target="_blank" id="os-id-link"><span id="os-id"></span></a>
              </span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Cadastro:&nbsp;</span>
                <span id="register-date"></span>
              </span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Aberta por:&nbsp;</span>
                <span id="register-user"></span>
              </span>
              <span class="line-break"></span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Situação Atual:&nbsp;</span>
                <span id="os-status"></span>
              </span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Agendamento:&nbsp;</span>
                <span id="schedule-date"></span>
              </span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M4.5 3.75a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3h-15Zm4.125 3a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Zm-3.873 8.703a4.126 4.126 0 0 1 7.746 0 .75.75 0 0 1-.351.92 7.47 7.47 0 0 1-3.522.877 7.47 7.47 0 0 1-3.522-.877.75.75 0 0 1-.351-.92ZM15 8.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15ZM14.25 12a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H15a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Cliente:&nbsp;</span>
                <a href="" target="_blank" id="customer-id-link"><span id="customer-id"></span></a>
              </span>
              <span class="line-break"></span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M12 6.75a5.25 5.25 0 0 1 6.775-5.025.75.75 0 0 1 .313 1.248l-3.32 3.319c.063.475.276.934.641 1.299.365.365.824.578 1.3.64l3.318-3.319a.75.75 0 0 1 1.248.313 5.25 5.25 0 0 1-5.472 6.756c-1.018-.086-1.87.1-2.309.634L7.344 21.3A3.298 3.298 0 1 1 2.7 16.657l8.684-7.151c.533-.44.72-1.291.634-2.309A5.342 5.342 0 0 1 12 6.75ZM4.117 19.125a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008Z" clip-rule="evenodd" />
                  <path d="m10.076 8.64-2.201-2.2V4.874a.75.75 0 0 0-.364-.643l-3.75-2.25a.75.75 0 0 0-.916.113l-.75.75a.75.75 0 0 0-.113.916l2.25 3.75a.75.75 0 0 0 .643.364h1.564l2.062 2.062 1.575-1.297Z" />
                  <path fill-rule="evenodd" d="m12.556 17.329 4.183 4.182a3.375 3.375 0 0 0 4.773-4.773l-3.306-3.305a6.803 6.803 0 0 1-1.53.043c-.394-.034-.682-.006-.867.042a.589.589 0 0 0-.167.063l-3.086 3.748Zm3.414-1.36a.75.75 0 0 1 1.06 0l1.875 1.876a.75.75 0 1 1-1.06 1.06L15.97 17.03a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Técnicos:&nbsp;</span>
                <span id="technicians"></span>
              </span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M5.25 2.25a3 3 0 0 0-3 3v4.318a3 3 0 0 0 .879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 0 0 5.441-5.44c.758-1.16.492-2.629-.428-3.548l-9.58-9.581a3 3 0 0 0-2.122-.879H5.25ZM6.375 7.5a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Motivo:&nbsp;</span>
                <span id="os-reason"></span>
              </span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97ZM6.75 8.25a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H7.5Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Problema Reportado:&nbsp;</span>
              </span>
              <span class="report-problem"></span>
              <span class="line-break"></span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Finalização:&nbsp;</span>
                <span id="finished-date"></span>
              </span>
              <span class="modal-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-text">
                  <path fill-rule="evenodd" d="M15.75 1.5a6.75 6.75 0 0 0-6.651 7.906c.067.39-.032.717-.221.906l-6.5 6.499a3 3 0 0 0-.878 2.121v2.818c0 .414.336.75.75.75H6a.75.75 0 0 0 .75-.75v-1.5h1.5A.75.75 0 0 0 9 19.5V18h1.5a.75.75 0 0 0 .53-.22l2.658-2.658c.19-.189.517-.288.906-.22A6.75 6.75 0 1 0 15.75 1.5Zm0 3a.75.75 0 0 0 0 1.5A2.25 2.25 0 0 1 18 8.25a.75.75 0 0 0 1.5 0 3.75 3.75 0 0 0-3.75-3.75Z" clip-rule="evenodd" />
                </svg>
                <span class="modal-text-gray">Finalizado  por:&nbsp;</span>
                <span id="finished-user"></span>
              </span>
            </div>
            <div class="modal-right">
              <button class="icon-button" id="btn-open-os">
                <img alt="Abrir OS" src="https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/assets/document.svg" class="icon-svg" />
              </button>
              <button class="icon-button" id="btn-print-os">
                <img alt="Imprimir" src="https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/assets/print.svg" class="icon-svg" />
              </button>
            </div>
          </div>
        </div>
      </div>`);

    const $calendarWrapper = $(`
        <div id="main-calendar" class="main-calendar">
            <span id="loader" class="loader" style="display: none; margin-top: 20px;"></span>
            <div class="table" id="main-table"></div>
        </div>
    `);

    const $controls = $(`
        <div class="menu-box" style="margin: 10px 0; height: 36px;">
  <div style="width: 10%; display: flex;" id="btnWeek">
    <button class="prev-week btn-disabled" id="prevWeek" disabled><span class="fc-icon fc-icon-chevron-left" role="img"></span></button>
    <button class="next-week prev-week btn-disabled" id="nextWeek" disabled><span class="fc-icon fc-icon-chevron-right" role="img"></span></button>
    <button class="prev-week next-week today-week btn-disabled" id="todayWeek" disabled>Hoje</button>
  </div>
  <div style="width: 10%; display: none;" id="btnMonth">
    <button class="prev-week" id="prevMonth"><span class="fc-icon fc-icon-chevron-left" role="img"></span></button>
    <button class="next-week prev-week" id="nextMonth"><span class="fc-icon fc-icon-chevron-right" role="img"></span></button>
    <button class="prev-week next-week today-week" id="todayMonth">Hoje</button>
  </div>
  <div style="width: 30%; display: flex;">
    <div class="search-box" style="margin-left: 3px;">
      <span class="search-button"><i class="fas fa-search"></i></span>
      <input name="search-input" class="search-input" type="text" placeholder="Digite o nome do cliente..." value=""></input>
    </div>
  </div>
  <div class="title-week" style="width: 20%; display: flex; flex-wrap: nowrap; justify-content: center; align-items: center; font-size: 1.5rem; font-weight: bold;"></div>
  <div class="title-month" style="width: 20%; display: none; flex-wrap: nowrap; justify-content: center; align-items: center; font-size: 1.5rem; font-weight: bold;"></div>
  <div style="width: 30%; display: flex;">
  </div>
  <div style="width: 10%; display: flex; justify-content: flex-end;">
    <div class="week-loader" style="display: flex; width: 48px; flex-wrap: nowrap; justify-content: center; align-items: center;">
      <span id="week-loader" class="loader" style="display:none; width: 24px; height: 24px; border-width: 3px;"></span>
    </div>
    <button class="prev-week next-week today-week btn-active-view" id="listView">Lista</button>
    <button class="prev-week next-week today-week btn-disabled" id="monthView" style="margin-right: 0px;">Mês</button>
  </div>
</div>
    `);

    const $monthCalendar = $(`<div id="month-calendar" class="month-calendar" style="display: none;">
      <div class="row-week">
        <div><span>Dom</span></div>
        <div><span>Seg</span></div>
        <div><span>Ter</span></div>
        <div><span>Qua</span></div>
        <div><span>Qui</span></div>
        <div><span>Sex</span></div>
        <div><span>Sab</span></div>
      </div>
      <div class="row-day">
      </div>
    </div>`);

    $('#calendar').before($controls).before($monthCalendar).before($calendarWrapper).before($modal);

    const $dayModal = $(`
<div class="modal modal-day" id="modalDay">
  <div class="modal-content" style="width:90%; text-align: left;">
    <div class="modal-header">
      <span class="modal-title">Serviços do Dia</span>
      <span class="modal-close close-day-modal">&times;</span>
    </div>
    <div class="modal-body">
      <div class="modal-day-body" style="width: 100%; display: flex; flex-direction: row; flex-wrap: wrap; max-height: 550px; overflow-y: scroll;"></div>
    </div>
  </div>
</div>
`);
    $('body').append($dayModal);
}

// =========================
// DADOS DA OS
// =========================
function fetchDataFromAPI(id, attempt = 1) {
    return limited(() => new Promise(resolve => {
        $.ajax({
            url: `/api/os/list/id/${id}`,
            method: 'POST',
            success: data => resolve(data || {}),
            error: err => {
                console.error('Erro ao buscar dados:', err);
                resolve(null);
            }
        });
    })).then(data => {
        if (data !== null) return data;
        if (attempt < 2) {
            return new Promise(r => setTimeout(r, 500)).then(() => fetchDataFromAPI(id, attempt + 1));
        }
        return {};
    });
}

// Detalhe da OS: só é buscado quando o modal é aberto (e fica em cache)
function fetchDetail(id) {
    if (osDetail[id]) return Promise.resolve(osDetail[id]);
    return new Promise(resolve => {
        $.get(`/admin/atendimento/os/${id}/agenda/evento/`)
            .done(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html'); // não executa scripts
                const tds = $(doc.body).find('table td');
                const txt = i => $(tds[i]).text().trim();
                const lnk = i => $(tds[i]).find('a').attr('href') || '';
                const d = {
                    ocorrenciaText: txt(1),
                    ocorrenciaLink: lnk(1),
                    dataCadastro: txt(3),
                    abertaPor: cap(txt(5)),
                    dataAgendamento: txt(11),
                    clienteText: txt(13),
                    clienteLink: lnk(13),
                    dataFinalizacao: txt(21),
                    finalizadoPor: cap(txt(25))
                };
                osDetail[id] = d;
                resolve(d);
            })
            .fail(() => resolve({}));
    });
}

// =========================
// MODAL
// =========================
function fillDetail(d) {
    const v = x => x || '—';
    $('#os-id').text(v(d.ocorrenciaText));
    $('#os-id-link').attr('href', d.ocorrenciaLink || null);
    $('#register-date').text(v(d.dataCadastro));
    $('#register-user').text(v(d.abertaPor));
    $('#schedule-date').text(v(d.dataAgendamento));
    $('#customer-id').text(v(d.clienteText));
    $('#customer-id-link').attr('href', d.clienteLink || null);
    $('#finished-date').text(v(d.dataFinalizacao));
    $('#finished-user').text(v(d.finalizadoPor));
}

async function openModal(id) {
    currentModalId = id;
    const base = osBase[id] || {};

    // Já mostra o que veio da API; o resto chega em seguida
    $('#title-id-os').text('Ordem de Serviço ' + id);
    $('#os-status').text(base.situacao || '');
    $('#technicians').text(base.tecnicos || 'Sem técnico');
    $('#os-reason').text(base.motivo || '');
    $('.report-problem').html(esc(base.conteudo).replace(/\n/g, '<br>'));

    let d = osDetail[id];
    if (!d) {
        $('#os-id, #register-date, #register-user, #schedule-date, #customer-id, #finished-date, #finished-user').text('…');
        $('#os-id-link, #customer-id-link').removeAttr('href');
    }
    $('#modalService').css('display', 'flex');

    if (!d) d = await fetchDetail(id);
    if (currentModalId !== id) return; // o usuário abriu outra OS enquanto carregava
    fillDetail(d);
}

// =========================
// EVENTOS (registrados uma única vez, com delegação)
// =========================
function bindEvents() {
    let clickTimer = null;

    $(document).on('click', '.service', function (e) {
        if ($(e.target).closest('a, button').length) return;
        const id = $(this).data('id');
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => openModal(id), 250); // espera para ver se vira dblclick
    });

    $(document).on('dblclick', '.service', function (e) {
        if ($(e.target).closest('a, button').length) return;
        clearTimeout(clickTimer);
        window.open(`/admin/atendimento/ocorrencia/os/${$(this).data('id')}/edit/`, '_blank');
    });

    const closeOnOverlay = sel => $(sel).on('click', function (e) {
        if (e.target === this) $(this).css('display', 'none');
    });
    closeOnOverlay('#modalService');
    closeOnOverlay('#modalDay');
    $('#modalService .modal-close').on('click', () => $('#modalService').css('display', 'none'));
    $('.close-day-modal').on('click', () => $('#modalDay').css('display', 'none'));
    $(document).on('keydown', e => {
        if (e.key === 'Escape') $('#modalService, #modalDay').css('display', 'none');
    });

    $('#btn-open-os').on('click', () => {
        window.open(`/admin/atendimento/ocorrencia/os/${currentModalId}/edit/`, '_blank');
    });
    $('#btn-print-os').on('click', () => {
        window.open(`/admin/atendimento/ocorrencia/os/${currentModalId}/print/`, '_blank');
    });

    // Busca por cliente (ignora acentos e maiúsculas)
    $(document).on('input', '.search-input', function () {
        const termo = norm($(this).val().trim());
        $('.morning, .afternoon').toggle(termo === '');
        $('.service').each(function () {
            $(this).toggle(norm($(this).text()).includes(termo));
        });
    });

    // Clique em um dia da visão mensal
    $(document).on('click', '.calendar-day', function () {
        const date = $(this).data('date');
        const $body = $('.modal-day-body').empty();
        const $morning = $(`#morning-${date}`).clone().removeAttr('id').show();
        const $afternoon = $(`#afternoon-${date}`).clone().removeAttr('id').show();

        if ($morning.length) $body.append($morning);
        if ($afternoon.length) $body.append($afternoon);
        if ($morning.length || $afternoon.length) $('#modalDay').css('display', 'flex');
    });
}

// =========================
// RENDERIZAÇÃO
// =========================
async function buildService(ev) {
    const info = await fetchDataFromAPI(ev.id);
    const time = ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!info.os_id) {
        // Falhou mesmo após retry: mostra uma linha mínima em vez de quebrar
        return `
          <div class="service" data-id="${esc(ev.id)}">
            <span class="service-status"><span class="status open">Erro</span></span>
            <span class="service-time">${time}</span>
            <span class="service-customer"><strong>${esc(ev.title)}</strong><br>Não foi possível carregar os dados desta OS</span>
            <span class="service-employee"></span>
            <span class="service-observation"></span>
            <span class="service-location"></span>
            <span class="service-action"><a class="btn btn-dark btn-open-os" href="/admin/atendimento/ocorrencia/os/${esc(ev.id)}/edit/" target="_blank">Abrir OS</a></span>
          </div>`;
    }

    const statusMap = { 'Aberta': 'open', 'Em execução': 'executing', 'Encerrada': 'finished' };
    const labelMap = { 'Aberta': 'Em Aberto', 'Em execução': 'Em Execução', 'Encerrada': 'Finalizado' };
    const statusClass = statusMap[info.os_status_txt] || 'open';
    const statusLabel = labelMap[info.os_status_txt] || 'Em Aberto';

    const endereco = `
        ${esc(info.endereco_logradouro)} ${esc(info.endereco_numero)} ${esc(info.endereco_complemento)}<br>
        ${esc(info.endereco_bairro)}, ${esc(info.endereco_cidade)}-${esc(info.endereco_uf)}
    `.trim();

    let tecnicos = '';
    if (info.os_tecnico_responsavel) {
        tecnicos = cap(info.os_tecnico_responsavel.split(' ')[0]);
    }
    if (Array.isArray(info.os_tecnicos_auxiliares)) {
        info.os_tecnicos_auxiliares.forEach(aux => {
            tecnicos += ` - ${cap(aux.split(' ')[0])}`;
        });
    }

    let obs = '';
    if (info.os_conteudo && info.os_conteudo.includes('Obs:')) {
        obs = info.os_conteudo.split('Obs:')[1].trim();
    }

    osBase[info.os_id] = {
        situacao: statusLabel,
        tecnicos,
        motivo: info.os_motivo_descricao,
        conteudo: info.os_conteudo
    };

    const semTecnico = !tecnicos && statusLabel !== 'Finalizado';
    const techHTML = tecnicos
        ? `<span class="service-employee">${esc(tecnicos)}</span>`
        : `<span class="service-employee ${semTecnico ? 'sem-tecnico' : ''}">Sem técnico</span>`;
    const obsHTML = obs
        ? `<span class="service-observation"><strong>Observação da OS:</strong><br>${esc(obs)}</span>`
        : `<span class="service-observation"></span>`;

    return `
      <div class="service${semTecnico ? ' no-tech' : ''}" data-id="${esc(info.os_id)}">
        <span class="service-status"><span class="status ${statusClass}">${statusLabel}</span></span>
        <span class="service-time">${time}</span>
        <span class="service-customer"><strong>${esc(info.cliente)}</strong><br>${esc(info.os_motivo_descricao)}</span>
        ${techHTML}
        ${obsHTML}
        <span class="service-location">${endereco}</span>
        <span class="service-action"><a class="btn btn-dark btn-open-os" href="/admin/atendimento/ocorrencia/os/${esc(info.os_id)}/edit/" target="_blank">Abrir OS</a></span>
      </div>`;
}

async function renderWeek(weekKey, events, isFirst) {
    if (isFirst) {
        $('#loader').css('display', 'flex');
        $('#week-loader').css('display', 'flex');
        $('#main-table').css('display', 'none');
    }
    const $week = $(`<div class="week-block" id="week-${weekKey}" style="display: ${isFirst ? 'flex' : 'none'};"></div>`);
    $('#main-table').append($week);

    const grouped = {};
    events.forEach(ev => {
        const day = localKey(ev.date);
        const period = ev.date.getHours() < 12 ? 'morning' : 'afternoon';
        (grouped[day] ||= { morning: [], afternoon: [] })[period].push(ev);
    });

    const options = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const tasks = [];

    Object.keys(grouped).sort().forEach(day => {
        const dayText = new Date(day + 'T00:00:00').toLocaleDateString('pt-BR', options).replace(/^./, c => c.toUpperCase());
        const $day = $(`<div class="day-block" id="day-${day}"><span class="title">${dayText}</span></div>`);
        $week.append($day);

        [['morning', 'Manhã'], ['afternoon', 'Tarde']].forEach(([period, label]) => {
            const list = grouped[day][period];
            if (!list.length) return;
            $day.append(`<span class="${period}">${label}</span>`);
            const $period = $(`<div class="period" id="${period}-${day}"></div>`);
            $day.append($period);
            // Promise.all preserva a ordem do array: as OS entram sempre em ordem de horário
            tasks.push(Promise.all(list.map(buildService)).then(htmls => $period.append(htmls.join(''))));
        });
    });

    await Promise.all(tasks);

    if (isFirst) {
        $('#loader').css('display', 'none');
        $('#main-table').css('display', 'flex');
    }
}

function showWeek(index) {
    $('.week-block').hide();
    const key = weekKeys[index];
    $(`#week-${key}`).show();
    $('.title-week').text(formatarSemanaLabel(key));
    currentIndex = index;
}

// =========================
// VISÃO MENSAL
// =========================
function fillEventsInMonth() {
    for (const date in isHoliday) {
        const $day = $(`.calendar-day[data-date="${date}"] .day-events`);
        const data = isHoliday[date];
        if (data.holiday) {
            $day.parent().addClass('calendar-day-holiday');
            $day.append(`<span class="day-status day-holiday">${esc(data.title)}</span>`);
        }
    }
    for (const date in situationDay) {
        const $day = $(`.calendar-day[data-date="${date}"] .day-events`);
        const data = situationDay[date];
        if (data.aberto > 0) $day.append(`<span class="day-status day-open">Em Aberto: ${data.aberto}</span>`);
        if (data.encerrado > 0) $day.append(`<span class="day-status day-finished">Encerrado: ${data.encerrado}</span>`);
    }
}

function generateMonthView(referenceDate) {
    const nomeMesAno = referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    $('.title-month').text(nomeMesAno.charAt(0).toUpperCase() + nomeMesAno.slice(1));

    const firstDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay()); // começa no domingo
    const end = new Date(lastDay);
    end.setDate(lastDay.getDate() + (6 - end.getDay()));   // termina no sábado

    const days = [];
    while (start <= end) {
        days.push(new Date(start));
        start.setDate(start.getDate() + 1);
    }

    const $calendar = $('#month-calendar');
    $calendar.find('.row-day:not(.row-week)').remove();

    for (let i = 0; i < days.length; i += 7) {
        const $row = $('<div class="row-day"></div>');
        for (let j = 0; j < 7; j++) {
            const day = days[i + j];
            $row.append(`
                <div class="calendar-day" data-date="${localKey(day)}">
                    <span>${day.getDate()}</span>
                    <div class="day-events"></div>
                </div>`);
        }
        $calendar.append($row);
    }
    fillEventsInMonth();
}

// =========================
// NAVEGAÇÃO
// =========================
function initAfterGroupedReady() {
    $('#prevWeek').on('click', () => { if (currentIndex > 0) showWeek(currentIndex - 1); });
    $('#nextWeek').on('click', () => { if (currentIndex < weekKeys.length - 1) showWeek(currentIndex + 1); });
    $('#todayWeek').on('click', () => {
        const index = weekKeys.indexOf(currentWeekKey);
        if (index !== -1) showWeek(index);
    });

    // setDate(1) antes de mudar o mês evita pular mês quando o dia é 29, 30 ou 31
    $('#prevMonth').on('click', () => {
        currentMonthDate.setDate(1);
        currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
        generateMonthView(currentMonthDate);
    });
    $('#nextMonth').on('click', () => {
        currentMonthDate.setDate(1);
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        generateMonthView(currentMonthDate);
    });
    $('#todayMonth').on('click', () => {
        currentMonthDate = new Date();
        generateMonthView(currentMonthDate);
    });

    $('#prevWeek, #nextWeek, #todayWeek').prop('disabled', false);
    $('#prevWeek, #nextWeek, #todayWeek, #monthView').removeClass('btn-disabled');
    $('#week-loader').css('display', 'none');

    $('#listView').on('click', function () {
        $('#month-calendar').css('display', 'none');
        $('#main-calendar').css('display', 'flex');
        $(this).addClass('btn-active-view');
        $('#monthView').removeClass('btn-active-view');
        $('.search-box').css('visibility', 'visible');
        $('#btnWeek').css('display', 'flex');
        $('#btnMonth').css('display', 'none');
        $('.title-week').css('display', 'flex');
        $('.title-month').css('display', 'none');
    });

    $('#monthView').on('click', function () {
        $('#main-calendar').css('display', 'none');
        $('#month-calendar').css('display', 'grid');
        $(this).addClass('btn-active-view');
        $('#listView').removeClass('btn-active-view');
        $('.search-box').css('visibility', 'hidden');
        $('#btnWeek').css('display', 'none');
        $('#btnMonth').css('display', 'flex');
        $('.title-week').css('display', 'none');
        $('.title-month').css('display', 'flex');
    });
}

async function renderWeekFull() {
    weekKeys = Object.keys(groupedByWeek).sort();

    if (!weekKeys.length) {
        $('#main-table').css('display', 'flex').html('<div class="agenda-empty">Nenhuma OS encontrada no período.</div>');
        initAfterGroupedReady();
        return;
    }

    // Semana atual primeiro; se não existir, a mais recente
    const firstKey = groupedByWeek[currentWeekKey] ? currentWeekKey : weekKeys[weekKeys.length - 1];
    await renderWeek(firstKey, groupedByWeek[firstKey], true);
    showWeek(weekKeys.indexOf(firstKey));

    const others = weekKeys.filter(k => k !== firstKey).reverse();
    for (const key of others) {
        await renderWeek(key, groupedByWeek[key], false);
    }

    initAfterGroupedReady();
}

// =========================
// INICIALIZAÇÃO
// =========================
$(document).ready(function () {
    $('body').css('overflow-y', 'scroll');
    $('#calendar').css('display', 'none');
    initTheme();
    createElement();
    createThemeButton();
    bindEvents();
    waitForCalendar(() => {
        sessionStorage.removeItem(TRIES_KEY); // carregou: zera o contador do watchdog
        renderWeekFull();
        generateMonthView(new Date());
    });
});
