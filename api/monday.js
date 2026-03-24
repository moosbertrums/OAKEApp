export default async function handler(req, res) {
    const { query } = req.body;

    const MONDAY_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjI0MjMwMjkxMywiYWFpIjoxMSwidWlkIjo0MDQ0MjIxMSwiaWFkIjoiMjAyMy0wMy0wN1QxNToyMzo1MS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MTU2ODgxNDEsInJnbiI6ImV1YzEifQ.fbe2Ahr3rwxy0fCVeOtXeRrkaLxNApITXm3t2aVbUII";

    try {
        const response = await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
                "Authorization": MONDAY_TOKEN,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
        });

        const data = await response.json();

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json(data);

    } catch (err) {
        console.error(err);
        res.status(500).send("Monday fetch failed");
    }
}