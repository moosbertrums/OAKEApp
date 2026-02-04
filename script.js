//----------------------------------------------
// 1. Label mapping voor nette namen in de PDF
//----------------------------------------------
const columnLabelMap = {
    deal_expected_close_date: "Verwachte afsluitdatum",
    wereldklok1: "Tijdstip",
    locatie: "Locatie",
    deal_stage: "Sales status",
    deal_owner: "Eigenaar",
    status4: "Aanvraagstatus",
    lange_tekst0__1: "Omschrijving",
    deal_creation_date: "Aanmaakdatum",
    deal_close_date: "Sluitdatum",
    nummers7: "PAX Lunch",
    nummers5: "PAX Diner",
    nummers4: "PAX Drank",
    dup__of_pax_diner: "PAX Overig"
};

//----------------------------------------------
// 2. Backend proxy fetch
//----------------------------------------------
async function mondayFetch(query) {
    const res = await fetch("http://localhost:3000/monday", {
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
// 3. Haal hoofdboard op (MET linked_items)
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

                            ... on BoardRelationValue {
                                linked_items {
                                    id
                                    name
                                    column_values {
                                        id
                                        type
                                        text
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
// 4. Helpers voor board relations
//----------------------------------------------
function getBoardRelation(item, columnId) {
    return (
        item.column_values.find(
            c => c.type === "board_relation" && c.id === columnId
        )?.linked_items ?? []
    );
}

function getNestedBoardRelation(item, columnId) {
    return (
        item.column_values.find(
            c => c.type === "board_relation" && c.id === columnId
        )?.linked_items ?? []
    );
}

//----------------------------------------------
// 5. Contact info uit gerelateerd item halen
//----------------------------------------------
function extractContactInfoFromRelated(item) {
    if (!item || !item.column_values) return {};

    const info = { name: item.name || "" };

    for (const col of item.column_values) {
        const idLower = (col.id || "").toLowerCase();

        if (!info.email && col.type === "email" && col.text) {
            info.email = col.text;
        }

        if (
            !info.phone &&
            (col.type === "phone" || idLower.includes("tel")) &&
            col.text
        ) {
            info.phone = col.text;
        }
    }

    return info;
}

//----------------------------------------------
// 6. PDF genereren
//----------------------------------------------
async function createPdf() {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;

    // ---------------- Form data ----------------
    const id = String(document.getElementById("id").value || "").trim();
    const type = String(document.getElementById("type").value || "").trim();

    const mondayItems = await getMondayData();
    const selectedItem = mondayItems.find(i => String(i.id) === id);

    if (!selectedItem) {
        alert("Geen item gevonden");
        return;
    }

    // ---------------- Load template ----------------
    const templateBytes = await fetch("template.pdf")
        .then(res => res.arrayBuffer());

    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // ==================================================
    // PAGES SETUP
    // ==================================================

    const pages = pdfDoc.getPages();

    const page1 = pages[0];                  // Foto A
    const page2 = pages[1];         // Tekst A + Projectbeschrijving
    const page3 = pages[2];           // Tekst B + extra info
    const page4 = pages[3];
    const page5 = pages[4];
    // page 4 & 5 komen later (PDF import)
    const page6 = pages[5];           // Foto B

    // ==================================================
    // HELPERS
    // ==================================================

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

    async function drawCenteredImage(page, imagePath, maxWidth = 320) {
        const imageBytes = await fetch(imagePath).then(r => r.arrayBuffer());
        const image = await pdfDoc.embedPng(imageBytes);

        const { width, height } = page.getSize();

        const imgWidth = maxWidth;
        const imgHeight = (image.height / image.width) * imgWidth;

        const x = (width - imgWidth) / 2;
        const y = (height - imgHeight) / 2;

        page.drawImage(image, {
            x,
            y,
            width: imgWidth,
            height: imgHeight
        });
    }

    // ==================================================
    // PAGINA 1 – FOTO A
    // ==================================================

    await drawCenteredImage(page1, "placeholders/foto-a.png");

    // ==================================================
    // PAGINA 2 – TEKST A + PROJECTBESCHRIJVING
    // ==================================================

    let y2 = 760;

    draw(page2, "Tekst A (placeholder)", 60, y2, 14);
    y2 -= 30;

    draw(page2, "Projectbeschrijving", 60, y2, 16);
    y2 -= 26;

    for (const col of selectedItem.column_values) {
        if (!columnLabelMap[col.id]) continue;
        if (!col.text || !col.text.trim()) continue;

        const label = columnLabelMap[col.id];
        draw(page2, `${label}: ${col.text}`, 60, y2, 10);
        y2 -= 16;
    }

    // ==================================================
    // PAGINA 3 – TEKST B + EXTRA INFO
    // ==================================================

    let y3 = 760;

    draw(page3, "Tekst B (placeholder)", 60, y3, 14);
    y3 -= 30;

    draw(page3, "Extra informatie (placeholder)", 60, y3, 10);

    // ==================================================
    // PAGINA 4 – OFFERTE (PDF uit Monday)
    // ==================================================

    const offertePdfBytes = await fetch("placeholders/offerte.pdf")
        .then(r => r.arrayBuffer());

    const offertePdf = await PDFDocument.load(offertePdfBytes);

    // pak de EERSTE pagina van de offerte
    const [offertePage] = await pdfDoc.copyPages(offertePdf, [0]);

    // vervang template pagina 4 (index 3)
    pdfDoc.removePage(3);
    pdfDoc.insertPage(3, offertePage);

    // ==================================================
    // PAGINA 5 – ALGEMENE VOORWAARDEN (PDF uit Monday)
    // ==================================================

    const avPdfBytes = await fetch("placeholders/algemene-voorwaarden.pdf")
        .then(r => r.arrayBuffer());

    const avPdf = await PDFDocument.load(avPdfBytes);

    const [avPage] = await pdfDoc.copyPages(avPdf, [0]);

    pdfDoc.removePage(4);
    pdfDoc.insertPage(4, avPage);

    // ==================================================
    // PAGINA 6 – FOTO B
    // ==================================================

    await drawCenteredImage(page6, "placeholders/foto-b.png");

    // ==================================================
    // SAVE
    // ==================================================

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Event_${id}.pdf`;
    link.click();
}
