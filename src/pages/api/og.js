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
        case "dot":
          return "#F97316"; // orange-500
        default:
          return "#6B7280"; // gray-500
      }
    };

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex", // ✅ Required
          flexDirection: "column", // ✅ Required
          alignItems: "center", // ✅ Required
          justifyContent: "center", // ✅ Required
          backgroundColor: "#111827",
          backgroundImage:
            "radial-gradient(circle at 25px 25px, #374151 2px, transparent 2px), radial-gradient(circle at 75px 75px, #374151 2px, transparent 2px)",
          backgroundSize: "100px 100px"
        }}
      >
        <div
          style={{
            display: "flex", // ✅ Add this
            flexDirection: "column", // ✅ Add this
            alignItems: "center", // ✅ Add this
            justifyContent: "center", // ✅ Add this
            backgroundColor: "rgba(17, 24, 39, 0.95)",
            padding: "40px 60px",
            borderRadius: "24px",
            border: "2px solid #374151",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
          }}
        >
          <div
            style={{
              display: "flex", // ✅ Add this
              gap: "8px",
              fontSize: 48,
              fontWeight: "bold",
              color: "#FFFFFF",
              marginBottom: 8
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
                  display: "flex", // ✅ Add this
                  alignItems: "center", // ✅ Add this
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
                    display: "flex", // ✅ Add this
                    alignItems: "center", // ✅ Add this
                    justifyContent: "center", // ✅ Add this
                    fontSize: 40
                  }}
                >
                  👤
                </div>
                <div
                  style={{
                    display: "flex", // ✅ Add this
                    flexDirection: "column" // ✅ Add this
                  }}
                >
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
            </>
          )}

          {type === "team" && value && (
            <>
              <div style={{ fontSize: 32, color: "#9CA3AF", marginBottom: 24 }}>
                Tracking Team
              </div>
              <div
                style={{
                  display: "flex", // ✅ Add this
                  alignItems: "center", // ✅ Add this
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
                    display: "flex", // ✅ Add this
                    alignItems: "center", // ✅ Add this
                    justifyContent: "center", // ✅ Add this
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
              display: "flex", // ✅ Add this
              marginTop: 32,
              gap: 48,
              color: "#9CA3AF",
              fontSize: 20
            }}
          >
            <div>👥 {serverRes?.CurrentPlayers || 0} Online</div>
            <div>🚗 Active</div>
            <div>📍 Live Tracking</div>
          </div>
        </div>
      </div>,
      {
        width: 1200,
        height: 630
        // Remove fonts array if still getting errors
      }
    );
  } catch (e) {
    console.log(`OG Image Error: ${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500
    });
  }
}
