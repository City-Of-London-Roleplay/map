// /pages/api/players.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const serverRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/server`
    );
    const serverData = await serverRes.json();
    const players = serverData.Players || [];

    // Group players by team
    const teams = {};
    players.forEach((player) => {
      const team = player.Team || "Unknown";
      if (!teams[team]) teams[team] = [];
      teams[team].push(player);
    });

    res.status(200).json(teams);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch players" });
  }
}
