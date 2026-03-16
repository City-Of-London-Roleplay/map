// /pages/api/server.js
export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://api.policeroleplay.community/v1/server/command",

      {
        method: "POST",
        headers: {
          "Server-Key": process.env.ERLC_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(req.body)
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "API request failed" });
  }
}
