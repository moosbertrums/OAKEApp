import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const MONDAY_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjI0MjMwMjkxMywiYWFpIjoxMSwidWlkIjo0MDQ0MjIxMSwiaWFkIjoiMjAyMy0wMy0wN1QxNToyMzo1MS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MTU2ODgxNDEsInJnbiI6ImV1YzEifQ.fbe2Ahr3rwxy0fCVeOtXeRrkaLxNApITXm3t2aVbUII";

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

app.listen(3000, () => console.log("Server running on port 3000"));
