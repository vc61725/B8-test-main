(function () {
    const fileInput = document.getElementById('pdfFileInput');
    const convertButton = document.getElementById('convertButton');
    const downloadButton = document.getElementById('downloadButton');
    const statusElement = document.getElementById('status');
    const previewContainer = document.getElementById('previewContainer');
    let latestRows = [];

    fileInput.addEventListener('change', () => {
        const hasFile = fileInput.files && fileInput.files.length > 0;
        convertButton.disabled = !hasFile;
        downloadButton.disabled = true;
        statusElement.textContent = hasFile ? '準備就緒，可開始轉換。' : '尚未上傳 PDF。';
        previewContainer.innerHTML = '';
        latestRows = [];
    });

    convertButton.addEventListener('click', async () => {
        if (!fileInput.files || !fileInput.files.length) {
            return;
        }

        convertButton.disabled = true;
        downloadButton.disabled = true;
        statusElement.textContent = '正在解析 PDF，請稍候...';
        previewContainer.innerHTML = '';
        latestRows = [];

        try {
            const file = fileInput.files[0];
            const rawText = await parsePdf(file);
            console.log(rawText);
            console.log(rawText.split(/\s+/));
            console.log('Extracted PDF text:', rawText);
            statusElement.textContent = '已擷取 PDF 純文字內容，開始擷取資料。';

            const pre = document.createElement('pre');
            pre.className = 'pdf-text-output';
            pre.textContent = rawText;

            latestRows = extractData(rawText);
            previewContainer.innerHTML = '';
            previewContainer.appendChild(pre);

            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'table-wrapper';
            renderTable(latestRows, tableWrapper);
            previewContainer.appendChild(tableWrapper);

            if (latestRows.length) {
                statusElement.textContent = `已擷取 ${latestRows.length} 筆資料。`;
                downloadButton.disabled = false;
            } else {
                statusElement.textContent = '未擷取到資料，請檢查 PDF 內容格式。';
            }
        } catch (error) {
            console.error(error);
            statusElement.textContent = 'PDF 解析失敗，請確認檔案是否為有效 PDF。';
        } finally {
            convertButton.disabled = false;
        }
    });

    downloadButton.addEventListener('click', () => {
        if (!latestRows || !latestRows.length) {
            statusElement.textContent = '沒有可下載的資料。';
            return;
        }

        generateExcel(latestRows);
    });

    async function parsePdf(file) {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;
        const pageTexts = [];

        for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex += 1) {
            const page = await pdfDocument.getPage(pageIndex);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(' ');
            pageTexts.push(`--- Page ${pageIndex} ---\n${pageText}`);
        }

        return pageTexts.join('\n\n');
    }

    function extractData(rawText) {
        if (!rawText || !rawText.trim()) {
            return [];
        }

        const tokens = String(rawText)
            .replace(/\r/g, ' ')
            .split(/\s+/)
            .filter(Boolean);

        const rows = [];
        let deliveryDate = '';

        for (const token of tokens) {
            if (/^\d{7}$/.test(token)) {
                deliveryDate = token;
                break;
            }
        }

        for (let i = 0; i < tokens.length; i += 1) {
            const token = tokens[i];
            if (!/^W\d+$/i.test(token)) {
                continue;
            }

            if (i + 7 >= tokens.length) {
                continue;
            }

            const codeToken = tokens[i + 1];
            const countToken = tokens[i + 2];
            const oneToken = tokens[i + 3];
            const tdcToken = tokens[i + 4];
            const quantityToken = tokens[i + 5];

            if (countToken !== '2' || oneToken !== '1') {
                continue;
            }

            if (!/^\d{7,8}$/.test(tdcToken) || !/^\d+$/.test(quantityToken)) {
                continue;
            }

            rows.push({
                TDC: tdcToken,
                Quantity: quantityToken,
                DeliveryDate: deliveryDate,
            });
        }

        return rows;
    }

    function renderTable(rows, container = previewContainer) {
        container.innerHTML = '';

        if (!rows || !rows.length) {
            container.innerHTML = '<div class="empty-state">目前尚無資料可預覽。</div>';
            return;
        }

        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        ['TDC', 'Quantity', 'DeliveryDate'].forEach((column) => {
            const th = document.createElement('th');
            th.textContent = column;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        rows.forEach((row) => {
            const tr = document.createElement('tr');
            ['TDC', 'Quantity', 'DeliveryDate'].forEach((column) => {
                const td = document.createElement('td');
                td.textContent = row[column] || '';
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        container.appendChild(table);
    }

    function generateExcel(rows) {
        const worksheet = XLSX.utils.json_to_sheet(rows, {
            header: ['TDC', 'Quantity', 'DeliveryDate'],
            dateNF: 'yyyy-mm-dd',
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([workbookArray], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'result.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
    }

    function getMockRows() {
        return [
            { TDC: '9455195', Quantity: '80', DeliveryDate: '1150612' },
            { TDC: '1234567', Quantity: '50', DeliveryDate: '1150612' },
            { TDC: '2345678', Quantity: '30', DeliveryDate: '1150612' },
        ];
    }
})();
