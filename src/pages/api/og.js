// pages/api/og.js
import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const playerName = searchParams.get("player") || "";
    const x = parseFloat(searchParams.get("x")) || 1500;
    const y = parseFloat(searchParams.get("y")) || 1500;

    const MAP_SIZE = 3121;
    const PIN_SIZE = 40;

    // Calculate pin position (center of map)
    const pinX = (x / 3121) * MAP_SIZE;
    const pinY = (y / 3121) * MAP_SIZE;

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#1a1a1a"
        }}
      >
        {/* Map Background */}
        <img
          src="https://map.col-erlc.ca/normal-locations.png"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        />

        {/* Single Player Pin */}
        <div
          style={{
            position: "absolute",
            left: `${(pinX / MAP_SIZE) * 100}%`,
            top: `${(pinY / MAP_SIZE) * 100}%`,
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}
        >
          {/* Pin Dot */}
          <div
            style={{
              width: PIN_SIZE,
              height: PIN_SIZE,
              backgroundColor: "#3B82F6",
              borderRadius: "50%",
              border: "3px solid white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          ></div>

          {/* Player Name */}
          <div
            style={{
              marginTop: 8,
              padding: "4px 12px",
              backgroundColor: "rgba(0,0,0,0.75)",
              borderRadius: 20,
              color: "white",
              fontSize: 20,
              fontWeight: "bold",
              border: "1px solid rgba(255,255,255,0.2)",
              backdropFilter: "blur(4px)"
            }}
          >
            {playerName || "Player"}
          </div>
        </div>
      </div>,
      {
        width: 1200,
        height: 630
      }
    );
  } catch (e) {
    console.log(`OG Image Error: ${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500
    });
  }
}
