// pages/api/og.js
import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const playerName =
      searchParams.get("user")?.replace(".png", "") || "Player";
    const x = parseFloat(searchParams.get("x")) || 1500;
    const y = parseFloat(searchParams.get("y")) || 1500;

    // FORCE size as number
    let size = Number(searchParams.get("size"));
    if (isNaN(size) || size < 100) size = 500;
    if (size > 1200) size = 1200;

    const MAP_SIZE = 3121;
    const VIEW_SIZE = 500;

    // Calculate crop
    let cropX = Math.max(0, Math.min(x - VIEW_SIZE / 2, MAP_SIZE - VIEW_SIZE));
    let cropY = Math.max(0, Math.min(y - VIEW_SIZE / 2, MAP_SIZE - VIEW_SIZE));

    // Pin position
    const pinX = Math.round(x - cropX);
    const pinY = Math.round(y - cropY);

    console.log(
      `Generating ${size}x${size} image for ${playerName} at ${x},${y}`
    );

    return new ImageResponse(
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          backgroundColor: "#1a1a1a"
        }}
      >
        {/* Map - using string concatenation for values */}
        <img
          src="https://map.col-erlc.ca/normal-locations.png"
          style={{
            position: "absolute",
            left: "-" + cropX + "px",
            top: "-" + cropY + "px",
            width: MAP_SIZE + "px",
            height: MAP_SIZE + "px",
            display: "block"
          }}
        />

        {/* Semi-transparent overlay - NO zIndex */}
        <div
          style={{
            position: "absolute",
            top: "0px",
            left: "0px",
            right: "0px",
            bottom: "0px",
            background:
              "radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,0.2) 100%)"
          }}
        />

        {/* Pin container - NO zIndex */}
        <div
          style={{
            position: "absolute",
            left: pinX + "px",
            top: pinY + "px",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}
        >
          {/* Pin dot */}
          <div
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: "#3B82F6",
              borderRadius: "50%",
              border: "3px solid #ffffff",
              boxShadow: "0 0 0 3px rgba(59,130,246,0.5)"
            }}
          />

          {/* Player name */}
          <div
            style={{
              marginTop: "8px",
              padding: "6px 16px",
              backgroundColor: "#000000",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "bold",
              borderRadius: "20px",
              border: "1px solid #3B82F6",
              whiteSpace: "nowrap"
            }}
          >
            {playerName}
          </div>
        </div>
      </div>,
      {
        width: size,
        height: size,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0"
        }
      }
    );
  } catch (e) {
    console.error("OG Error:", e);
    return new Response(e.message, { status: 500 });
  }
}
