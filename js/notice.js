window.onload = async function () {
    const resultEl = document.getElementById("result");
    if (resultEl)
        resultEl.innerHTML = "正在載入商品主檔...";

    const res = await window.loadB8Data();

    if (res.error) {
        if (resultEl)
            resultEl.innerHTML = `\n            <span style="color:red">\n            商品主檔載入失敗\n            </span>\n            `;
        return;
    }

    if (resultEl)
        resultEl.innerHTML = `\n            ✅ 商品主檔載入成功\n            <br>\n            共 ${window.b8Data.length} 筆資料\n            `;
};

function searchTDC() {
    const tdc = document.getElementById("tdcInput").value.trim();

    const item = window.b8Data.find(x => String(x.tdc).trim() === tdc);

    if (!item) {
        document.getElementById("result").innerHTML = "查無資料";
        return;
    }

    document.getElementById("result").innerHTML = `
        <b>TDC：</b>${item.tdc}
        <br>
        <b>全家代號：</b>${item.family_code}
        <br>
        <b>日翊代號：</b>${item.riyi_code}
        <br>
        <b>廠商：</b>${item.vendor_name}
        <br>
        <b>國際條碼：</b>${item.barcode}
        <br>
        <b>箱入數：</b>${item.carton_qty}
        `;
}

function buildVendorEmailBody(group) {
    const center = group.center || "";
    const deliveryDate = group.deliveryDate || "";

    const rows = group.items.map(item => ({
        orderForm: item.orderForm || "",
        name: item.productName || "",
        tdc: item.tdc || "",
        size: "",
        spec: "",
        packQty: "",
        cartonQty: item.cartonQty || "",
        totalQty: item.cartonQty && item.cartonSize ? String(Number(item.cartonQty) * Number(item.cartonSize)) : "",
        deliveredQty: "",
        barcode: item.barcode || "",
        center: item.center || "",
        deliveryDate: item.deliveryDate || "",
        familyCode: item.familyCode || ""
    }));

    const headerCells = [
        "訂貨驗收單",
        "名稱",
        "TDC代號",
        "底X高",
        "規格",
        "包裝數",
        "箱數",
        "總數",
        "送達數",
        "全台條碼",
        "物流中心",
        "進貨指定日",
        "全家代號"
    ];

    const rowsHtml = rows.map(row => `
            <tr>
                <td>${row.orderForm}</td>
                <td>${row.name}</td>
                <td>${row.tdc}</td>
                <td>${row.size}</td>
                <td>${row.spec}</td>
                <td>${row.packQty}</td>
                <td>${row.cartonQty}</td>
                <td>${row.totalQty}</td>
                <td>${row.deliveredQty}</td>
                <td>${row.barcode}</td>
                <td>${row.center}</td>
                <td>${row.deliveryDate}</td>
                <td>${row.familyCode}</td>
            </tr>
    `).join("");

    return `
        <div class="email-body-wrapper">
            <div><strong>物流中心：</strong>${center}</div>
            <div><strong>進貨指定日：</strong>${deliveryDate}</div>
            <div style="margin-top:12px;"><strong>商品明細：</strong></div>
            <table>
                <thead>
                    <tr>
                        ${headerCells.map(text => `<th>${text}</th>`).join("")}
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

function copyEmailContent(index) {
    const emailBody = document.getElementById(`vendorEmailBody-${index}`);
    if (!emailBody)
        return;

    const subject = emailBody.dataset.subject || "";
    const body = emailBody.value || "";

    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);

    const copyBtn = document.getElementById(`copyBtn-${index}`);
    if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "已複製";
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 1500);
    }
}

function renderVendorNotifications(groups) {
    const container = document.getElementById("vendorNotifications");
    container.innerHTML = "";

    if (!groups || groups.length === 0)
        return;

    groups.forEach((group, index) => {
        const block = document.createElement("div");
        block.className = "vendor-notification";

        const title = document.createElement("h3");
        title.textContent = group.vendorName || "";

        const emailLine = document.createElement("div");
        emailLine.className = "vendor-detail";
        const emailLabel = document.createElement("strong");
        emailLabel.textContent = "收件人：";
        const emailValue = document.createElement("span");
        emailValue.textContent = ` ${group.vendorEmail || ""}`;
        emailLine.appendChild(emailLabel);
        emailLine.appendChild(emailValue);

        const subjectLine = document.createElement("div");
        subjectLine.className = "vendor-detail";
        const subjectLabel = document.createElement("strong");
        subjectLabel.textContent = "信件主旨：";
        const subjectValue = document.createElement("span");
        subjectValue.textContent = ` ${group.emailSubject}`;
        subjectLine.appendChild(subjectLabel);
        subjectLine.appendChild(subjectValue);

        const bodyHtml = buildVendorEmailBody(group);

        const emailBody = document.createElement("div");
        emailBody.className = "email-body";
        emailBody.id = `vendorEmailHtml-${index}`;
        emailBody.dataset.subject = group.emailSubject || "";
        emailBody.innerHTML = bodyHtml;

        const hiddenTextarea = document.createElement("textarea");
        hiddenTextarea.style.display = "none";
        hiddenTextarea.id = `vendorEmailBody-${index}`;
        hiddenTextarea.dataset.subject = group.emailSubject || "";
        hiddenTextarea.readOnly = true;
        hiddenTextarea.value = bodyHtml;

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "copy-email-button";
        copyButton.id = `copyBtn-${index}`;
        copyButton.textContent = "複製通知內容";
        copyButton.onclick = function () {
            copyEmailContent(index);
        };

        block.appendChild(title);
        block.appendChild(emailLine);
        block.appendChild(subjectLine);
        block.appendChild(emailBody);
        block.appendChild(hiddenTextarea);
        block.appendChild(copyButton);

        container.appendChild(block);
    });
}

async function convertCSV() {
    const file = document.getElementById("csvFile").files[0];
    if (!file) {
        alert("請選擇 CSV");
        return;
    }

    document.getElementById("result").innerHTML = "讀取 CSV 中...";
    document.getElementById("vendorNotifications").innerHTML = "";

    const reader = new FileReader();

    reader.onload = function (e) {
        const decoder = new TextDecoder("big5");
        const csvText = decoder.decode(e.target.result);
        const rows = csvText.split(/\r\n|\n|\r/).filter(x => x.trim() !== "");
        const headerIndex = rows.findIndex(row => row.includes("序號"));
        const dataRows = rows.slice(headerIndex + 1);

        let csvData = [];
        dataRows.forEach(row => {
            const cols = row.split(",");
            const orderForm = cols[0];
            if (cols.length < 18) return;
            csvData.push({
                orderForm: orderForm,
                productName: cols[2],
                tdc: cols[3],
                cartonQty: cols[7],
                center: cols[16],
                deliveryDate: cols[17]
            });
        });

        let resultData = [];
        let notFoundList = [];
        let totalCartonQty = 0;
        let totalPCS = 0;

        csvData.forEach(item => {
            const product = window.b8Data.find(x => String(x.tdc).trim() === String(item.tdc).trim());
            if (!product) { notFoundList.push(item); return; }

            resultData.push({
                center: item.center,
                deliveryDate: item.deliveryDate,
                vendorName: product.vendor_name,
                vendorEmail: product.vendor_email,
                tdc: item.tdc,
                productName: item.productName,
                cartonQty: item.cartonQty,
                orderForm: item.orderForm,
                riyiCode: product.riyi_code,
                barcode: product.barcode,
                cartonSize: product.carton_qty,
                familyCode: product.family_code
            });

            totalCartonQty += Number(item.cartonQty) || 0;
            totalPCS += (Number(item.cartonQty) || 0) * (Number(product.carton_qty) || 0);
        });

        let html = `\n<h3>入倉通知單</h3>\n\n<b>配送日期：</b>\n${resultData[0]?.deliveryDate}\n\n<br><br>\n\n<b>配送中心：</b>\n${resultData[0]?.center}\n\n<br><br>\n\n<b>廠商：</b>\n${resultData[0]?.vendorName}\n\n<br><br>\n\n<b>Email：</b>\n${resultData[0]?.vendorEmail}\n\n<br><br>\n\n<table>\n<tr>\n<th>配送中心</th>\n<th>配送日期</th>\n<th>廠商</th>\n<th>TDC</th>\n<th>品名</th>\n<th>箱數</th>\n<th>日翊代號</th>\n<th>國際條碼</th>\n</tr>\n`;

        resultData.forEach(item => {
            html += `\n<tr>\n<td>${item.center}</td>\n<td>${item.deliveryDate}</td>\n<td>${item.vendorName}</td>\n<td>${item.tdc}</td>\n<td>${item.productName}</td>\n<td>${item.cartonQty}</td>\n<td>${item.riyiCode}</td>\n<td>${item.barcode}</td>\n</tr>\n`;
        });

        html += `\n</table>\n\n<br>\n\n<b>\n共 ${resultData.length} 筆商品\n</b>\n\n<br><br>\n\n<b>\n總箱數：\n${totalCartonQty}\n箱\n</b>\n\n<br><br>\n\n<b>\n總 PCS 數：\n\n${totalPCS}\n\nPCS\n</b>\n`;

        if (notFoundList.length > 0) {
            html += `\n<hr>\n<h3 style="color:red">\n⚠ 找不到 Mapping 商品\n</h3>\n<table>\n<tr>\n<th>TDC</th>\n<th>品名</th>\n<th>箱數</th>\n</tr>\n`;

            notFoundList.forEach(item => {
                html += `\n<tr>\n<td>${item.tdc}</td>\n<td>${item.productName}</td>\n<td>${item.cartonQty}</td>\n</tr>\n`;
            });

            html += `</table>`;
        }

        document.getElementById("result").innerHTML = html;

        const vendorGroups = resultData.reduce((groups, item) => {
            const key = item.vendorName || "";
            if (!groups[key]) {
                groups[key] = {
                    vendorName: item.vendorName || "",
                    vendorEmail: item.vendorEmail || "",
                    center: item.center || "",
                    deliveryDate: item.deliveryDate || "",
                    emailSubject: `【補貨通知】${item.vendorName || ""}_${item.deliveryDate || ""}`,
                    items: []
                };
            }
            groups[key].items.push(item);
            return groups;
        }, {});
        const groupsToRender = Object.values(vendorGroups);

        renderVendorNotifications(groupsToRender);
    };

    reader.readAsArrayBuffer(file);
}

function downloadPDF() {
    html2pdf().from(document.getElementById("result")).save("B8入倉通知單.pdf");
}
