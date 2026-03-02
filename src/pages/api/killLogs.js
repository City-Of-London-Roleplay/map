export default async function handler(req, res) {
  try {
    const serverRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/server`
    );
    const { KillLogs } = await serverRes.json();

    res.status(200).json(KillLogs || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch kill logs" });
  }
}
