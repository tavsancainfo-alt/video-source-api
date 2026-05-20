import tmdbScrape from "../lib/vidsrc/vidsrc.js";

export default async function handler(req, res) {
  const { tmdb, type = "movie", season, episode } = req.query;

  if (!tmdb) {
    return res.status(400).json({
      error: "tmdb required"
    });
  }

  if (!["movie", "tv"].includes(type)) {
    return res.status(400).json({
      error: "type must be movie or tv"
    });
  }

  try {
    const embedUrl = type === "movie"
      ? `https://vidsrc.me/embed/${type}?tmdb=${encodeURIComponent(String(tmdb))}`
      : `https://vidsrc.me/embed/${type}?tmdb=${encodeURIComponent(String(tmdb))}&season=${encodeURIComponent(String(season || ""))}&episode=${encodeURIComponent(String(episode || ""))}`;

    const scrapePromise = tmdbScrape(
      String(tmdb),
      type,
      season ? Number(season) : undefined,
      episode ? Number(episode) : undefined
    );

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("vidsrc scrape timed out")), 15000);
    });

    const rawSources = await Promise.race([scrapePromise, timeoutPromise]);
    const sources = rawSources
      .filter((source) => source && source.stream)
      .map((source, index) => ({
        name: source.name || `Source ${index + 1}`,
        type: "hls",
        quality: "auto",
        url: source.stream,
        referer: source.referer || null,
        mediaId: source.mediaId || String(tmdb)
      }));

    return res.status(200).json({
      tmdb: String(tmdb),
      type,
      sources,
      rawCount: rawSources.length,
      fallbackEmbed: embedUrl,
      note: sources.length
        ? "vidsrc extractor returned playable stream URLs."
        : "vidsrc extractor ran, but returned no playable stream URLs. The upstream page may require a browser challenge or its layout may have changed."
    });
  } catch (error) {
    return res.status(502).json({
      tmdb: String(tmdb),
      type,
      sources: [],
      error: error.message,
      note: "vidsrc extractor could not complete the upstream request."
    });
  }
}
