// ==UserScript==
// @name         Preenchimento OS
// @namespace    http://tampermonkey.net/
// @version      2025-01-15 3.2
// @description  Croqui OS
// @author       Thiago
// @match        https://fastconnect.sgp.net.br/admin/atendimento/cliente/*/ocorrencia/add/
// @match        http://45.164.128.5:8000/admin/atendimento/cliente/*/ocorrencia/add/
// @match        https://45.164.128.5:8000/admin/atendimento/cliente/*/ocorrencia/add/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=net.br
// ==/UserScript==
/* global $ */
var scriptElem = document.createElement('script');
var scriptHTML = "";
scriptHTML += "$('#id_tipo').change(function(){";
scriptHTML += "if($('#id_conteudo').val() == '') {";
scriptHTML += "if($(this).val() == 123) {";
scriptHTML += "$('#id_conteudo').val($('#id_conteudo_B').val());";
scriptHTML += "} else if($(this).val() == 124) {";
scriptHTML += "$('#id_conteudo').val($('#id_conteudo_C').val());";
scriptHTML += "} else if($(this).val() == 131) {";
scriptHTML += "$('#id_conteudo').val($('#id_conteudo_D').val());";
scriptHTML += "} else {";
scriptHTML += "$('#id_conteudo').val($('#id_conteudo_A').val());";
scriptHTML += "}";
scriptHTML += "} else { console.log('Campo do Conteúdo com informações'); }";
scriptHTML += "var innerHeight_conteudo = $('#id_conteudo').prop('scrollHeight');";
scriptHTML += "$('#id_conteudo').height(innerHeight_conteudo);";
scriptHTML += "});";
scriptElem.innerHTML = scriptHTML;
document.body.appendChild(scriptElem);
(function() {
    'use strict';

    // Função para buscar o campo "Conteúdo" e preenchê-lo
    function preencherConteudo()
	{
		var preenchimentoA = '';
        var preenchimentoB = '';
        var preenchimentoC = '';
		var preenchimentoD = '';
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
                    preenchimentoA += 'Etiqueta (ID Cliente): ' + idCliente + '\n';
					preenchimentoA += 'Responsável: ' + responsavel + '\n';
					preenchimentoA += 'Plano Desejado: \n';
					preenchimentoA += 'Contrato Físico: \n';
					preenchimentoA += 'Rede Neutra: \n';
					preenchimentoA += 'Equipamento: \n';					
					preenchimentoA += 'Ponto Adicional: \n';
					preenchimentoA += 'Endereço: \n';
					preenchimentoA += 'Serviço: \n';
					preenchimentoA += 'Relato Atendimento: \n';
					preenchimentoA += 'Forma de pagamento: \n';
					preenchimentoA += 'Obs: ';
                    $('body').append("<textarea hidden id='id_conteudo_A'></textarea>");
					$('#id_conteudo_A').val(preenchimentoA);
					if ($('#id_conteudo_A').attr('contentEditable') === 'true')
					{
						$('#id_conteudo_A').html(preenchimentoA);
					}
					console.log('Campo A criado com Sucesso!');
                    preenchimentoB += 'Pós-venda INSTALAÇÃO/TRANSFERÊNCIA\n';
                    preenchimentoB += 'Como você avalia o atendimento prestado pela empresa até o momento:\n';
                    preenchimentoB += '(   ) BOM (   ) RUIM – NOTA 10\n';
                    preenchimentoB += 'A INSTALAÇÃO foi feita de maneira correta?\n';
                    preenchimentoB += '(   ) SIM (   ) NÃO\n';
                    preenchimentoB += 'O atendimento e as informações passadas pelo técnico foi?\n';
                    preenchimentoB += '(   ) BOM (   ) RUIM\n';
                    preenchimentoB += 'Os equipamentos foram instalados no local solicitado?\n';
                    preenchimentoB += '(   ) SIM (   ) NÃO\n';
                    preenchimentoB += 'O nosso serviço atendeu a suas expectativas?\n';
                    preenchimentoB += '(   ) SIM (   ) NÃO\n';
                    preenchimentoB += 'Você indicaria nossos serviços?\n';
                    preenchimentoB += '(   ) SIM (   ) NÃO\n';
                    preenchimentoB += '• Benefício de indicação – OK\n';
                    preenchimentoB += '• Aplicativo financeiro – OK\n';
                    preenchimentoB += '• Informação financeiro – OK\n';
                    preenchimentoB += '• Clube certo – OK';
                    $('body').append("<textarea hidden id='id_conteudo_B'></textarea>");
					$('#id_conteudo_B').val(preenchimentoB);
					if ($('#id_conteudo_B').attr('contentEditable') === 'true')
					{
						$('#id_conteudo_B').html(preenchimentoB);
					}
					console.log('Campo B criado com Sucesso!');
                    preenchimentoC += 'PÓS-VENDA VISITA TÉCNICA/ADEQUAÇÃO\n';
                    preenchimentoC += 'Como você avalia o atendimento prestado pela empresa até o momento:\n';
                    preenchimentoC += '(   )BOM (   ) RUIM – NOTA 10\n';
                    preenchimentoC += 'A VISITA TÉCNICA foi feita de maneira correta?\n';
                    preenchimentoC += '(  ) SIM (   ) NÃO\n';
                    preenchimentoC += 'O atendimento e as informações passadas pelo técnico foi?\n';
                    preenchimentoC += '(  ) BOM (   ) RUIM\n';
                    preenchimentoC += 'Após a visita técnica, o problema foi solucionado?\n';
                    preenchimentoC += '(  ) SIM (   ) NÃO\n';
                    preenchimentoC += 'O novo plano atendeu a suas expectativas?\n';
                    preenchimentoC += '(  ) SIM (   ) NÃO\n';
                    preenchimentoC += 'Você indicaria nossos serviços?\n';
                    preenchimentoC += '(  ) SIM (   ) NÃO\n';
                    preenchimentoC += '• Benefício de indicação – OK\n';
                    preenchimentoC += '• Aplicativo financeiro – OK\n';
                    preenchimentoC += '• Informação financeiro – OK\n';
                    preenchimentoC += '• Clube certo – OK';
                    $('body').append("<textarea hidden id='id_conteudo_C'></textarea>");
					$('#id_conteudo_C').val(preenchimentoC);
					if ($('#id_conteudo_C').attr('contentEditable') === 'true')
					{
						$('#id_conteudo_C').html(preenchimentoC);
					}
					console.log('Campo C criado com Sucesso!');
					preenchimentoD += 'SERVIÇO DE REDE \n';
					preenchimentoD += 'Endereço: \n';
					preenchimentoD += 'Relato: \n';
					preenchimentoD += 'Serviço: \n';
					preenchimentoD += 'Obs: ';					
                    			$('body').append("<textarea hidden id='id_conteudo_D'></textarea>");
					$('#id_conteudo_D').val(preenchimentoD);
					if ($('#id_conteudo_D').attr('contentEditable') === 'true')
					{
						$('#id_conteudo_D').html(preenchimentoD);
					}
					console.log('Campo D criado com Sucesso!');
				}
                else
				{
                    console.log('Não foi possivel criar os campos!');
                }

            }, 0); // Espera 0,5 segundos antes de preencher os campos
        });
    }

    // Chama a função para preencher o conteúdo
    preencherConteudo();
})();
