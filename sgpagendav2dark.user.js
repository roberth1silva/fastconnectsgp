// ==UserScript==
// @name         SGP Agenda Plus & Design v2 - Dark
// @namespace    http://tampermonkey.net/
// @version      2
// @description  SGP Agenda Plus & Design v2 - Dark
// @author       Roberth
// @match        https://fastconnect.sgp.net.br/admin/atendimento/agenda/view/*
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @resource     REMOTE_CSS https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/assets/sgpstyle.css
// @resource     REMOTE_CSS_DARK https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/assets/sgpstyledark.css
// ==/UserScript==

/* global $ */
$(document).ready(function () {
    const mode_dark = true;
    const allInfo = [];
    $("#calendar").empty();
    const username = '';
    const password = '';
    const basicAuth = 'Basic ' + btoa(username + ':' + password);


    const myCss = GM_getResourceText("REMOTE_CSS");
    GM_addStyle(myCss);

    if(mode_dark)
    {
        const myCssDark = GM_getResourceText("REMOTE_CSS_DARK");
        GM_addStyle(myCssDark);
    }

    let jsonData = [];
    let currentWeekOffset = 0;

    const element = $("script[src='/static/fullcalendar/6.1.11/pt-br.global.min.js']").next();
    const code = element.html();
    const raw = code.split("events: [")[1].split("eventClick: function(info)")[0].trim();
    const rawEventString = raw.slice(0, -2);
    const fullEventString = `[${rawEventString}]`;
    const events = eval(fullEventString);
    const json = JSON.stringify(events);
    const fullJson = JSON.parse(json);
    jsonData = fullJson.map(e => ({
        id: e.id,
        title: e.title,
        date: new Date(e.start)
    }));
    // Modal
    const $modal = $(`<div class="modal">
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
                <a href="/admin/atendimento/ocorrencia/68148/edit/" target="_blank" id="os-id-link"><span id="os-id"></span></a>
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
    // Adiciona container e botões
    const $calendarWrapper = $('<div id="main-calendar" class="main-calendar"><span id="loader" class="loader" class="display: block"></span><div class="table" id="main-table" style="display:none"></div></div>');
    const $controls = $(`
      <div class="menu-box" style="margin: 10px 0;">
        <button class="prev-week" id="prevWeek"><span class="fc-icon fc-icon-chevron-left" role="img"></span></button>
        <button class="next-week" id="nextWeek"><span class="fc-icon fc-icon-chevron-right" role="img"></span></button>
        <div class=search-box>
          <span class="search-button"><i class="fas fa-search"></i></span>
          <input name="search-input" class="search-input" type="text" placeholder="Digite o nome do cliente..." value=""></input>
        </div>
      </div>
    `);
    $("#calendar").before($controls).before($calendarWrapper).before($modal);

    $('#prevWeek').click(() => changeWeek(-1));
    $('#nextWeek').click(() => changeWeek(1));

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    function getDayId(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // meses começam em 0
        const day = String(date.getDate()).padStart(2, '0');
        return `day-${year}-${month}-${day}`; // Ex: day-2025-05-28
    }

    async function renderServices() {
        $('#main-table').css('display', 'none');
        $('#loader').css('display', 'inline-block');
        $('#main-table').empty();
        const now = new Date();
        const weekStart = getStartOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
        const start = new Date(weekStart);
        start.setDate(start.getDate() + 7 * currentWeekOffset);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        const filtered = jsonData.filter(ev => ev.date >= start && ev.date < end).sort((a, b) => a.date - b.date);
        const promises = [];
        const grouped = {};

        filtered.forEach(ev => {
            const date = ev.date;

            const day = date.toLocaleDateString('en-CA');

            const period = date.getHours() < 12 ? 'morning' : 'afternoon';
            if (!grouped[day]) grouped[day] = { morning: [], afternoon: [] };
            grouped[day][period].push(ev);
        });

        Object.entries(grouped).forEach(([day, periods]) => {
            const options = { weekday: 'long', day: '2-digit', month: 'long', year: "numeric" };
            const dayUTC = day + "T00:00:00";
            const dayText = new Date(dayUTC).toLocaleDateString('pt-BR', options).replace(/^./, c => c.toUpperCase()); // capitaliza
            const dayId = day;

            $('#main-table').append(`<div class="day-block" id="day-${dayId}"><span class="title">${dayText}</span></div>`);

            if (periods.morning.length) {
                $(`#day-${dayId}`).append(`<span class="morning">Manhã</span><div class="period" id="morning-${dayId}"></div>`);
                periods.morning.forEach(ev => promises.push(appendService(ev, `morning-${dayId}`)));
            }

            if (periods.afternoon.length) {
                $(`#day-${dayId}`).append(`<span class="afternoon">Tarde</span><div class="period" id="afternoon-${dayId}"></div>`);
                periods.afternoon.forEach(ev => promises.push(appendService(ev, `afternoon-${dayId}`)));
            }
        });
        await Promise.all(promises);
        onClickModal();
        $('#loader').css('display', 'none');
        $('#main-table').css('display', 'flex');
    }

    function onClickModal()
    {
        let clickTimer = null;
        $(".service").on("click", function(e) {
            const id = $(this).data("id");
            const self = this;

            // Aguarda um pouco para ver se vai acontecer um dblclick
            clickTimer = setTimeout(function() {
                fillModal(id);
                $(".modal").css("display", "flex");
            }, 250); // tempo suficiente para o navegador detectar o dblclick
        });

        $(".service").on("dblclick", function() {
            // Se for um duplo clique, cancela o clique simples
            clearTimeout(clickTimer);

            const cod = $(this).data("id");
            const url = `/admin/atendimento/ocorrencia/os/${cod}/edit/`;
            window.open(url, '_blank');
        });
        $(".modal").on("click", function() {
            $(this).css("display", "none");
        });
        $(".modal-content").on("click", function(event) {
            event.stopPropagation();
        });
        $(".modal-close").on("click", function() {
            $(".modal").css("display", "none");
        });
        $(".btn-open-os").on("click", function(event) {
            event.stopPropagation();
        });
        $("#btn-open-os").on("click", function(){
            const cod = $(this).data("id");
            const url = `/admin/atendimento/ocorrencia/os/${cod}/edit/`;
            window.open(url, '_blank');
        });
        $("#btn-print-os").on("click", function(){
            const cod = $(this).data("id");
            const url = `/admin/atendimento/ocorrencia/os/${cod}/print/`;
            window.open(url, '_blank');
        });

        $(".search-input").on("input", function () {
            const termo = $(this).val().toLowerCase();
            if(termo == "")
            {
                $(".morning").show();
                $(".afternoon").show();
            }
            else
            {
                $(".morning").hide();
                $(".afternoon").hide();
            }

            $(".service").each(function () {
                const texto = $(this).text().toLowerCase();

                // Se o texto contém o termo, mostra; senão, esconde
                $(this).toggle(texto.includes(termo));
            });
        });
    }

    function fillModal(id)
    {
        const item = allInfo.find(i => i.id == id);
        $("#title-id-os").text("Ordem de Serviço " + id);
        $("#os-id-link").attr("href", item.ocorrenciaLink);
        $("#os-id").text(item.ocorrenciaText);
        $("#register-date").text(item.dataCadastro);
        $("#register-user").text(item.abertaPor);
        $("#os-status").text(item.situacao);
        $("#schedule-date").text(item.dataAgendamento);
        $("#customer-id").text(item.clienteText);
        $("#customer-id-link").attr("href", item.clienteLink);
        $("#technicians").text(item.tecnicos);
        $("#os-reason").text(item.motivo);
        let conteudo = item.conteudo;
        conteudo = conteudo.replace(/\n/g, "<br>");
        $(".report-problem").html(conteudo);
        $("#finished-date").text(item.dataFinalizacao);
        $("#finished-user").text(item.finalizadoPor);
        $("#btn-open-os").data("id", id);
        $("#btn-print-os").data("id", id);
    }

    function appendService(ev, containerId) {
        return fetchDataFromAPI(ev.id).then(info => {
            const statusMap = {
                "Aberta": "open",
                "Em execução": "executing",
                "Encerrada": "finished"
            };
            const statusClass = statusMap[info.os_status_txt] || 'open';
            const statusLabel = {
                "Aberta": "Em Aberto",
                "Em execução": "Em Execução",
                "Encerrada": "Finalizado"
            }[info.os_status_txt] || "Em Aberto";

            const endereco = `
            ${(info.endereco_logradouro || '')} ${(info.endereco_numero || '')} ${(info.endereco_complemento || '')}<br>
            ${(info.endereco_bairro || '')}, ${(info.endereco_cidade || '')}-${(info.endereco_uf || '')}
        `.trim();

            let tecnicos = '';
            if (info.os_tecnico_responsavel) {
                let nome = info.os_tecnico_responsavel.split(" ")[0];
                tecnicos = nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
            }
            if (Array.isArray(info.os_tecnicos_auxiliares)) {
                info.os_tecnicos_auxiliares.forEach(aux => {
                    const nome = aux.split(" ")[0];
                    tecnicos += ` - ${nome.charAt(0).toUpperCase()}${nome.slice(1).toLowerCase()}`;
                });
            }

            let obs = '';
            if (info.os_conteudo && info.os_conteudo.includes("Obs:")) {
                obs = info.os_conteudo.split("Obs:")[1].trim();
            }
            pushInfo(ev.id, statusLabel, tecnicos, info.os_motivo_descricao, info.os_conteudo);
            const serviceHTML = `
          <div class="service" data-id="${info.os_id}">
            <span class="service-status"><span class="status ${statusClass}">${statusLabel}</span></span>
            <span class="service-time">${ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="service-customer"><strong>${info.cliente}</strong><br>${info.os_motivo_descricao}</span>
            <span class="service-employee">${tecnicos}</span>
            <span class="service-observation">${obs}</span>
            <span class="service-location">${endereco}</span>
            <span class="service-action"><a class="btn btn-dark btn-open-os" href="/admin/atendimento/ocorrencia/os/${info.os_id}/edit/" target="_blank">Abrir OS</a></span>
          </div>`;
            $(`#${containerId}`).append(serviceHTML);
        });
    }

    function pushInfo(id, situacao, tecnicos, motivo, conteudo)
    {
        if (allInfo.find(i => i.id == id)) {
            return;
        }
        $.get(`https://fastconnect.sgp.net.br/admin/atendimento/os/${id}/agenda/evento/`, function(html) {
            const tempDOM = $("<div>").html(html);
            const tds = tempDOM.find("table td");
            const ocorrenciaText = $(tds[1]).text().trim();
            const ocorrenciaLink = $(tds[1]).find("a").attr("href");
            const dataCadastro = $(tds[3]).text().trim();
            let abertaPor = $(tds[5]).text().trim();
            abertaPor = abertaPor.charAt(0).toUpperCase() + abertaPor.slice(1).toLowerCase()
            const dataAgendamento = $(tds[11]).text().trim();
            const clienteText = $(tds[13]).text().trim();
            const clienteLink = $(tds[13]).find("a").attr("href");
            const dataFinalizacao = $(tds[21]).text().trim();
            let finalizadoPor = $(tds[25]).text().trim();
            finalizadoPor = finalizadoPor.charAt(0).toUpperCase() + finalizadoPor.slice(1).toLowerCase()
            allInfo.push({
                id: id,
                ocorrenciaText: ocorrenciaText,
                ocorrenciaLink: ocorrenciaLink,
                dataCadastro: dataCadastro,
                abertaPor: abertaPor,
                situacao: situacao,
                dataAgendamento: dataAgendamento,
                clienteText: clienteText,
                clienteLink: clienteLink,
                dataFinalizacao: dataFinalizacao,
                tecnicos: tecnicos,
                motivo: motivo,
                finalizadoPor: finalizadoPor,
                conteudo: conteudo
            });
        });
    }

    async function fetchDataFromAPI(id) {
        return new Promise(resolve => {
            $.ajax({
                url: `https://fastconnect.sgp.net.br/api/os/list/id/${id}`,
                method: 'POST',
                headers: {
                    'Authorization': basicAuth,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                success: data => resolve(data || {}),
                error: err => {
                    console.error('Erro ao buscar dados:', err);
                    resolve({});
                }
            });
        });
    }

    function changeWeek(offset) {
        currentWeekOffset += offset;
        renderServices();
    }

    renderServices();
});
