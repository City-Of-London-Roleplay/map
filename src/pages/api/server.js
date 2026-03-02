// /pages/api/server.js
export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://api.policeroleplay.community/v2/server?Players=true&Staff=true&JoinLogs=true&Queue=true&KillLogs=true&CommandLogs=true&ModCalls=true&Vehicles=true",
      {
        headers: { "Server-Key": process.env.ERLC_API_KEY }
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "API request failed" });
  }
}
