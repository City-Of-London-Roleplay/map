export default async function handler(req, res) {
  try {
    const serverRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/server`
    );
    const { CommandLogs } = await serverRes.json();

    res.status(200).json(CommandLogs || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch command logs" });
  }
}
