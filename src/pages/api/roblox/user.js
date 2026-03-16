export default async function handler(req, res) {
  try {
    const avatarRes = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${req.query.userId}&size=150x150&format=Png&isCircular=false`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.rblxAPIKey
        }
      }
    );
    const avatarData = await avatarRes.json();
    const avatarUrl = avatarData.data[0].imageUrl;
    res.status(200).json(avatarUrl);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch avatar" });
  }
}
