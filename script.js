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
    const { PDFDocument, StandardFonts } = PDFLib;

    const id = String(document.getElementById("id").value || "").trim();
    const type = String(document.getElementById("type").value || "").trim();

    console.log("FORM ID:", id);
    console.log("FORM type:", type);

    const mondayItems = await getMondayData();
    console.log("Items opgehaald:", mondayItems.length);

    const selectedItem = mondayItems.find(i => String(i.id) === id);

    if (!selectedItem) {
        alert("Geen item gevonden");
        return;
    }

    console.log("Geselecteerd item:", selectedItem);

    // ---------------- PDF setup -----------------
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 760;

    function write(text, size = 12, indent = 0) {
        if (y < 50) {
            page = pdfDoc.addPage([600, 800]);
            y = 760;
        }
        page.drawText(text, { x: 50 + indent, y, size, font });
        y -= size + 6;
    }

    // ---------------- Header -----------------
    write("Event gegevens", 18);
    write(`Event ID: ${id}`);
    write(`Type: ${type}`);
    write(" ", 8);

    write(selectedItem.name, 14);
    write(" ", 6);

    // ---------------- Gewone kolommen -----------------
    for (const col of selectedItem.column_values) {
        if (col.type === "board_relation") continue;
        if (!columnLabelMap[col.id]) continue;   // 👈 NIEUW
        if (!col.text || !col.text.trim()) continue;

        const label = columnLabelMap[col.id];
        write(`${label}: ${col.text}`, 10, 10);
    }

    write(" ", 8);

// ---------------- Contact & Bedrijf -----------------
    const contacts = getBoardRelation(selectedItem, "deal_contact");
    const printedAccounts = new Set();

    for (const contact of contacts) {
        // Contactpersoon
        write(`Contactpersoon: ${contact.name}`, 10, 10);

        const info = extractContactInfoFromRelated(contact);
        if (info.email) write(`Email: ${info.email}`, 10, 20);
        if (info.phone) write(`Tel: ${info.phone}`, 10, 20);

        // Bedrijf(ven) via contact
        const accounts = getNestedBoardRelation(contact, "contact_account");

        for (const account of accounts) {
            if (printedAccounts.has(account.id)) continue;
            printedAccounts.add(account.id);

            write(`Bedrijf: ${account.name}`, 10, 20);
        }

        write(" ", 6); // kleine spacing tussen contacten
    }

    // ---------------- Save PDF -----------------
    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Event_${id}.pdf`;
    link.click();
}
