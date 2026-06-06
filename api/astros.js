// Proxies the http-only Open-Notify endpoint so it works over https,
// with short edge caching.
export default async function handler(req, res) {
  try {
    const upstream = await fetch("http://api.open-notify.org/astros.json");
    if (!upstream.ok) throw new Error(String(upstream.status));
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch {
    res.status(502).json({ error: "upstream unavailable" });
  }
}
