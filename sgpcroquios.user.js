// ==UserScript==
// @name         Preenchimento OS
// @namespace    http://tampermonkey.net/
// @version      2024-12-28
// @description  Croqui OS
// @author       Thiago
// @match        https://fastconnect.sgp.net.br/admin/atendimento/cliente/*/ocorrencia/add/
// @match        http://45.164.128.5:8000/admin/atendimento/cliente/*/ocorrencia/add/
// @match        https://45.164.128.5:8000/admin/atendimento/cliente/*/ocorrencia/add/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=net.br
// ==/UserScript==
/* global $ */
var scriptElem = document.createElement('script');
scriptElem.innerHTML = "$('#id_tipo').change(function(){ if($(this).val() == 123 || $(this).val() == 124) { $('#id_conteudo').val(''); } });";
document.body.appendChild(scriptElem);
(function() {
    'use strict';

    // Função para buscar o campo "Conteúdo" e preenchê-lo
    function preencherConteudo()
	{
		var preenchimento = '';
		var cliente;
		var idCliente;
		var cpf_cnpj;
		var responsavel = '';
		var x = 1;
        // Esperar até que o DOM da página esteja completamente carregado
        window.addEventListener('load', function()
		{
            // Atraso para garantir que os elementos da página sejam carregados
            setTimeout(function()
			{
				$('.tbold').each(function()
				{
					if(x == 1)
					{
						idCliente = $(this).html();
					}
					else if(x == 2)
					{
						cliente = $(this).html();
					}
					else if(x == 3)
					{
						cpf_cnpj = $(this).html();
						if(cpf_cnpj.length == 17)
						{
							let aux = cliente.split(' ');
							responsavel = aux[0] + ' ' + aux[1];
						}
					}
					x += 1;
				});
				let campoConteudo = $('#id_conteudo');
				if (campoConteudo)
				{
                    preenchimento += 'Etiqueta (ID Cliente): ' + idCliente + '\n';
					preenchimento += 'Responsável: ' + responsavel + '\n';
					preenchimento += 'Plano Desejado: \n';
					preenchimento += 'Contrato Físico: \n';
					preenchimento += 'Endereço: \n';
					preenchimento += 'Serviço: \n';
					preenchimento += 'Relato Atendimento: \n';
					preenchimento += 'Forma de pagamento: \n';
					preenchimento += 'Obs: \n';
					campoConteudo.val(preenchimento);
					if (campoConteudo.contentEditable === 'true')
					{
						campoConteudo.innerHTML = preenchimento;
					}
					console.log('Campo Conteúdo preenchido automaticamente!');
					var innerHeight_conteudo = $('#id_conteudo').prop('scrollHeight');
					$('#id_conteudo').height(innerHeight_conteudo);
				}
                else
				{
                    console.log('Campo Conteúdo não encontrado!');
                }

            }, 0); // Espera 0,5 segundos antes de preencher os campos
        });
    }

    // Chama a função para preencher o conteúdo
    preencherConteudo();
})();