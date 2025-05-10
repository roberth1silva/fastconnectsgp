// ==UserScript==
// @name         SGP Schedule Design
// @namespace    http://tampermonkey.net/
// @version      2025-05-10
// @description  SGP Schedule Design
// @author       You
// @match        https://fastconnect.sgp.net.br/admin/atendimento/agenda/view/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=net.br
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// ==/UserScript==
/* global $ */

$(document).ready(function(){



    const statusElement = document.getElementById("fc-dom-1");

    const observer = new MutationObserver(() => {
        console.log("Elemento alterado!");
        minhaFuncao();
    });

    observer.observe(statusElement, {
        childList: true,
        characterData: true,
        subtree: true,
    });

    let svgCheckbox = '<svg width="20px" height="20px" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<path fill="#4c4c4c" d="M18.25,3 C19.7687831,3 21,4.23121694 21,5.75 L21,18.25 C21,19.7687831 19.7687831,21 18.25,21 L5.75,21 C4.23121694,21 3,19.7687831 3,18.25 L3,5.75 C3,4.23121694 4.23121694,3 5.75,3 L18.25,3 Z M18.25,4.5 L5.75,4.5 C5.05964406,4.5 4.5,5.05964406 4.5,5.75 L4.5,18.25 C4.5,18.9403559 5.05964406,19.5 5.75,19.5 L18.25,19.5 C18.9403559,19.5 19.5,18.9403559 19.5,18.25 L19.5,5.75 C19.5,5.05964406 18.9403559,4.5 18.25,4.5 Z M10,14.4393398 L16.4696699,7.96966991 C16.7625631,7.6767767 17.2374369,7.6767767 17.5303301,7.96966991 C17.7965966,8.23593648 17.8208027,8.65260016 17.6029482,8.94621165 L17.5303301,9.03033009 L10.5303301,16.0303301 C10.2640635,16.2965966 9.84739984,16.3208027 9.55378835,16.1029482 L9.46966991,16.0303301 L6.46966991,13.0303301 C6.1767767,12.7374369 6.1767767,12.2625631 6.46966991,11.9696699 C6.73593648,11.7034034 7.15260016,11.6791973 7.44621165,11.8970518 L7.53033009,11.9696699 L10,14.4393398 L16.4696699,7.96966991 L10,14.4393398 Z"></path>' +
        '</svg>';
    let svgBox = '<svg width="20px" height="20px" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<path fill="#3788d8" d="M5.75,3 L18.25,3 C19.7687831,3 21,4.23121694 21,5.75 L21,18.25 C21,19.7687831 19.7687831,21 18.25,21 L5.75,21 C4.23121694,21 3,19.7687831 3,18.25 L3,5.75 C3,4.23121694 4.23121694,3 5.75,3 Z M5.75,4.5 C5.05964406,4.5 4.5,5.05964406 4.5,5.75 L4.5,18.25 C4.5,18.9403559 5.05964406,19.5 5.75,19.5 L18.25,19.5 C18.9403559,19.5 19.5,18.9403559 19.5,18.25 L19.5,5.75 C19.5,5.05964406 18.9403559,4.5 18.25,4.5 L5.75,4.5 Z"></path>' +
        '</svg>';
    let statusFinished = "<span style='color: #4c4c4c; background: #e5e7eb; padding: 7px; border-radius: 7px; font-weight: bold;'>Finalizado</span>";
    let statusOpen = "<span style='color: #3788d8; background: #dbeafe; padding: 7px; border-radius: 7px; font-weight: bold;'>Em Aberto</span>";

    function minhaFuncao() {
        $(".fc-list-day > th").attr("colspan", "4");

        $(".feriado-title").each(function(){
            $(this).parent().attr("colspan", "2");
        });

        $(".fc-separador").each(function(){
            $(this).remove();
        });

        $(".fc-list-event-time").each(function(){
            $(this).css("font-size", "1.1rem");
            $(this).css("line-height", "2");
            $(this).css("text-align", "right");
        });

        let splitDay = false;
        $("tr").each(function(){
            if($(this).hasClass('fc-list-day'))
            {
                splitDay = false;
            }
            let elementOS = $(this);
            let hour = elementOS.children().eq(0).html();
            if(hour.split(":")[0] > 12 && splitDay == false)
            {
                $(this).prev().after("<tr class='fc-list-day fc-day fc-day-fri fc-day-today fc-separador'><th style='background: #E9D502; color: #E9D502; height: 7px;' colspan='4'></th></tr>");
                splitDay = true;
            }
            let elementDot = $(this).children().eq(1).children();
            let svg = "";
            if(elementDot.css("border-color") == "rgb(76, 76, 76)")
            {
                elementDot.removeClass("fc-list-event-dot");
                elementDot.append(svgCheckbox);
                $(this).prepend("<td style='padding: 15px;' width='7%'>" + statusFinished + "</td>");
            }
            else if(elementDot.css("border-color") == "rgb(55, 136, 216)")
            {
                elementDot.removeClass("fc-list-event-dot");
                elementDot.append(svgBox);
                $(this).prepend("<td style='padding: 15px;' width='7%'>" + statusOpen + "</td>");
            }
        });
    }
    minhaFuncao();
});
