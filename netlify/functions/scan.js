exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" }, { Allow: "GET" });
  const jwt = process.env.TXLINE_JWT;
  const token = process.env.TXLINE_API_TOKEN;
  const origin = process.env.TXLINE_API_ORIGIN || "https://txline.txodds.com";
  if (!jwt || !token) return json(503, { error: "TxLINE credentials are not configured" });
  const headers = { Authorization: `Bearer ${jwt}`, "X-Api-Token": token, Accept: "application/json" };

  try {
    const base = origin.replace(/\/$/, "");
    const fixturesResponse = await fetch(`${base}/api/fixtures/snapshot`, { headers });
    if (!fixturesResponse.ok) return json(fixturesResponse.status, { error: "Fixture snapshot failed" });
    const fixtures = await fixturesResponse.json();
    const markets = await Promise.all(fixtures.slice(0, 12).map(async (fixture) => {
      const response = await fetch(`${base}/api/odds/snapshot/${fixture.FixtureId}`, { headers });
      if (!response.ok) return { fixtureId: fixture.FixtureId, rows: [], status: response.status };
      const rows = await response.json();
      return { fixtureId: fixture.FixtureId, rows: Array.isArray(rows) ? rows : [], status: response.status };
    }));
    return json(200, { scannedAt: Date.now(), integrity: "ok", fixtures, markets }, { "Cache-Control": "no-store" });
  } catch (error) {
    return json(502, { error: "TxLINE upstream unavailable" });
  }
};

function json(statusCode, body, headers = {}) {
  return { statusCode, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) };
}
