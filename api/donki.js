// Proxies NASA DONKI notifications so the API key stays server-side,
// with short edge caching. Requests the trailing 30 days of events.
export default async function handler(req, res) {
  const key = process.env.NASA_API_KEY || "DEMO_KEY";
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const url =
    `https://api.nasa.gov/DONKI/notifications` +
    `?startDate=${fmt(start)}&endDate=${fmt(end)}&type=all&api_key=${key}`;
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error(String(upstream.status));
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch {
    res.status(502).json({ error: "upstream unavailable" });
  }
}
