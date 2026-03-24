export default async function handler(req, res) {
    const assetId = req.query.assetId;

    const MONDAY_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjI0MjMwMjkxMywiYWFpIjoxMSwidWlkIjo0MDQ0MjIxMSwiaWFkIjoiMjAyMy0wMy0wN1QxNToyMzo1MS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MTU2ODgxNDEsInJnbiI6ImV1YzEifQ.fbe2Ahr3rwxy0fCVeOtXeRrkaLxNApITXm3t2aVbUII";

    if (!assetId) {
        return res.status(400).send("Missing assetId");
    }

    try {
        const query = `
        {
            assets(ids: [${assetId}]) {
                public_url
                url
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
        const asset = json.data.assets[0];

        const fileUrl = asset.public_url || asset.url;

        const fileResponse = await fetch(fileUrl);
        const buffer = await fileResponse.arrayBuffer();

        res.setHeader("Content-Type", fileResponse.headers.get("content-type"));
        res.setHeader("Access-Control-Allow-Origin", "*");

        res.status(200).send(Buffer.from(buffer));

    } catch (err) {
        console.error(err);
        res.status(500).send("Asset fetch failed");
    }
}