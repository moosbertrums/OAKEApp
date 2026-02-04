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

    // ---------------- Load template PDF ----------------
    const templateBytes = await fetch("template.pdf")
        .then(res => res.arrayBuffer());

    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // ---------------- Pages ----------------
    const pages = pdfDoc.getPages();

    const coverPage = pages[0];
    const contentPage = pages[1] ?? pdfDoc.addPage();

    // ==================================================
    // PAGINA 1 – COVER (afbeelding gecentreerd)
    // ==================================================

    const imageBytes = await fetch("img/Achtergrond licht.png")
        .then(res => res.arrayBuffer());

    const coverImage = await pdfDoc.embedPng(imageBytes);

    const { width, height } = coverPage.getSize();

    const imgWidth = 320;
    const imgHeight = (coverImage.height / coverImage.width) * imgWidth;

    const imgX = (width - imgWidth) / 2;
    const imgY = (height - imgHeight) / 2;

    coverPage.drawImage(coverImage, {
        x: imgX,
        y: imgY,
        width: imgWidth,
        height: imgHeight
    });

    // ==================================================
    // PAGINA 2 – CONTENT
    // ==================================================

    function draw(text, x, y, size = 10) {
        if (!text) return;
        contentPage.drawText(String(text), {
            x,
            y,
            size,
            font,
            color: rgb(0, 0, 0)
        });
    }

    let y = 780;

    // ---------------- Header ----------------
    draw("Event gegevens", 50, y, 16);
    y -= 24;

    draw(`Event ID: ${id}`, 50, y, 10);
    draw(`Type: ${type}`, 300, y, 10);
    y -= 20;

    draw(selectedItem.name, 50, y, 14);
    y -= 24;

    // ---------------- Event kolommen ----------------
    for (const col of selectedItem.column_values) {
        if (col.type === "board_relation") continue;
        if (!columnLabelMap[col.id]) continue;
        if (!col.text || !col.text.trim()) continue;

        const label = columnLabelMap[col.id];
        draw(`${label}: ${col.text}`, 60, y, 10);
        y -= 16;
    }

    y -= 10;

    // ---------------- Contact & Bedrijf ----------------
    const contacts = getBoardRelation(selectedItem, "deal_contact");
    const printedAccounts = new Set();

    for (const contact of contacts) {
        draw(`Contactpersoon: ${contact.name}`, 50, y, 10);
        y -= 14;

        const info = extractContactInfoFromRelated(contact);
        if (info.email) {
            draw(`Email: ${info.email}`, 60, y, 10);
            y -= 14;
        }
        if (info.phone) {
            draw(`Tel: ${info.phone}`, 60, y, 10);
            y -= 14;
        }

        const accounts = getNestedBoardRelation(contact, "contact_account");
        for (const account of accounts) {
            if (printedAccounts.has(account.id)) continue;
            printedAccounts.add(account.id);

            draw(`Bedrijf: ${account.name}`, 60, y, 10);
            y -= 14;
        }

        y -= 10;
    }

    // ---------------- Save PDF ----------------
    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Event_${id}.pdf`;
    link.click();
}

