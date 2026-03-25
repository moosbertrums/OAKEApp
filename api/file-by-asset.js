export default async function handler(req, res) {
    const { assetId } = req.query;

    if (!assetId) {
        return res.status(400).send("Missing assetId");
    }

    try {
        // 1. Vraag asset URL op via Monday
        const mondayRes = await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": process.env.MONDAY_TOKEN
            },
            body: JSON.stringify({
                query: `
                {
                    assets(ids: [${assetId}]) {
                        public_url
                        url
                    }
                }`
            })
        });

        const json = await mondayRes.json();
        const asset = json?.data?.assets?.[0];

        if (!asset) {
            return res.status(404).send("Asset not found");
        }

        const fileUrl = asset.public_url || asset.url;

        // 2. Fetch file vanaf S3 (server-side → geen CORS)
        const fileRes = await fetch(fileUrl);

        const buffer = await fileRes.arrayBuffer();

        res.setHeader("Content-Type", fileRes.headers.get("content-type"));
        res.send(Buffer.from(buffer));

    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching asset");
    }
}