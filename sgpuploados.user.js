
// ==UserScript==
// @name         SGP - Upload Anexos OS
// @namespace    local.os.upload
// @version      1.1.0
// @author       Roberth
// @description  Upload múltiplo de anexos com arrastar e soltar
// @match        *://*/admin/atendimento/ocorrencia/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const ID = 'os-multi-upload';

    // Evita duplicar a interface.
    if (document.getElementById(ID)) return;

    // Localiza a estrutura da ocorrência.
    const osContainer = document.querySelector('#os-assinaturas');
    if (!osContainer) return;

    // Localiza o título de anexos.
    const anexosTitle = [
        ...osContainer.querySelectorAll('.add_title_sub')
    ].find(el => el.textContent.trim().includes('Anexos'));

    if (!anexosTitle) return;

    // Localiza o link original do formulário de anexos.
    const addLink = osContainer.querySelector(
        'a[href*="/anexo/add/"]'
    ) || anexosTitle.querySelector(
        'a[href*="/anexo/add/"]'
    );

    if (!addLink) {
        console.warn('[OS Upload] Link /anexo/add/ não encontrado.');
        return;
    }

    const uploadUrl = new URL(addLink.href, location.href).href;

    const files = [];
    let uploading = false;

    // Estilos.
    const style = document.createElement('style');

    style.textContent = `
        #${ID} {
            margin: 12px 0;
            padding: 14px;
            border: 1px solid #ccc;
            border-radius: 6px;
            background: #f8f9fa;
            font-family: Arial, sans-serif;
        }

        #${ID} .drop-area {
            padding: 25px 15px;
            border: 2px dashed #999;
            border-radius: 6px;
            background: white;
            text-align: center;
            cursor: pointer;
            transition: .2s;
        }

        #${ID} .drop-area.dragover {
            border-color: #198754;
            background: #e8f5ed;
        }

        #${ID} .drop-area strong {
            display: block;
            margin-bottom: 6px;
            font-size: 14px;
        }

        #${ID} .hint {
            color: #777;
            font-size: 12px;
        }

        #${ID} .file-list {
            margin-top: 10px;
        }

        #${ID} .file-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px;
            border-bottom: 1px solid #ddd;
            font-size: 12px;
        }

        #${ID} .file-name {
            flex: 1;
            overflow-wrap: anywhere;
        }

        #${ID} .file-status {
            min-width: 90px;
            text-align: right;
        }

        #${ID} .remove-file {
            border: 0;
            background: none;
            color: #c33;
            cursor: pointer;
            font-size: 16px;
        }

        #${ID} .actions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-top: 12px;
        }

        #${ID} button.upload-btn {
            display: flex;
            width: 100%;
            text-align: center;
            justify-content: center;
            padding: 8px 18px;
            border: 0;
            border-radius: 4px;
            background: #198754;
            color: white;
            cursor: pointer;
        }

        #${ID} button:disabled {
            opacity: .5;
            cursor: not-allowed;
        }

        #${ID} .progress-text {
            display: flex;
            width: 100%;
            font-size: 12px;
            color: #555;
        }

        #${ID} .success {
            color: #198754;
        }

        #${ID} .error {
            color: #dc3545;
        }
    `;

    document.head.appendChild(style);

    // Interface.
    const panel = document.createElement('div');
    panel.id = ID;

    panel.innerHTML = `
        <div class="drop-area">
            <strong>📁 Arraste os arquivos para enviar</strong>
            <span class="hint">
                Ou clique aqui para selecionar arquivos
            </span>
            <input type="file" multiple hidden>
        </div>

        <div class="file-list"></div>

        <div class="actions">
            <span class="progress-text">
                Nenhum arquivo selecionado
            </span>

            <button class="upload-btn" disabled>
                Enviar anexos
            </button>
        </div>
    `;

    // Insere depois das assinaturas e antes de Anexos.
    anexosTitle.before(panel);

    const dropArea = panel.querySelector('.drop-area');
    const input = panel.querySelector('input');
    const fileList = panel.querySelector('.file-list');
    const uploadButton = panel.querySelector('.upload-btn');
    const progressText = panel.querySelector('.progress-text');

    // Renderiza os arquivos.
    function renderFiles() {
        fileList.innerHTML = '';

        files.forEach((item, index) => {
            const element = document.createElement('div');
            element.className = 'file-item';

            const name = document.createElement('span');
            name.className = 'file-name';
            name.textContent = item.name;

            const status = document.createElement('span');
            status.className = 'file-status';
            status.textContent = item.status || 'Aguardando';

            if (item.status === 'Enviado') {
                status.classList.add('success');
            }

            if (item.status === 'Falhou') {
                status.classList.add('error');
                status.title = item.error || '';
            }

            element.append(name, status);

            if (!uploading && !item.status) {
                const remove = document.createElement('button');

                remove.className = 'remove-file';
                remove.type = 'button';
                remove.textContent = '×';
                remove.title = 'Remover arquivo';

                remove.onclick = () => {
                    files.splice(index, 1);
                    renderFiles();
                };

                element.appendChild(remove);
            }

            fileList.appendChild(element);
        });

        const pending = files.filter(
            item => !item.status
        ).length;

        uploadButton.disabled = uploading || pending === 0;

        progressText.textContent = files.length
            ? `${files.length} arquivo(s) selecionado(s)`
            : 'Nenhum arquivo selecionado';
    }

    // Adiciona arquivos à fila.
    function addFiles(selected) {
        if (uploading) return;

        for (const file of selected) {
            files.push({
                file,
                name: file.name,
                status: '',
                error: ''
            });
        }

        renderFiles();
    }

    // Seleção pelo explorador.
    dropArea.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
        addFiles(input.files);
        input.value = '';
    });

    // Drag and drop.
    ['dragenter', 'dragover'].forEach(event => {
        dropArea.addEventListener(event, e => {
            e.preventDefault();
            e.stopPropagation();
            dropArea.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(event => {
        dropArea.addEventListener(event, e => {
            e.preventDefault();
            e.stopPropagation();
            dropArea.classList.remove('dragover');
        });
    });

    dropArea.addEventListener('drop', e => {
        addFiles(e.dataTransfer.files);
    });

    // Obtém o formulário original em segundo plano.
    async function getUploadForm() {
        const response = await fetch(uploadUrl, {
            method: 'GET',
            credentials: 'same-origin',
            redirect: 'follow'
        });

        if (!response.ok || response.redirected &&
            response.url.includes('/login')) {
            throw new Error(
                'Não foi possível acessar o formulário de anexos. Verifique a sessão.'
            );
        }

        const html = await response.text();

        const doc = new DOMParser().parseFromString(
            html,
            'text/html'
        );

        const form = doc.querySelector('form.formx');

        if (!form) {
            throw new Error('Formulário original não encontrado.');
        }

        const fileInput = form.querySelector(
            'input[type="file"][name]'
        );

        const description = form.querySelector(
            'textarea[name$="-descricao"]'
        );

        const observation = form.querySelector(
            'textarea[name$="-observacao"]'
        );

        if (!fileInput || !description || !observation) {
            throw new Error(
                'Estrutura de campos do formulário não reconhecida.'
            );
        }

        const csrf = form.querySelector(
            '[name="csrfmiddlewaretoken"]'
        )?.value;

        if (!csrf) {
            throw new Error('Token CSRF não encontrado.');
        }

        return {
            form,
            fileName: fileInput.name,
            descriptionName: description.name,
            observationName: observation.name
        };
    }

    // Envia um arquivo por requisição.
    async function uploadFile(item) {
        // Busca os tokens e a estrutura atual do formulário.
        const schema = await getUploadForm();

        const data = new FormData();

        // Preserva todos os campos ocultos originais.
        schema.form.querySelectorAll(
            'input[type="hidden"][name]'
        ).forEach(field => {
            data.append(field.name, field.value);
        });

        // Management form do Django.
        data.set('anexos-TOTAL_FORMS', '1');
        data.set('anexos-INITIAL_FORMS', '0');
        data.set('anexos-MIN_NUM_FORMS', '0');
        data.set('anexos-MAX_NUM_FORMS', '1000');

        // Campos do formset.
        data.set(schema.fileName, item.file, item.name);
        data.set(schema.descriptionName, '');
        data.set(schema.observationName, '');

        // POST para o endpoint original.
        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: data,
            credentials: 'same-origin',
            redirect: 'follow'
        });

        if (response.url.includes('/login')) {
            throw new Error('Sessão expirada.');
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        const doc = new DOMParser().parseFromString(
            html,
            'text/html'
        );

        // Se o servidor permaneceu na página de cadastro,
        // verifica erros de validação do Django.
        const returnedForm = doc.querySelector('form.formx');

        if (
            returnedForm &&
            (
                response.url.includes('/anexo/add/') ||
                !response.redirected
            )
        ) {
            const errors = returnedForm.querySelector(
                '.errorlist, .error, .alert-danger'
            );

            if (errors) {
                throw new Error(errors.textContent.trim());
            }

            throw new Error(
                'Servidor não confirmou o cadastro do anexo.'
            );
        }

        return true;
    }

    // Fila sequencial.
    uploadButton.addEventListener('click', async () => {
        if (uploading) return;

        const queue = files.filter(
            item => !item.status
        );

        if (!queue.length) return;

        if (!confirm(
            `Enviar ${queue.length} arquivo(s) para esta ocorrência?`
        )) return;

        uploading = true;

        uploadButton.disabled = true;
        dropArea.style.pointerEvents = 'none';

        progressText.classList.remove('success', 'error');

        let success = 0;
        let failed = 0;

        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];

            progressText.textContent =
                `Enviando ${i + 1} de ${queue.length}: ${item.name}`;

            try {
                await uploadFile(item);

                item.status = 'Enviado';
                item.error = '';

                success++;
            } catch (error) {
                item.status = 'Falhou';
                item.error = error.message;

                failed++;

                console.error(
                    '[OS Upload]',
                    item.name,
                    error
                );
            }

            renderFiles();
        }

        uploading = false;

        dropArea.style.pointerEvents = '';

        if (failed === 0 && success > 0) {
            uploadButton.disabled = true;

            progressText.classList.add('success');

            progressText.textContent =
                `Concluído: ${success} arquivo(s) enviado(s). Atualizando página...`;

            setTimeout(() => location.reload(), 2500);

        } else if (failed > 0) {
            progressText.classList.add('error');

            progressText.textContent =
                `Concluído: ${success} enviado(s), ${failed} falha(s).`;

            alert(
                `${success} arquivo(s) enviado(s).\n` +
                `${failed} arquivo(s) falharam.\n\n` +
                'Os arquivos com falha permanecem na lista para nova tentativa.'
            );

            // Permite tentar novamente somente os arquivos que falharam.
            for (const item of files) {
                if (item.status === 'Falhou') {
                    item.status = '';
                }
            }

            renderFiles();
        }

    });

    renderFiles();

    console.log(
        '[OS Upload] Inicializado.',
        uploadUrl
    );

})();
