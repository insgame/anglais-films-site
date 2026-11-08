const BASE = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function run(cmds) {
  const r = await fetch(BASE + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("db " + r.status);
  return (await r.json()).map((x) => x.result);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!BASE || !TOKEN) return res.status(500).json({ error: "storage not connected" });

    if (req.method === "GET") {
      const [h, s] = await run([["HGETALL", "recos"], ["SMEMBERS", "likes"]]);
      const recos = [];
      for (let i = 0; i < (h || []).length; i += 2) {
        try { recos.push(JSON.parse(h[i + 1])); } catch (e) {}
      }
      const likes = (s || []).map((k) => {
        const [t, v] = k.split("__");
        return { tmdb_id: Number(t), voter: v };
      });
      return res.status(200).json({ recos, likes });
    }

    if (req.method === "POST") {
      const b = req.body || {};
      const voter = String(b.voter || "");
      if (!/^[\w-]{8,64}$/.test(voter) || !Number.isInteger(b.tmdb_id)) {
        return res.status(400).json({ error: "bad request" });
      }

      if (b.action === "like") {
        await run([[b.on ? "SADD" : "SREM", "likes", b.tmdb_id + "__" + voter]]);
        return res.status(200).json({ ok: true });
      }

      if (b.action === "rec") {
        const student = String(b.student || "").trim().slice(0, 40);
        const title = String(b.title || "").trim().slice(0, 150);
        if (!student || !title) return res.status(400).json({ error: "bad request" });
        const poster = /^\/[\w.-]{1,80}$/.test(String(b.poster || "")) ? String(b.poster) : "";
        const rec = {
          tmdb_id: b.tmdb_id,
          title,
          year: String(b.year || "").slice(0, 4),
          poster,
          overview: String(b.overview || "").slice(0, 600),
          student,
          created_at: Date.now(),
        };
        await run([["HSET", "recos", b.tmdb_id + "__" + student.toLowerCase(), JSON.stringify(rec)]]);
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server error" });
  }
};
