    //----------------------------------------------
    // Label mapping
    //----------------------------------------------


    const columnLabelMap = {
    wereldklok1: "Tijdstip",
    locatie: "Locatie",
    deal_owner: "OAKE Contactpersoon",
    nummers7: "PAX Lunch",
    nummers5: "PAX Diner",
    nummers4: "PAX Drank",
    dup__of_pax_diner: "PAX Overig",
};

    //----------------------------------------------
    // Backend proxy fetch
    //----------------------------------------------

    const API_BASE = window.location.origin;

    async function mondayFetch(query) {
        const res = await fetch(`${API_BASE}/monday`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });

        const json = await res.json();

        if (json.errors) {
            console.error("GraphQL errors:", json.errors);
            return null;
        }

        return json;
    }

    //----------------------------------------------
    // Haal hoofdboard op
    //----------------------------------------------

async function getMondayData() {
    const query = `
        {
            boards(ids: 1160478330) {
                items_page(limit: 200) {
                    items {
                        id
                        name
                        column_values {
                            id
                            type
                            text
                            value
                            ... on BoardRelationValue {
                                linked_items {
                                    id
                                    name
                                    column_values {
                                        id
                                        type
                                        text
                                        
                                        ... on BoardRelationValue {
                                            linked_items {
                                            id
                                            name
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    const res = await mondayFetch(query);
    return res?.data?.boards?.[0]?.items_page?.items ?? [];
}

    //----------------------------------------------
    // Helpers voor board relations
    //----------------------------------------------

function getBoardRelationItems(item, columnId) {
    return (
        item?.column_values?.find(
            c => c.type === "board_relation" && c.id === columnId
        )?.linked_items ?? []
    );
}

function extractContactInfoFromRelated(item) {
    if (!item || !item.column_values) return {};

    const info ={
        name: item.name||"",
        email: "",
        phone: ""
    };

    for (const col of item.column_values) {
        const id = (col.id || "").toLowerCase();
        const text = col.text || "";

        if (!info.email &&
            (id.includes("email") || text.includes("@"))
        ) {
            info.email = text;
        }

        if (!info.phone &&
            (id.includes("phone") || id.includes("tel") || id.includes("mob"))
        ) {
            info.phone = text;
        }
    }
    return info;

}

    //----------------------------------------------
    // Template board ophalen
    //----------------------------------------------

async function getTemplates() {

    const query = `
    {
        boards(ids: 5093227258) {
            items_page(limit: 200) {
                items {
                    id
                    name
                    column_values {
                        id
                        type
                        text
                        value
                    }
                }
            }
        }
    }`;

    const res = await mondayFetch(query);
    return res?.data?.boards?.[0]?.items_page?.items ?? [];
}

    //----------------------------------------------
    // Helpers
    //----------------------------------------------
function getColumnText(item, columnId) {
    return item.column_values?.find(c => c.id === columnId)?.text || "";
}

function getFileAssetId(item, columnId) {

    const col = item.column_values?.find(c => c.id === columnId);

    if (!col || !col.value) return null;

    try {
        const parsed = JSON.parse(col.value);

        if (parsed.files?.length) {
            return parsed.files[0].assetId;
        }
    } catch (e) {
        console.error("Asset parse error:", e);
    }

    return null;
}

    //----------------------------------------------
    // Template dropdown
    //----------------------------------------------

let cachedTemplates = [];

async function loadTemplateDropdown() {

    cachedTemplates = await getTemplates();

    const dropdown = document.getElementById("templateSelect");

    dropdown.innerHTML = "";

    for (const template of cachedTemplates) {

        const option = document.createElement("option");

        option.value = template.id;
        option.textContent = template.name;

        dropdown.appendChild(option);
    }
}

loadTemplateDropdown();

    //----------------------------------------------
    // PDF genereren
    //----------------------------------------------

async function createPdf() {

    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const id = String(document.getElementById("id").value || "").trim();
    const templateId = document.getElementById("templateSelect").value;
    const mondayItems = await getMondayData();
    const selectedItem = mondayItems.find(i => String(i.id) === id);
    console.log("MONDAY DATA:", selectedItem);
    if (!selectedItem) {
        alert("Geen event item gevonden");
        return;
    }

    const selectedTemplate = cachedTemplates.find(t => t.id === templateId);
    console.log("TEMPLATE DATA:", selectedTemplate);

    if (!selectedTemplate) {
        alert("Geen template gevonden");
        return;
    }

    //----------------------------------------------
    // TEMPLATE COLUMN MAP
    //----------------------------------------------

    const templateColumnMap = {
        tekstA: "text_mm1g5aqc",
        tekstB: "text_mm1gwwxn",
        fotoA: "file_mm1gv3ap",
        fotoB: "file_mm1g35kt",
        av: "file_mm1gz2x0"
    };

    //----------------------------------------------
    // TEMPLATE DATA
    //----------------------------------------------

    const tekstA = getColumnText(selectedTemplate, templateColumnMap.tekstA);
    const tekstB = getColumnText(selectedTemplate, templateColumnMap.tekstB);
    const fotoA = getFileAssetId(selectedTemplate, templateColumnMap.fotoA);
    const fotoB = getFileAssetId(selectedTemplate, templateColumnMap.fotoB);
    const avFile = getFileAssetId(selectedTemplate, templateColumnMap.av);

    //----------------------------------------------
    // Template PDF laden
    //----------------------------------------------

    const templateBytes = await fetch("template.pdf")
        .then(res => res.arrayBuffer());

    const pdfDoc = await PDFDocument.load(templateBytes);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();

    const page1 = pages[0];
    const page2 = pages[1];
    const page3 = pages[2];
    const page6 = pages[5];

    const styles = {
        title: { size: 16, lineHeight: 22 },
        subtitle: { size: 14, lineHeight: 18 },
        body: { size: 10, lineHeight: 14 },
        small: { size: 9, lineHeight: 12 },
        fronttitle: { size: 24, lineHeight: 26 }
    };

    const spacing = {
        section: 20,
        block: 12,
        line: 6
    };

    //----------------------------------------------
    // Helpers
    //----------------------------------------------

    function draw(page, text, x, y, size = 10) {

        if (!text) return;

        page.drawText(String(text), {
            x,
            y,
            size,
            font,
            color: rgb(0, 0, 0)
        });
    }

    function drawWrappedText(page, text, x, y, maxWidth, size = 10, lineHeight = 14) {

        if (!text) return y;

        const words = text.split(" ");
        let line = "";

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + " ";
            const width = font.widthOfTextAtSize(testLine, size);

            if (width > maxWidth && i > 0) {
                page.drawText(line, { x, y, size, font });
                line = words[i] + " ";
                y -= lineHeight;
            } else {
                line = testLine;
            }
        }

        if (line) {
            page.drawText(line, { x, y, size, font });
            y -= lineHeight;
        }

        return y;
    }

    async function drawAssetImage(page, assetId) {

        if (!assetId) {
            console.log("Geen image assetId");
            return;
        }

        const proxyUrl = `${API_BASE}/file-by-asset?assetId=${assetId}`;
        const bytes = await fetch(proxyUrl).then(r => r.arrayBuffer());

        let image;

        try {
            image = await pdfDoc.embedPng(bytes);
        } catch {
            image = await pdfDoc.embedJpg(bytes);
        }

        const { width, height } = page.getSize();
        const scale = Math.max(
            width / image.width,
            height / image.height
        );

        const imgWidth = image.width * scale;
        const imgHeight = image.height * scale;

        const x = (width - imgWidth) / 2;
        const y = (height - imgHeight) / 2;

        page.drawImage(image, {
            x: x,
            y: y,
            width: width,
            height: height
        });
    }

    async function drawFrameImage(page, imagePath) {
        const imageBytes = await fetch(imagePath).then(r => r.arrayBuffer());
        const image = await pdfDoc.embedPng(imageBytes);

        const { width, height } = page.getSize();

        const scale = Math.min(
            width / image.width,
            height / image.height
        );

        const imgWidth = image.width * scale;
        const imgHeight = image.height * scale;

        const x = (width - imgWidth) / 2;
        const y = (height - imgHeight) / 2;

        page.drawImage(image, {
            x,
            y: y + 7,
            width: imgWidth,
            height: imgHeight
        });
    }
    //----------------------------------------------
    // PAGINA 1 – FOTO A
    //----------------------------------------------


    await drawAssetImage(page1, fotoA);
    await drawFrameImage(page1, "placeholders/frontpagemask.png");
    drawWrappedText(page1, selectedTemplate.name, 40, 100, 260, styles.fronttitle.size, styles.fronttitle.lineHeight);


    //----------------------------------------------
    // PAGINA 2 – TEKST A + EVENT INFO
    //----------------------------------------------

    let y2 = 760;

    draw(page2, "Over ons", 60, y2, styles.title.size);
    y2 -= spacing.block;
    y2 = drawWrappedText(page2, tekstA, 60, y2, 480, styles.body.size, styles.body.lineHeight);
    y2 -= spacing.block;

    draw(page2, "Projectbeschrijving", 60, y2, styles.title.size);
    y2 -= spacing.block;

    const contacts = getBoardRelationItems(selectedItem, "deal_contact");
    const printedAccounts = new Set();

    for (const contact of contacts) {

        const accounts = getBoardRelationItems(contact, "contact_account");

        for (const account of accounts) {

            if (printedAccounts.has(account.id)) continue;

            printedAccounts.add(account.id);

            y2 = drawWrappedText(page2, `Bedrijf: ${account.name}`, 60, y2, 470);
        }

        y2 = drawWrappedText(page2, `Contactpersoon: ${contact.name}`, 60, y2, 480);

        const info = extractContactInfoFromRelated(contact);

        if (info.email) {
            y2 = drawWrappedText(page2, `Email: ${info.email}`, 60, y2, 470);
        }

        if (info.phone) {
            y2 = drawWrappedText(page2, `Tel: ${info.phone}`, 60, y2, 470);
        }



    }

    for (const col of selectedItem.column_values) {

        if (!columnLabelMap[col.id]) continue;
        if (!col.text) continue;

        const label = columnLabelMap[col.id];

        y2 = drawWrappedText(
            page2,
            `${label}: ${col.text}`,
            60,
            y2,
            480,
            styles.body.size,
            styles.body.lineHeight
        );
    }


    //----------------------------------------------
    // PAGINA 3 – TEKST B
    //----------------------------------------------

    let y3 = 760;

    draw(page3, "Over het project", 60, y3, styles.title.size);
    y3 -= spacing.block;
    drawWrappedText(page3, tekstB, 60, y3, 480, styles.body.size, styles.body.lineHeight);


    //----------------------------------------------
    // PAGINA 5 – ALGEMENE VOORWAARDEN
    //----------------------------------------------

    if (avFile) {

        const proxyUrl = `${API_BASE}/file-by-asset?assetId=${avFile}`;
        const avPdfBytes = await fetch(proxyUrl).then(r => r.arrayBuffer());
        const avPdf = await PDFDocument.load(avPdfBytes);
        const [avPage] = await pdfDoc.copyPages(avPdf, [0]);

        pdfDoc.removePage(4);
        pdfDoc.insertPage(4, avPage);
    }
    else {
        pdfDoc.removePage(4);
    }

    //----------------------------------------------
    // PAGINA 4 – OFFERTE placeholder
    //----------------------------------------------
    const fileInput = document.getElementById("offerteUpload");
    const uploadedFile = fileInput.files[0];

    let offertePdfBytes = null;

    if (uploadedFile) {
        offertePdfBytes = await uploadedFile.arrayBuffer();
    }

    if (offertePdfBytes) {

        const offertePdf = await PDFDocument.load(offertePdfBytes);
        const [offertePage] = await pdfDoc.copyPages(offertePdf, [0]);

        pdfDoc.removePage(3);
        pdfDoc.insertPage(3, offertePage);

    } else {

        pdfDoc.removePage(3);
    }

    //----------------------------------------------
    // PAGINA 6 – FOTO B
    //----------------------------------------------

    await drawAssetImage(page6, fotoB);
    await drawFrameImage(page6, "placeholders/backpagemask.png")

    //----------------------------------------------
    // SAVE
    //----------------------------------------------

    const bytes = await pdfDoc.save();

    const blob = new Blob([bytes], { type: "application/pdf" });

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = `Event_${id}.pdf`;

    link.click();
}