import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;

app.post("/monday", async (req, res) => {
    const query = req.body.query;

    const response = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: {
            "Authorization": MONDAY_TOKEN,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
    });

    const data = await response.json();
    res.send(data);
});

app.get("/file-proxy", async (req, res) => {

    const url = req.query.url;

    if (!url) {
        return res.status(400).send("Missing URL");
    }

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: MONDAY_TOKEN,
            }
        });

        console.log("Content-Type:", response.headers.get("content-type"));
        console.log("URL:", url);
        console.log("Status:", response.status);
        console.log("Content-Type:", response.headers.get("content-type"));

        const buffer = Buffer.from(await response.arrayBuffer());

        res.set("Content-Type", response.headers.get("content-type"));
        res.send(buffer);

    } catch (err) {
        console.error(err);
        res.status(500).send("Fetch failed");
    }
});

app.get("/file-by-asset", async (req, res) => {

    const assetId = req.query.assetId;

    if (!assetId) {
        return res.status(400).send("Missing assetId");
    }

    try {
        // 🔹 Stap 1: asset info ophalen
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

        const asset = json.data.assets[0];

        // 🔹 Stap 2: file ophalen via public_url
        const fileResponse = await fetch(asset.public_url);

        const buffer = Buffer.from(await fileResponse.arrayBuffer());

        res.set("Content-Type", fileResponse.headers.get("content-type"));
        res.send(buffer);

    } catch (err) {
        console.error(err);
        res.status(500).send("Asset fetch failed");
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
