// pages/api/og.js
import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "default";
    const value = searchParams.get("value") || "";

    // Fetch current server data with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const [serverRes, playersRes] = await Promise.all([
      fetch(`https://map.col-erlc.ca/api/server`, { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => null),
      fetch(`https://map.col-erlc.ca/api/players`, {
        signal: controller.signal
      })
        .then((r) => r.json())
        .catch(() => ({}))
    ]);

    clearTimeout(timeoutId);

    // Find player if type is user
    let playerInfo = null;
    if (type === "user" && value && playersRes) {
      const userLower = value.toLowerCase();
      Object.values(playersRes).forEach((team) => {
        if (Array.isArray(team)) {
          team.forEach((player) => {
            const playerName =
              player.Player?.split(":")[0]?.toLowerCase() || "";
            const playerId = player.Player?.split(":")[1] || "";
            if (playerName.includes(userLower) || playerId === value) {
              playerInfo = player;
            }
          });
        }
      });
    }

    // Get team color
    const getTeamColor = (team) => {
      switch (team?.toLowerCase()) {
        case "police":
          return "#3B82F6"; // blue-500
        case "sheriff":
          return "#16A34A"; // green-600
        case "fire":
          return "#DC2626"; // red-600
        case "ems":
          return "#DC2626"; // red-600
        case "dot":
          return "#F97316"; // orange-500
        case "jail":
          return "#9333EA"; // purple-600
        default:
          return "#6B7280"; // gray-500
      }
    };

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111827",
          backgroundImage:
            "radial-gradient(circle at 25px 25px, #374151 2px, transparent 2px), radial-gradient(circle at 75px 75px, #374151 2px, transparent 2px)",
          backgroundSize: "100px 100px",
          fontFamily: "Inter"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(17, 24, 39, 0.95)",
            padding: "40px 60px",
            borderRadius: "24px",
            border: "2px solid #374151",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: "bold",
              color: "#FFFFFF",
              marginBottom: 8,
              display: "flex",
              gap: "8px"
            }}
          >
            <span style={{ color: "#22C55E" }}>City</span>
            <span style={{ color: "#3B82F6" }}>Of</span>
            <span style={{ color: "#9CA3AF" }}>London</span>
          </div>

          {type === "user" && playerInfo && (
            <>
              <div style={{ fontSize: 32, color: "#9CA3AF", marginBottom: 24 }}>
                Tracking Player
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  marginBottom: 16
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: getTeamColor(playerInfo.Team),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40
                  }}
                >
                  👤
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: "bold",
                      color: "#FFFFFF"
                    }}
                  >
                    {playerInfo.Player?.split(":")[0] || "Unknown"}
                  </div>
                  <div style={{ fontSize: 24, color: "#9CA3AF" }}>
                    {playerInfo.Team || "Unknown"} •{" "}
                    {playerInfo.Callsign || "No Callsign"}
                  </div>
                </div>
              </div>
              {playerInfo.Location && (
                <div style={{ fontSize: 20, color: "#6B7280", marginTop: 8 }}>
                  Location: {Math.round(playerInfo.Location.LocationX)},{" "}
                  {Math.round(playerInfo.Location.LocationZ)}
                </div>
              )}
            </>
          )}

          {type === "team" && value && (
            <>
              <div style={{ fontSize: 32, color: "#9CA3AF", marginBottom: 24 }}>
                Tracking Team
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  marginBottom: 16
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: getTeamColor(value),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40
                  }}
                >
                  👥
                </div>
                <div
                  style={{ fontSize: 36, fontWeight: "bold", color: "#FFFFFF" }}
                >
                  {value} Team
                </div>
              </div>
              <div style={{ fontSize: 20, color: "#6B7280" }}>
                {Object.values(playersRes || {}).reduce((count, team) => {
                  if (Array.isArray(team)) {
                    return count + team.filter((p) => p.Team === value).length;
                  }
                  return count;
                }, 0)}{" "}
                members online
              </div>
            </>
          )}

          {type === "default" && (
            <>
              <div style={{ fontSize: 32, color: "#9CA3AF", marginBottom: 24 }}>
                Live Server Map
              </div>
              <div style={{ fontSize: 24, color: "#FFFFFF" }}>
                {serverRes?.CurrentPlayers || 0} / {serverRes?.MaxPlayers || 40}{" "}
                Players
              </div>
            </>
          )}

          <div
            style={{
              display: "flex",
              marginTop: 32,
              gap: 48,
              color: "#9CA3AF",
              fontSize: 20
            }}
          >
            <div>👥 {serverRes?.CurrentPlayers || 0} Online</div>
            <div>
              🚗{" "}
              {Object.values(playersRes || {}).reduce((sum, team) => {
                if (Array.isArray(team)) {
                  return sum + team.filter((p) => p.Location).length;
                }
                return sum;
              }, 0)}{" "}
              Active
            </div>
            <div>📍 Live Tracking</div>
          </div>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Inter",
            data: await fetch(
              "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
            ).then((res) => res.arrayBuffer()),
            weight: 400,
            style: "normal"
          }
        ]
      }
    );
  } catch (e) {
    console.log(`OG Image Error: ${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500
    });
  }
}
