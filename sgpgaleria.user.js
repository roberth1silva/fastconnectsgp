// ==UserScript==
// @name         SGP Galeria
// @namespace    http://tampermonkey.net/
// @version      2024-10-18
// @description  SGP Galeria
// @author       Roberth
// @match        https://fastconnect.sgp.net.br/admin/atendimento/ocorrencia/os/*
// @match        http://45.164.128.5:8000/admin/atendimento/ocorrencia/os/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/lightgallery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/plugins/video/lg-video.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/plugins/thumbnail/lg-thumbnail.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/plugins/zoom/lg-zoom.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/plugins/rotate/lg-rotate.min.js
// @resource     REMOTE_CSS https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/css/lightgallery-bundle.min.css
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @downloadURL  https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/sgpgaleria.user.js
// @updateURL    https://raw.githubusercontent.com/roberth1silva/fastconnectsgp/refs/heads/main/sgpgaleria.user.js
// ==/UserScript==
/* global $ */

$(document).ready(function(){
    let x = 0;
    $("span:contains('Anexos')").parent().next().find("a").each(function(index){
        if(x == 0)
        {
            $(this).parent().parent().parent().prepend("<div id='newgallery' style='display: none;'></div><a id='opengallery' class='button blue'> Abrir Galeria </a>");
        }
        let text = $(this).html();
        let extension = text.split('.').pop();
        let img = $(this).attr('href');
        if(extension != '')
        {
            if(extension == 'mp4')
            {
                let video = '{"source": [{"src":"' + img + '", "type":"video/mp4"}], "attributes": {"preload": false, "playsinline": true, "controls": true}}';
                $("#newgallery").append("<a data-video='" + video + "'><img class='galleryimg" + x + "' src='/static/all/img/logo/menu-logo.svg?v=3.0'></a>");
            }
            else
            {
                $("#newgallery").append("<a href=" + img + "><img class='galleryimg" + x + "' src='" + img + "'></a>");
            }
            x = x + 1;
        }
    });

    lightGallery(document.getElementById('newgallery'), {
        licenseKey: 'your_license_key',
        thumbnail: true,
        infiniteZoom: true,
        zoom: true,
        showZoomInOutIcons: true,
        plugins: [lgVideo, lgZoom, lgThumbnail]
    });

    const myCss = GM_getResourceText("REMOTE_CSS");
    GM_addStyle(myCss);
    GM_addStyle(".light-icon { font-size: 20px; }");
    GM_addStyle(".lg-prev:after { content:none; }");
    GM_addStyle(".lg-next:before { content:none; }");
    GM_addStyle(".lg-icon.lg-zoom-in:after { content:none; }");
    GM_addStyle(".lg-toolbar .lg-download:after { content:none; }");
    GM_addStyle(".lg-toolbar .lg-close:after { content:none; }");
    GM_addStyle(".lg-icon.lg-zoom-out:after { content:none; }");

    $("#opengallery").on("click", function() {
        $(".galleryimg0").trigger("click");
    });

    $("#lg-prev-1").html("<i class='light-icon fa fa-chevron-left'></i>");
    $("#lg-next-1").html("<i class='light-icon fa fa-chevron-right'></i>");
    $("#lg-zoom-in-1").html("<i class='light-icon fa fa-search-plus'></i>");
    $("#lg-zoom-out-1").html("<i class='light-icon fa fa-search-minus'></i>");
    $("#lg-actual-size-1").html("<i class='light-icon fa fa-search'></i>");
    $("#lg-download-1").html("<i class='light-icon fa fa-download'></i>");
    $("#lg-close-1").html("<i class='light-icon fa fa-times'></i>");
});
