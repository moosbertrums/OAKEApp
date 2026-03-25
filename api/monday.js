import fetch from "node-fetch";


export default async function handler(req, res) {
    const MONDAY_TOKEN = process.env.MONDAY_TOKEN;

    if (!MONDAY_TOKEN) {
        return res.status(500).json({ error: "MONDAY_TOKEN is not defined" });
    }

    res.setHeader("Access-Control-Allow-Origin", "https://app.ovenaan.nl"); // jouw frontend
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { query, assetId } = req.body;

    try {
        if (assetId) {
            // fetch asset URL via Monday GraphQL
            const graphqlQuery = `
      {
        assets(ids: [${assetId}]) {
          public_url
        }
      }`;

            const graphqlRes = await fetch("https://api.monday.com/v2", {
                method: "POST",
                headers: {
                    "Authorization": MONDAY_TOKEN,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ query: graphqlQuery })
            });

            const data = await graphqlRes.json();
            const url = data?.data?.assets?.[0]?.public_url;
            const fileRes = await fetch(url);
            const buffer = await fileRes.arrayBuffer();

            res.setHeader("Content-Type", fileRes.headers.get("content-type"));
            return res.send(Buffer.from(buffer));

        } else if (query) {
            // fetch Monday GraphQL query
            const graphqlRes = await fetch("https://api.monday.com/v2", {
                method: "POST",
                headers: {
                    "Authorization": MONDAY_TOKEN,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ query })
            });
            const data = await graphqlRes.json();
            return res.json(data);
        } else {
            return res.status(400).json({ error: "No query or assetId provided" });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}