const MONDAY_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjI0MjMwMjkxMywiYWFpIjoxMSwidWlkIjo0MDQ0MjIxMSwiaWFkIjoiMjAyMy0wMy0wN1QxNToyMzo1MS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MTU2ODgxNDEsInJnbiI6ImV1YzEifQ.fbe2Ahr3rwxy0fCVeOtXeRrkaLxNApITXm3t2aVbUII";

export default async function handler(req, res) {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "https://app.ovenaan.nl");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const assetId = req.query.assetId;

    if (!assetId) {
        return res.status(400).send("Missing assetId");
    }

    try {
        const query = `
        {
            assets(ids: [${assetId}]) {
                public_url
                url
                name
            }
        }`;

        const response = await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
                "Authorization": MONDAY_TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ query })
        });

        const json = await response.json();

        console.log("ASSET RESPONSE:", JSON.stringify(json, null, 2));

        const asset = json?.data?.assets?.[0];

        if (!asset) {
            return res.status(404).send("Asset not found");
        }

        // 🔥 fallback fix
        const fileUrl = asset.public_url || asset.url;

        if (!fileUrl) {
            return res.status(404).send("No file URL found");
        }

        const fileResponse = await fetch(fileUrl);

        const buffer = Buffer.from(await fileResponse.arrayBuffer());

        res.setHeader("Content-Type", fileResponse.headers.get("content-type"));
        return res.send(buffer);

    } catch (err) {
        console.error(err);
        return res.status(500).send("Asset fetch failed");
    }
}