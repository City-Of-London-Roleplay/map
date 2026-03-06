// pages/api/og.js
import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    console.log(searchParams.toString());
    const playerName = searchParams.get("player") || "";
    const x = parseFloat(searchParams.get("x")) || 1500;
    const y = parseFloat(searchParams.get("y")) || 1500;

    const MAP_SIZE = 3121;
    const PIN_SIZE = 15;
    const CROP_SIZE = 600; // 600px square crop

    // Calculate the crop area centered on the player
    // We want to show a 600x600 area around the player
    const cropX = Math.max(
      0,
      Math.min(x - CROP_SIZE / 2, MAP_SIZE - CROP_SIZE)
    );
    const cropY = Math.max(
      0,
      Math.min(y - CROP_SIZE / 2, MAP_SIZE - CROP_SIZE)
    );

    // Calculate pin position within the cropped area
    const pinX = x - cropX;
    const pinY = y - cropY;

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#1a1a1a",
          overflow: "hidden"
        }}
      >
        {/* Map Background - Positioned to show crop area */}
        <img
          src="https://map.col-erlc.ca/normal-locations.png"
          style={{
            position: "absolute",
            left: `-${cropX}px`,
            top: `-${cropY}px`,
            width: `${MAP_SIZE}px`,
            height: `${MAP_SIZE}px`,
            objectFit: "none"
          }}
        />

        {/* Semi-transparent overlay for better pin visibility */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,0.2) 100%)",
            pointerEvents: "none"
          }}
        />

        {/* Single Player Pin */}
        <div
          style={{
            position: "absolute",
            left: `${pinX}px`,
            top: `${pinY}px`,
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 10
          }}
        >
          {/* Pin Dot with pulse effect */}
          <div
            style={{
              width: PIN_SIZE,
              height: PIN_SIZE,
              backgroundColor: "#3B82F6",
              borderRadius: "50%",
              border: "3px solid white",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.5), 0 0 0 4px rgba(59,130,246,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          />

          {/* Player Name */}
          <div
            style={{
              marginTop: 12,
              padding: "6px 16px",
              backgroundColor: "rgba(0,0,0,0.85)",
              borderRadius: 30,
              color: "white",
              fontSize: 24,
              fontWeight: "bold",
              border: "1px solid #3B82F6",
              backdropFilter: "blur(4px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
            }}
          >
            {playerName || "Player"}
          </div>
        </div>

        {/* Optional: Subtle border to show crop area */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            border: "2px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            pointerEvents: "none"
          }}
        />
      </div>,
      {
        width: 600,
        height: 600
      }
    );
  } catch (e) {
    console.log(`OG Image Error: ${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500
    });
  }
}
