const SUPABASE_URL =
"https://vfbxmednhbkcizyjojfc.supabase.co";

const SUPABASE_KEY =
"sb_publishable_7ciuMdtTX-PyYVr3PbUGDQ_HGtC1wvp";

const db =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

window.b8Data = [];

async function loadB8Data() {
    try {
        const { data, error } = await db
            .from("products")
            .select("*");

        if (error)
            throw error;

        window.b8Data = data || [];
        return { data: window.b8Data };
    }
    catch (error) {
        console.error(error);
        return { error };
    }
}

window.loadB8Data = loadB8Data;





async function convertCSV() {

    const file =
        document
        .getElementById("csvFile")
        .files[0];

    if (!file) {

        alert("請選擇 CSV");

        return;

    }

    document.getElementById("result").innerHTML =
        "讀取 CSV 中...";

    document.getElementById("vendorNotifications").innerHTML = "";

    const reader =
        new FileReader();

    reader.onload = function (e) {

        const decoder =
            new TextDecoder("big5");

        const csvText =
            decoder.decode(
                e.target.result
            );

        const rows =
            csvText
            .split(/\r\n|\n|\r/)
            .filter(
                x => x.trim() !== ""
            );

        const headerIndex =
            rows.findIndex(
                row =>
                    row.includes("序號")
            );

        const dataRows =
            rows.slice(
                headerIndex + 1
            );

        let csvData = [];

        dataRows.forEach(row => {

            const cols =
                row.split(",");

            const orderForm = cols[0];

            for (let i = 0; i < cols.length; i++) {
                console.log(`cols[${i}] =`, cols[i]);
            }

            if (cols.length < 18)
                return;

            csvData.push({
                orderForm:
                    orderForm,

                productName:
                    cols[2],

                tdc:
                    cols[3],

                cartonQty:
                    cols[7],

                center:
                    cols[16],

                deliveryDate:
                    cols[17]

            });

        });

        let resultData = [];
        let notFoundList = [];
        let totalCartonQty = 0;
        let totalPCS = 0;

        csvData.forEach(item => {
            const product =
                window.b8Data.find(
                    x =>
                        String(x.tdc).trim()
                        ===
                        String(item.tdc).trim()
                );

            if (!product) {
                notFoundList.push(item);
                return;
            }

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
        console.log("LOG: resultData built:", resultData.length, "sample:", resultData[0]);

        html = `
<h3>入倉通知單</h3>

<b>配送日期：</b>
${resultData[0]?.deliveryDate}

<br><br>

<b>配送中心：</b>
${resultData[0]?.center}

<br><br>

<b>廠商：</b>
${resultData[0]?.vendorName}

<br><br>

<b>Email：</b>
${resultData[0]?.vendorEmail}

<br><br>

<table>
<tr>
<th>配送中心</th>
<th>配送日期</th>
<th>廠商</th>
<th>TDC</th>
<th>品名</th>
<th>箱數</th>
<th>日翊代號</th>
<th>國際條碼</th>
</tr>
`;

        resultData.forEach(item => {
            html += `
<tr>
<td>${item.center}</td>
<td>${item.deliveryDate}</td>
<td>${item.vendorName}</td>
<td>${item.tdc}</td>
<td>${item.productName}</td>
<td>${item.cartonQty}</td>
<td>${item.riyiCode}</td>
<td>${item.barcode}</td>
</tr>
`;
        });

        html += `
</table>

<br>

<b>
共 ${resultData.length} 筆商品
</b>

<br><br>

<b>
總箱數：
${totalCartonQty}
箱
</b>

<br><br>

<b>
總 PCS 數：

${totalPCS}

PCS
</b>
`;

        if (notFoundList.length > 0) {
            html += `
<hr>
<h3 style="color:red">
⚠ 找不到 Mapping 商品
</h3>
<table>
<tr>
<th>TDC</th>
<th>品名</th>
<th>箱數</th>
</tr>
`;

            notFoundList.forEach(item => {
                html += `
<tr>
<td>${item.tdc}</td>
<td>${item.productName}</td>
<td>${item.cartonQty}</td>
</tr>
`;
            });

            html += `</table>`;
        }

        document.getElementById("result").innerHTML =
            html;

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
        console.log("LOG: vendorGroups keys:", Object.keys(vendorGroups));
        console.log("LOG: vendorGroups length:", groupsToRender.length);
        console.log("LOG: vendorNotifications element:", document.getElementById("vendorNotifications"));

        renderVendorNotifications(groupsToRender);

    };

    reader.readAsArrayBuffer(file);

}






function downloadPDF() {

    html2pdf()

        .from(
            document.getElementById("result")
        )

        .save(
            "B8入倉通知單.pdf"
        );

}
