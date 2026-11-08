module.exports = async (req, res) => {
  const key = process.env.TMDB_KEY;
  const q = String((req.query && req.query.q) || "").slice(0, 100);
  if (!key || q.length < 2) return res.status(400).json({ results: [] });
  try {
    const r = await fetch(
      "https://api.themoviedb.org/3/search/movie?api_key=" + encodeURIComponent(key) +
      "&language=en-US&include_adult=false&query=" + encodeURIComponent(q)
    );
    const d = await r.json();
    res.setHeader("Cache-Control", "s-maxage=3600");
    return res.status(r.ok ? 200 : 502).json({
      results: (d.results || []).slice(0, 6).map((m) => ({
        id: m.id,
        title: m.title,
        release_date: m.release_date,
        poster_path: m.poster_path,
        overview: m.overview,
      })),
    });
  } catch (e) {
    return res.status(502).json({ results: [] });
  }
};
