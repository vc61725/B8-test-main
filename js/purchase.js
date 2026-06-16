
    // ===== V6.3 Multi-Channel Config / V6.4 Batch PDF Merge =====
const CHANNEL_CONFIG = {

    '7614': {
        deliveryLocation: 'Z',
        itemRemark: '進貨全台、補帳，PDS驗收',
        notifyVendor: 'N'
    },

    '2944': {
        deliveryLocation: 'Z3',
        itemRemark: '進貨全台、補帳，PDS驗收',
        notifyVendor: 'N'
    },

    '3244': {
        deliveryLocation: 'Z3',
        itemRemark: '入庫全台補帳，PDS驗收',
        notifyVendor: 'N'
    }

};

const DEFAULT_CHANNEL_CONFIG = {

    deliveryLocation: 'Z',

    itemRemark: '進貨全台、補帳，PDS驗收',

    notifyVendor: 'N'

};

function getChannelConfig(vendorCode) {

    const code = String(vendorCode).trim();

    return CHANNEL_CONFIG[code] || DEFAULT_CHANNEL_CONFIG;

}

(function () {
    const fileInput = document.getElementById('pdfFileInput');
    const convertButton = document.getElementById('convertButton');
    const downloadButton = document.getElementById('downloadButton');
    const statusElement = document.getElementById('status');
    const masterStatusElement = document.getElementById('masterStatus');
    const previewContainer = document.getElementById('previewContainer');
    const notFoundContainer = document.getElementById('notFoundContainer');

    let masterLoaded = false;
    let latestImportRows = [];

    const PURCHASE_IMPORT_HEADERS = [
        '供應商',
        '日翊品號',
        '期別',
        '採購數量',
        '預定交貨日期',
        '到貨地點',
        '採購單單品備註',
        '發信廠商',
        'DC別',
        '進貨預告備註',
        '連絡人姓名',
        '主要條碼',
    ];

    document.addEventListener('DOMContentLoaded', async () => {
        const res = await window.loadB8Data();

        if (res.error) {
            masterStatusElement.textContent = '商品主檔載入失敗，無法轉換。';
            masterStatusElement.className = 'master-status master-status-error';
            return;
        }

        masterLoaded = true;
        masterStatusElement.textContent =
            `商品主檔載入成功，共 ${window.b8Data.length} 筆資料。`;
        masterStatusElement.className = 'master-status master-status-ok';
    });

    fileInput.addEventListener('change', () => {
        const hasFile = fileInput.files && fileInput.files.length > 0;
        convertButton.disabled = !hasFile || !masterLoaded;
        downloadButton.disabled = true;
        statusElement.textContent = hasFile
            ? `已選擇 ${fileInput.files.length} 個 PDF，可開始轉換。`
            : '尚未上傳 PDF。';
        previewContainer.innerHTML = '';
        notFoundContainer.innerHTML = '';
        latestImportRows = [];
    });

    convertButton.addEventListener('click', async () => {
        if (!fileInput.files || !fileInput.files.length || !masterLoaded) {
            return;
        }

        convertButton.disabled = true;
        downloadButton.disabled = true;
        statusElement.textContent = '正在解析 PDF，請稍候...';
        previewContainer.innerHTML = '';
        notFoundContainer.innerHTML = '';
        latestImportRows = [];

        try {
            const files = Array.from(fileInput.files);
            const allPdfRows = [];

            for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
                const file = files[fileIndex];
                statusElement.textContent =
                    `正在解析 PDF (${fileIndex + 1}/${files.length})：${file.name}`;

                const rawText = await parsePdf(file);
                const vendorCode = extractVendorCode(rawText);
                const pdfRows = extractPdfRows(rawText).map((row) => ({
                    ...row,
                    VendorCode: vendorCode,
                }));

                allPdfRows.push(...pdfRows);
            }

            const { importRows, notFound } = enrichPurchaseRows(allPdfRows, window.b8Data);

            latestImportRows = importRows;
            renderPreview(importRows, previewContainer);
            renderNotFound(notFound, notFoundContainer);

            if (importRows.length) {
                statusElement.textContent =
                    `轉換完成（${files.length} 份 PDF）：${importRows.length} 筆可匯入` +
                    (notFound.length ? `，${notFound.length} 筆 TDC 找不到主檔。` : '。');
                downloadButton.disabled = false;
            } else if (notFound.length) {
                statusElement.textContent =
                    `未產生可匯入資料，${notFound.length} 筆 TDC 找不到主檔。`;
            } else {
                statusElement.textContent = '未擷取到資料，請檢查 PDF 內容格式。';
            }
        } catch (error) {
            console.error(error);
            statusElement.textContent = 'PDF 解析失敗，請確認檔案是否為有效 PDF。';
        } finally {
            convertButton.disabled = !(fileInput.files && fileInput.files.length) || !masterLoaded;
        }
    });

    downloadButton.addEventListener('click', () => {
        if (!latestImportRows.length) {
            statusElement.textContent = '沒有可下載的資料。';
            return;
        }

        generatePurchaseImportExcel(latestImportRows);
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
            pageTexts.push(pageText);
        }

        return pageTexts.join('\n\n');
    }

    function extractVendorCode(rawText) {
        const VENDOR_CODES = ['7614', '2944', '3244'];

        if (!rawText || !rawText.trim()) {
            return '';
        }

        const text = String(rawText).replace(/\r/g, ' ');
        const labelIdx = text.indexOf('廠商代號');

        if (labelIdx !== -1) {
            const segment = text.slice(labelIdx, labelIdx + 150);
            for (const code of VENDOR_CODES) {
                if (new RegExp(`(^|[\\s\\u3000])${code}($|[\\s\\u3000])`).test(segment)) {
                    return code;
                }
            }
        }

        const tokens = text.split(/\s+/).filter(Boolean);

        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i] !== '廠商代號' && !String(tokens[i]).includes('廠商代號')) {
                continue;
            }

            for (let j = i + 1; j < Math.min(i + 15, tokens.length); j++) {
                if (VENDOR_CODES.includes(tokens[j])) {
                    return tokens[j];
                }
            }
        }

        return '';
    }

    function extractPdfRows(rawText) {
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

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (!/^W\d+$/i.test(token)) {
                continue;
            }

            const tdcToken = tokens[i + 4];
            const quantityToken = tokens[i + 5];

            if (!tdcToken || !quantityToken) {
                continue;
            }

            if (!/^\d+$/.test(tdcToken) || !/^\d+$/.test(quantityToken)) {
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

    function enrichPurchaseRows(pdfRows, b8Data) {
        const importRows = [];
        const notFound = [];

        pdfRows.forEach((pdfRow) => {
            const product = (b8Data || []).find(
                (item) => String(item.tdc).trim() === String(pdfRow.TDC).trim()
            );

            if (!product) {
                notFound.push(pdfRow);
                return;
            }

            importRows.push(buildImportRow(product, pdfRow, pdfRow.VendorCode));
        });

        return { importRows, notFound };
    }

    function buildImportRow(product, pdfRow, pdfVendorCode) {

        const cfg = getChannelConfig(pdfVendorCode);
    
        return {
    
            '供應商': product.vendor_code ?? '',
    
            '日翊品號': product.riyi_code ?? '',
    
            '期別': product.period ?? '',
    
            '採購數量': pdfRow.Quantity ?? '',
    
            '預定交貨日期': pdfRow.DeliveryDate ?? '',
    
            '到貨地點': cfg.deliveryLocation,
    
            '採購單單品備註': cfg.itemRemark,
    
            '發信廠商': cfg.notifyVendor,
    
            'DC別': '',
    
            '進貨預告備註': '',
    
            '連絡人姓名': '',
    
            '主要條碼': ''
    
        };
    
    }

    function renderPreview(rows, container) {
        container.innerHTML = '';

        if (!rows.length) {
            return;
        }

        const heading = document.createElement('h3');
        heading.textContent = '匯入預覽';
        container.appendChild(heading);

        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        container.appendChild(wrapper);

        const table = document.createElement('table');
        const headerRow = document.createElement('tr');

        PURCHASE_IMPORT_HEADERS.forEach((column) => {
            const th = document.createElement('th');
            th.textContent = column;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        rows.forEach((row) => {
            const tr = document.createElement('tr');
            PURCHASE_IMPORT_HEADERS.forEach((column) => {
                const td = document.createElement('td');
                td.textContent = row[column] ?? '';
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        wrapper.appendChild(table);
    }

    function renderNotFound(notFound, container) {
        container.innerHTML = '';

        if (!notFound.length) {
            return;
        }

        const heading = document.createElement('h3');
        heading.className = 'not-found-heading';
        heading.textContent = '找不到主檔的 TDC';
        container.appendChild(heading);

        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        container.appendChild(wrapper);

        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        ['TDC', '驗收數量', '驗收日期'].forEach((column) => {
            const th = document.createElement('th');
            th.textContent = column;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        notFound.forEach((row) => {
            const tr = document.createElement('tr');
            [row.TDC, row.Quantity, row.DeliveryDate].forEach((value) => {
                const td = document.createElement('td');
                td.textContent = value ?? '';
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        wrapper.appendChild(table);
    }

    function generatePurchaseImportExcel(rows) {
        const aoa = [
            PURCHASE_IMPORT_HEADERS,
            ...rows.map((row) => PURCHASE_IMPORT_HEADERS.map((header) => row[header] ?? '')),
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(aoa);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([workbookArray], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = '採購單整批匯入.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
    }
})();
