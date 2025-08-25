// ==UserScript==
// @name         SGP Data Agendamento
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  SGP Data Agendamento
// @author       Roberth e Thiago
// @match        https://fastconnect.sgp.net.br/admin/atendimento/agenda/view/*
// @match        https://fastfibra.sgp.net.br/admin/atendimento/agenda/view/*
// @match        https://sgp.fastconnect.net.br/admin/atendimento/agenda/view/*
// @match        https://sgp.fastfibra.net.br/admin/atendimento/agenda/view/*
// @match        http://45.164.128.5:8000/admin/atendimento/agenda/view/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=net.br
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// ==/UserScript==
/* global $ */

var data = new Date();
var dataAtual = data.toLocaleDateString('pt-BR');

$('#id_data_agendamento_inicial').val(dataAtual);
$('#id_exibir_periodo').val('listWeek').change();

$('.search-report-right').css('display', 'none');

$(document).ready(function(){
    var data = new Date();
    var diaAtual = data.getDate();
    var mesAtual = data.getMonth() + 1;
    var anoAtual = data.getFullYear();

    // Hoje
    var hoje = diaAtual + '%2F' + mesAtual + '%2F' + anoAtual;

    // Primeiro dia do mês
    var mes = '01%2F' + mesAtual + '%2F' + anoAtual;

    // 15 dias atrás
    var dataMenos15 = new Date();
    dataMenos15.setDate(dataMenos15.getDate() - 15);
    var dia15 = dataMenos15.getDate();
    var mes15 = dataMenos15.getMonth() + 1;
    var ano15 = dataMenos15.getFullYear();
    var quinzeDias = dia15 + '%2F' + mes15 + '%2F' + ano15;

    // URLs com data inicial
    var urlHoje = '?data_agendamento_inicial=' + hoje + '&omitir_colunas=conclusao_checklist&exibir_periodo=listWeek&recurso=1&recurso_orientacao=resourceTimelineDay';
    var urlMes = '?data_agendamento_inicial=' + mes + '&omitir_colunas=conclusao_checklist&exibir_periodo=listWeek&recurso=1&recurso_orientacao=resourceTimelineDay';
    var url15 = '?data_agendamento_inicial=' + quinzeDias + '&omitir_colunas=conclusao_checklist&exibir_periodo=listWeek&recurso=1&recurso_orientacao=resourceTimelineDay';

    // Botões na ordem: Mês, 15 dias, Hoje
    $('#linkadd').after('<a class="button orange" href="' + urlHoje +'">Hoje</a>');
    $('#linkadd').after('<a class="button cyan" style="background-color:#00bcd4; color:white;" href="' + url15 +'">15 dias</a>');
    $('#linkadd').after('<a class="button green" href="' + urlMes +'">Mês</a>');
});
