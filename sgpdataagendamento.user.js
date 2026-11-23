// ==UserScript==
// @name         SGP Data Agendamento
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Botões de busca rápida (Hoje, 15 dias, Mês) e menu Opções com período personalizado
// @author       Roberth e Thiago
// @match        https://fastconnect.sgp.net.br/admin/atendimento/agenda/view/*
// @match        https://fastfibra.sgp.net.br/admin/atendimento/agenda/view/*
// @match        https://sgp.fastconnect.net.br/admin/atendimento/agenda/view/*
// @match        https://sgp.fastfibra.net.br/admin/atendimento/agenda/view/*
// @match        http://45.164.128.5:8000/admin/atendimento/agenda/view/*
// @match        http://192.168.5.24:8000/admin/atendimento/agenda/view/*
// @grant        none
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// ==/UserScript==

(function ($) {
    'use strict';

    // Parâmetros fixos que o SGP espera junto com as datas
    const BASE_PARAMS = {
        omitir_colunas: 'conclusao_checklist',
        exibir_periodo: 'listWeek',
        recurso: '1',
        recurso_orientacao: 'resourceTimelineDay'
    };
    const STORE_KEY = 'sgpAgendaCustomRange';

    // ---------- helpers de data ----------
    const pad = n => String(n).padStart(2, '0');
    const fmtBR = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const fromISO = s => {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    // O nome do campo "final" é lido do próprio formulário; se não existir, usa o padrão do Django
    const finalFieldName = () =>
        $('#id_data_agendamento_final').attr('name') || 'data_agendamento_final';

    function buildUrl(ini, fim) {
        const p = new URLSearchParams();
        p.set('data_agendamento_inicial', fmtBR(ini));
        if (fim) p.set(finalFieldName(), fmtBR(fim));
        Object.entries(BASE_PARAMS).forEach(([k, v]) => p.set(k, v));
        return location.pathname + '?' + p.toString();
    }

    // ---------- último período personalizado ----------
    function loadLast() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
    }
    function saveLast(range) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(range)); } catch (e) { /* ignora */ }
    }
    const rangeLabel = r =>
        `${fmtBR(fromISO(r.ini))} → ${r.fim ? fmtBR(fromISO(r.fim)) : 'sem data final'}`;

    // ---------- estilo ----------
    $('head').append(`<style>
        .sgp-opts-wrap { position: relative; display: inline-block; }
        .sgp-opts-menu { display: none; position: absolute; top: 100%; left: 0; margin-top: 4px; min-width: 260px;
            background: #2b2b2b; border: 1px solid #555; border-radius: 6px; z-index: 9999;
            box-shadow: 0 6px 18px rgba(0,0,0,.45); overflow: hidden; }
        .sgp-opts-menu a { display: block; padding: 9px 14px; color: #eee !important; text-decoration: none; font-size: 13px; cursor: pointer; }
        .sgp-opts-menu a:hover { background: #3a3a3a; }
        .sgp-opts-menu .sgp-sep { border-top: 1px solid #444; }

        .sgp-overlay { display: none; position: fixed; inset: 0; z-index: 10000; align-items: center; justify-content: center;
            background: rgba(0,0,0,.6); }
        .sgp-dialog { width: 360px; max-width: 92vw; padding: 20px; background: #2b2b2b; color: #eee; border: 1px solid #555;
            border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.6); font-size: 14px; }
        .sgp-dialog h3 { margin: 0 0 14px; font-size: 17px; color: #fff; }
        .sgp-dialog label { display: block; margin-bottom: 12px; font-weight: 600; }
        .sgp-dialog small { font-weight: 400; opacity: .7; }
        .sgp-dialog .sgp-row { display: flex; gap: 8px; margin-top: 5px; }
        .sgp-dialog input[type=date] { flex: 1; padding: 7px 8px; background: #1f1f1f; color: #fff; border: 1px solid #555;
            border-radius: 4px; color-scheme: dark; }
        .sgp-dialog input[type=date]:focus { outline: 2px solid #f57c00; border-color: #f57c00; }
        .sgp-dialog .sgp-hint { margin: 0 0 8px; font-size: 12px; opacity: .7; }
        .sgp-dialog .sgp-error { min-height: 16px; margin: 0 0 8px; font-size: 12px; color: #ff8a80; }
        .sgp-dialog .sgp-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .sgp-dialog button { padding: 7px 14px; border: 0; border-radius: 4px; cursor: pointer; font-weight: 700; background: #555; color: #fff; }
        .sgp-dialog button.sgp-go { background: #f57c00; }
        .sgp-dialog button.sgp-clear { padding: 7px 10px; font-weight: 400; }
    </style>`);

    // ---------- popup "Personalizado" ----------
    const $overlay = $(`
        <div class="sgp-overlay" id="sgpCustomOverlay">
            <div class="sgp-dialog" role="dialog" aria-modal="true" aria-label="Período personalizado">
                <h3>Período personalizado</h3>
                <label>Data de agendamento inicial
                    <div class="sgp-row"><input type="date" id="sgpIni"></div>
                </label>
                <label>Data de agendamento final <small>(opcional)</small>
                    <div class="sgp-row">
                        <input type="date" id="sgpFim">
                        <button type="button" class="sgp-clear" id="sgpFimClear">Limpar</button>
                    </div>
                </label>
                <p class="sgp-hint">Deixe a data final em branco para não limitar o fim do período.</p>
                <p class="sgp-error" id="sgpErr"></p>
                <div class="sgp-actions">
                    <button type="button" id="sgpCancel">Cancelar</button>
                    <button type="button" class="sgp-go" id="sgpGo">Buscar</button>
                </div>
            </div>
        </div>`);

    function closeDialog() { $overlay.css('display', 'none'); }

    function openDialog() {
        const last = loadLast();
        $('#sgpIni').val(last?.ini || toISO(new Date()));
        $('#sgpFim').val(last?.fim || '');
        $('#sgpErr').text('');
        $overlay.css('display', 'flex');
        $('#sgpIni').trigger('focus');
    }

    function submitDialog() {
        const ini = $('#sgpIni').val();
        const fim = $('#sgpFim').val();
        if (!ini) { $('#sgpErr').text('Informe a data inicial.'); return; }
        if (fim && fim < ini) { $('#sgpErr').text('A data final não pode ser anterior à inicial.'); return; }
        saveLast({ ini, fim });
        location.href = buildUrl(fromISO(ini), fim ? fromISO(fim) : null);
    }

    // ---------- menu "Opções" ----------
    function renderMenu() {
        const last = loadLast();
        let html = `<a data-act="custom">📅 Personalizado…</a>`;
        if (last?.ini) {
            html += `<a class="sgp-sep" data-act="last">↺ Último: ${rangeLabel(last)}</a>`;
        }
        if ($('#linkadd').length) {
            html += `<a class="sgp-sep" data-act="default">🔎 Consulta padrão do SGP</a>`;
        }
        $('#sgpOptsMenu').html(html);
    }

    $(function () {
        // Preenche a data com hoje apenas quando a página abriu sem período na URL
        // (antes sobrescrevia o campo mesmo em "Mês" e "15 dias", mostrando uma data que não era a da busca)
        const params = new URLSearchParams(location.search);
        if (!params.has('data_agendamento_inicial')) {
            $('#id_data_agendamento_inicial').val(new Date().toLocaleDateString('pt-BR'));
        }
        $('#id_exibir_periodo').val('listWeek').change();
        $('.search-report-right').hide();

        const today = new Date();
        const m15 = new Date();
        m15.setDate(m15.getDate() - 15);
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // "Consultar" (#linkadd) fica oculto e o botão Opções assume o lugar dele.
        // Cada .after() empurra o anterior para a direita; a ordem final é: Opções, Mês, 15 dias, Hoje
        const $anchor = $('#linkadd');
        $anchor.before(`
            <span class="sgp-opts-wrap">
                <a class="button" id="sgpOptsBtn" href="#" style="background-color:#546e7a;color:white;">⚙️ Opções ▾</a>
                <div class="sgp-opts-menu" id="sgpOptsMenu"></div>
            </span>`);
        $anchor.hide();
        $anchor.after(`<a class="button orange" href="${buildUrl(today)}">Hoje</a>`);
        $anchor.after(`<a class="button cyan" style="background-color:#00bcd4;color:white;" href="${buildUrl(m15)}">15 dias</a>`);
        $anchor.after(`<a class="button green" href="${buildUrl(firstOfMonth)}">Mês</a>`);

        $('body').append($overlay);

        // Menu: abrir/fechar
        $('#sgpOptsBtn').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            renderMenu();
            $('#sgpOptsMenu').toggle();
        });
        $(document).on('click', () => $('#sgpOptsMenu').hide());

        $('#sgpOptsMenu').on('click', 'a', function () {
            const act = $(this).data('act');
            $('#sgpOptsMenu').hide();
            if (act === 'custom') {
                openDialog();
            } else if (act === 'default') {
                $('#linkadd')[0].click(); // aciona o "Consultar" original, mesmo oculto
            } else if (act === 'last') {
                const last = loadLast();
                if (last?.ini) location.href = buildUrl(fromISO(last.ini), last.fim ? fromISO(last.fim) : null);
            }
        });

        // Popup
        $('#sgpGo').on('click', submitDialog);
        $('#sgpCancel').on('click', closeDialog);
        $('#sgpFimClear').on('click', () => $('#sgpFim').val('').trigger('focus'));
        $overlay.on('click', function (e) { if (e.target === this) closeDialog(); });
        $overlay.on('keydown', 'input', e => { if (e.key === 'Enter') submitDialog(); });
        $(document).on('keydown', e => {
            if (e.key === 'Escape') { closeDialog(); $('#sgpOptsMenu').hide(); }
        });
    });

})(jQuery);
