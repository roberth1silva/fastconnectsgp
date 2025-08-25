// ==UserScript==
// @name         SGP Textarea
// @namespace    http://tampermonkey.net/
// @version      2025-08-25
// @description  SGP Textarea
// @author       Roberth
// @match        https://fastconnect.sgp.net.br/admin/atendimento/ocorrencia/os/*
// @match        https://fastfibra.sgp.net.br/admin/atendimento/ocorrencia/os/*
// @match        https://sgp.fastconnect.net.br/admin/atendimento/ocorrencia/os/*
// @match        https://sgp.fastfibra.net.br/admin/atendimento/ocorrencia/os/*
// @match        http://45.164.128.5:8000/admin/atendimento/ocorrencia/os/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// ==/UserScript==
/* global $ */

var innerHeight_conteudo = $('#id_conteudo').prop('scrollHeight');
$('#id_conteudo').height(innerHeight_conteudo);

var innerHeight_servicoprestado = $('#id_servicoprestado').prop('scrollHeight');
$('#id_servicoprestado').height(innerHeight_servicoprestado);


