// /pages/api/user-image.js
import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  try {
    // 1. Get username from query string (e.g., "JohnDoe.png")
    const { searchParams } = new URL(req.url);
    let username = searchParams.get("user") || "";

    // Remove the '.png' extension if present
    username = username.replace(/\.png$/i, "");

    if (!username) {
      return new Response("Username is required", { status: 400 });
    }

    // 2. Fetch current players to find this user's location
    //    (You'll need to adjust this URL based on your actual API structure)
    const playersRes = await fetch(`https://map.col-erlc.ca/api/players`)
      .then((r) => r.json())
      .catch(() => ({}));

    // 3. Find the player by username (adapt this logic to match your data structure)
    let playerData = null;
    let playerCoords = { x: 1500, y: 1500 }; // Default coordinates

    // This is a placeholder - YOU MUST IMPLEMENT THIS BASED ON YOUR ACTUAL DATA
    // Example: Loop through playersRes to find the user and get their LocationX, LocationZ
    Object.values(playersRes).forEach((team) => {
      if (Array.isArray(team)) {
        team.forEach((player) => {
          // Check if the player's name matches the username (case-insensitive)
          if (
            player.Player &&
            player.Player.split(":")[0].toLowerCase() === username.toLowerCase()
          ) {
            playerData = player;
            if (player.Location) {
              playerCoords = {
                x: player.Location.LocationX,
                y: player.Location.LocationZ // Note: Using Z for Y coordinate
              };
            }
          }
        });
      }
    });

    // 4. Generate the 1000x1000 image using the coordinates
    const MAP_SIZE = 3121;
    const PIN_SIZE = 20;
    const CROP_SIZE = 500;

    // Calculate crop area centered on the player
    const cropX = Math.max(
      0,
      Math.min(playerCoords.x - CROP_SIZE / 2, MAP_SIZE - CROP_SIZE)
    );
    const cropY = Math.max(
      0,
      Math.min(playerCoords.y - CROP_SIZE / 2, MAP_SIZE - CROP_SIZE)
    );
    const pinX = playerCoords.x - cropX;
    const pinY = playerCoords.y - cropY;

    // 5. Return the image using ImageResponse
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
        <img
          src="https://map.col-erlc.ca/normal-locations.png" // Use your map style
          style={{
            position: "absolute",
            left: `-${cropX}px`,
            top: `-${cropY}px`,
            width: `${MAP_SIZE}px`,
            height: `${MAP_SIZE}px`,
            objectFit: "none"
          }}
        />
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
          <div
            style={{
              width: PIN_SIZE,
              height: PIN_SIZE,
              backgroundColor: "#3B82F6",
              borderRadius: "50%",
              border: "3px solid white",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.5), 0 0 0 4px rgba(59,130,246,0.3)"
            }}
          />
          <div
            style={{
              marginTop: 12,
              padding: "6px 16px",
              backgroundColor: "rgba(0,0,0,0.85)",
              borderRadius: 30,
              color: "white",
              fontSize: 20,
              fontWeight: "bold",
              border: "1px solid #3B82F6"
            }}
          >
            {username}
          </div>
        </div>
      </div>,
      {
        width: CROP_SIZE,
        height: CROP_SIZE
      }
    );
  } catch (error) {
    console.error("User image generation failed:", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}
