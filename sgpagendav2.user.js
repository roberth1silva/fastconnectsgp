// ==UserScript==
// @name         SGP Agenda Plus & Design v2
// @namespace    http://tampermonkey.net/
// @version      2.8
// @description  SGP Agenda Plus & Design v2
// @author       Roberth
// @match        https://fastconnect.sgp.net.br/admin/atendimento/agenda/view/*
// @match        https://fastfibra.sgp.net.br/admin/atendimento/agenda/view/*
// @match        https://sgp.fastconnect.net.br/admin/atendimento/agenda/view/*
// @match        https://sgp.fastfibra.net.br/admin/atendimento/agenda/view/*
// @match        http://45.164.128.5:8000/admin/atendimento/agenda/view/*
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @resource     REMOTE_CSS https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/assets/sgpstyle.css
// @resource     REMOTE_CSS_DARK https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/assets/sgpstyledark.css
// @run-at       document-start
// ==/UserScript==

/* global $ */

const groupedByWeek = {};
const allInfo = [];
const situationDay = {};
const isHoliday = {};
let currentIndex = 0;
let weekKeys = [];
let currentMonthDate = new Date();

function formatarSemanaLabel(weekKey) {
    const [ano, semana] = weekKey.split('-W').map(Number);

    const jan1 = new Date(ano, 0, 1);
    const jan1Day = jan1.getDay();

    const primeiroDomingo = new Date(jan1);
    if (jan1Day !== 0) {
        primeiroDomingo.setDate(jan1.getDate() - jan1Day);
    }

    const inicio = new Date(primeiroDomingo);
    inicio.setDate(primeiroDomingo.getDate() + (semana - 1) * 7);

    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);

    const dia1 = String(inicio.getDate()).padStart(2, '0');
    const dia2 = String(fim.getDate()).padStart(2, '0');
    const mes = fim.toLocaleDateString('pt-BR', { month: 'long' }).toLowerCase();
    const anoTexto = fim.getFullYear();

    return `${dia1} à ${dia2} de ${mes} de ${anoTexto}`;
}

function getWeekKey(dateStr) {
    const date = new Date(dateStr);

    const day = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - day);

    const year = sunday.getFullYear();
    const firstSunday = new Date(year, 0, 1);
    firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());

    const diffDays = Math.floor((sunday - firstSunday) / 86400000);
    const week = Math.floor(diffDays / 7) + 1;

    return `${year}-W${String(week).padStart(2, '0')}`;
}

function groupedEvents(events)
{
    const eventsMap = events.map(e => ({
        id: e.id,
        title: e.title,
        situation: e.is_encerrado,
        holiday: e.is_feriado || false,
        date: new Date(e.start)
    }));
    const eventsSort = eventsMap.sort((a, b) => a.date - b.date);
    eventsSort.forEach(ev => {
        if(ev.id) {
            const key = getWeekKey(ev.date);
            if (!groupedByWeek[key]) {
                groupedByWeek[key] = [];
            }
            groupedByWeek[key].push(ev);
        }
    });
    eventsSort.forEach(ev => {
        const dateKey = ev.date.toISOString().split("T")[0];
        const statusKey = ev.situation ? "encerrado" : "aberto";
        if(ev.holiday)
        {
            isHoliday[dateKey] = { holiday: true, title: ev.title };
        }
        else
        {
            if(!situationDay[dateKey]) {
                situationDay[dateKey] = { encerrado: 0, aberto: 0 };
            }
            situationDay[dateKey][statusKey]++;
        }
    });
}

(function () {
    'use strict';

    let originalRender;

    const hookCalendar = () => {
        if (typeof FullCalendar !== "undefined" && FullCalendar.Calendar) {
            const OriginalCalendar = FullCalendar.Calendar;

            originalRender = OriginalCalendar.prototype.render;
            OriginalCalendar.prototype.render = function () {
                console.log("Bloqueado: calendar.render()");
            };

            FullCalendar.Calendar = function (...args) {
                const options = args[1] || {};

                if (Array.isArray(options.events)) {
                    setTimeout(() => {
                        groupedEvents(options.events);
                    }, 0);
                }

                const calendar = new OriginalCalendar(...args);
                return calendar;
            };

            FullCalendar.Calendar.prototype = OriginalCalendar.prototype;
        } else {
            setTimeout(hookCalendar, 50);
        }
    };

    hookCalendar();

})();

function waitForGroupedEvents(callback) {
    const check = () => {
        if (Object.keys(groupedByWeek).length > 0) {
            callback();
        } else {
            setTimeout(check, 100);
        }
    };
    check();
}

function setStyle(darkMode)
{
    const myCss = GM_getResourceText("REMOTE_CSS"); GM_addStyle(myCss);
    if(darkMode) { const myCssDark = GM_getResourceText("REMOTE_CSS_DARK"); GM_addStyle(myCssDark); }
}

function createElement()
{
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
        <div>
          <span>Dom</span>
        </div>
        <div>
          <span>Seg</span>
        </div>
        <div>
          <span>Ter</span>
        </div>
        <div>
          <span>Qua</span>
        </div>
        <div>
          <span>Qui</span>
        </div>
        <div>
          <span>Sex</span>
        </div>
        <div>
          <span>Sab</span>
        </div>
      </div>
      <div class="row-day">
      </div>
    </div>`);
    $("#calendar").before($controls).before($monthCalendar).before($calendarWrapper).before($modal);
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
    $("body").append($dayModal);

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

function onClickModal()
{
    let clickTimer = null;
    $(".service").on("click", function(e) {
        const id = $(this).data("id");
        const self = this;

        // Aguarda um pouco para ver se vai acontecer um dblclick
        clickTimer = setTimeout(function() {
            fillModal(id);
            $("#modalService").css("display", "flex");
        }, 250); // tempo suficiente para o navegador detectar o dblclick
    });

    $(".service").on("dblclick", function() {
        // Se for um duplo clique, cancela o clique simples
        clearTimeout(clickTimer);

        const cod = $(this).data("id");
        const url = `/admin/atendimento/ocorrencia/os/${cod}/edit/`;
        window.open(url, '_blank');
    });
    $("#modalService").on("click", function() {
        $(this).css("display", "none");
    });
    $(".modal-content").on("click", function(event) {
        event.stopPropagation();
    });
    $(".modal-close").on("click", function() {
        $("#modalService").css("display", "none");
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

    $(document).on("click", ".calendar-day", function () {
        const date = $(this).data("date"); // ex: 2025-06-04
        const morningId = `#morning-${date}`;
        const afternoonId = `#afternoon-${date}`;

        const $body = $(".modal-day-body");
        $body.empty(); // limpa conteúdo anterior

        const $morning = $(morningId).clone().show();
        const $afternoon = $(afternoonId).clone().show();

        if ($morning.length) {
            $body.append($morning);
        }

        if ($afternoon.length) {
            $body.append($afternoon);
        }

        if ($morning.length || $afternoon.length) {
            $(".modal-day").css("display", "flex");
        }
    });


    $("#modalDay").on("click", function() {
        $(this).css("display", "none");
    });
    $(".modal-content").on("click", function(event) {
        event.stopPropagation();
    });
    $(".close-day-modal").on("click", function() {
        $("#modalDay").css("display", "none");
    });


}

function pushInfo(id, situacao, tecnicos, motivo, conteudo)
{
    if (allInfo.find(i => i.id == id)) {
        return;
    }
    $.get(`/admin/atendimento/os/${id}/agenda/evento/`, function(html) {
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
            <span class="service-observation"><strong>Observação da OS:</strong></br>${obs}</span>
            <span class="service-location">${endereco}</span>
            <span class="service-action"><a class="btn btn-dark btn-open-os" href="/admin/atendimento/ocorrencia/os/${info.os_id}/edit/" target="_blank">Abrir OS</a></span>
          </div>`;
        $(`#${containerId}`).append(serviceHTML);
    });
}

async function fetchDataFromAPI(id) {
    return new Promise(resolve => {
        $.ajax({
            url: `/api/os/list/id/${id}`,
            method: 'POST',           
            success: data => resolve(data || {}),
            error: err => {
                console.error('Erro ao buscar dados:', err);
                resolve({});
            }
        });
    });
}

async function renderWeek(weekKey, events) {
    const currentWeekKey = getWeekKey(new Date());
    if(weekKey === currentWeekKey)
    {
        $('#loader').css('display', 'flex');
        $('#week-loader').css('display', 'flex');
        $('#main-table').css('display', 'none');
        $('#main-table').append(`<div class="week-block" id="week-${weekKey}" style="display: flex;"></div>`);
    }
    else
    {
        $('#main-table').append(`<div class="week-block" id="week-${weekKey}" style="display: none;"></div>`);
    }
    const promises = [];
    const grouped = {};

    events.forEach(ev => {
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

        $("#week-" + weekKey).append(`<div class="day-block" id="day-${dayId}"><span class="title">${dayText}</span></div>`);

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
    if(weekKey === currentWeekKey)
    {
        $('#loader').css('display', 'none');
        $('#main-table').css('display', 'flex');
    }
}

const currentWeekKey = getWeekKey(new Date());

function showWeek(index) {
    $(".week-block").hide();
    const key = weekKeys[index];
    $(`#week-${key}`).show();
    $(".title-week").text(formatarSemanaLabel(key));
    currentIndex = index;
}

function fillEventsInMonth() {
    for (const date in isHoliday)
    {
        const $day = $(`.calendar-day[data-date="${date}"] .day-events`);
        const data = isHoliday[date];
        if(data.holiday)
        {
            $day.parent().addClass("calendar-day-holiday");
            $day.append(`<span class="day-status day-holiday">${data.title}</span>`);
        }
    }
    for (const date in situationDay) {
        const $day = $(`.calendar-day[data-date="${date}"] .day-events`);
        const data = situationDay[date];
        if(data.aberto > 0) {
            $day.append(`<span class="day-status day-open">Em Aberto: ${data.aberto}</span>`);
        }

        if(data.encerrado > 0) {
            $day.append(`<span class="day-status day-finished">Encerrado: ${data.encerrado}</span>`);
        }
    }
}


function generateMonthView(referenceDate) {
    console.log(referenceDate);
    const nomeMesAno = referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const nomeMesCapitalizado = nomeMesAno.charAt(0).toUpperCase() + nomeMesAno.slice(1);
    $(".title-month").text(nomeMesCapitalizado);
    const firstDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay()); // começa na segunda

    const end = new Date(lastDay);
    end.setDate(lastDay.getDate() + (6 - end.getDay())); // termina no domingo

    const days = [];
    while (start <= end) {
        days.push(new Date(start));
        start.setDate(start.getDate() + 1);
    }

    const $calendar = $("#month-calendar");
    $calendar.find(".row-day:not(.row-week)").remove();

    for (let i = 0; i < days.length; i += 7) {
        const $row = $('<div class="row-day"></div>');
        for (let j = 0; j < 7; j++) {
            const day = days[i + j];
            const dayKey = day.toISOString().split("T")[0];

            const dayHTML = $(`
                <div class="calendar-day" data-date="${dayKey}">
                    <span>${day.getDate()}</span>
                    <div class="day-events"></div>
                </div>
            `);

            $row.append(dayHTML);
        }
        $calendar.append($row);
    }
    fillEventsInMonth();
}

function initAfterGroupedReady() {
    $("#prevWeek").on("click", () => {
        if (currentIndex > 0) showWeek(currentIndex - 1);
    });
    $("#nextWeek").on("click", () => {
        if (currentIndex < weekKeys.length - 1) showWeek(currentIndex + 1);
    });
    $("#todayWeek").on("click", () => {
        const index = weekKeys.indexOf(currentWeekKey);
        if (index !== -1) showWeek(index);
    });
    $("#prevMonth").on("click", () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
        generateMonthView(currentMonthDate);
    });

    $("#nextMonth").on("click", () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        generateMonthView(currentMonthDate);
    });

    $("#todayMonth").on("click", () => {
        const todayMonthDate = new Date();
        generateMonthView(todayMonthDate);
    });

    $("#prevWeek, #nextWeek, #todayWeek").prop("disabled", false);
    $("#prevWeek, #nextWeek, #todayWeek, #monthView").removeClass("btn-disabled");
    $("#week-loader").css("display", "none");

    $("#listView").on("click", function() {
        $("#month-calendar").css("display", "none");
        $("#main-calendar").css("display", "flex");
        $(this).addClass("btn-active-view");
        $("#monthView").removeClass("btn-active-view");
        $(".search-box").css("visibility", "visible");
        $("#btnWeek").css("display", "flex");
        $("#btnMonth").css("display", "none");
        $(".title-week").css("display", "flex");
        $(".title-month").css("display", "none");
    });

    $("#monthView").on("click", function() {
        $("#main-calendar").css("display", "none");
        $("#month-calendar").css("display", "grid");
        $(this).addClass("btn-active-view");
        $("#listView").removeClass("btn-active-view");
        $(".search-box").css("visibility", "hidden");
        $("#btnWeek").css("display", "none");
        $("#btnMonth").css("display", "flex");
        $(".title-week").css("display", "none");
        $(".title-month").css("display", "flex");
    });
}

async function renderWeekFull() {
    weekKeys = Object.keys(groupedByWeek).sort();
    currentIndex = weekKeys.indexOf(currentWeekKey);
    var outras = weekKeys.filter(k => k !== currentWeekKey).reverse();

    if(groupedByWeek[currentWeekKey])
    {
        await renderWeek(currentWeekKey, groupedByWeek[currentWeekKey]);
        showWeek(currentIndex);
    }
    else
    {
        const newWeekKey = outras[0]
        const newIndex = weekKeys.indexOf(newWeekKey);
        await renderWeek(newWeekKey, groupedByWeek[newWeekKey]);
        showWeek(newIndex);
        outras = outras.filter(k => k !== newWeekKey);
    }

    for (const key of outras) {

        await renderWeek(key, groupedByWeek[key]);
    }

    initAfterGroupedReady();
}

$(document).ready(function () {
    $("body").css("overflow-y", "scroll");
    $("#calendar").css("display", "none");
    setStyle(false);
    createElement();
    waitForGroupedEvents(() => {
        renderWeekFull();
        generateMonthView(new Date());
    });
});
