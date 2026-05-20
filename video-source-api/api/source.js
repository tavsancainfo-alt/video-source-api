export default async function handler(req, res) {
  const { tmdb } = req.query;

  if (!tmdb) {
    return res.status(400).json({
      error: "tmdb required"
    });
  }

  return res.status(200).json({
    tmdb: String(tmdb),
    sources: []
  });
}
