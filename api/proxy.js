const DEFAULT_ALLOWED_HOSTS = [
  "test-streams.mux.dev",
  "bitdash-a.akamaihd.net",
  "demo.unified-streaming.com",
  "storage.googleapis.com"
];

function parseAllowedHosts() {
  const raw = process.env.PROXY_ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS.join(",");
  return raw
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isHostAllowed(hostname, allowedHosts) {
  const host = hostname.toLowerCase();
  return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function getProxyBase(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}/api/proxy`;
}

function proxiedUrl(req, targetUrl) {
  return `${getProxyBase(req)}?url=${encodeURIComponent(targetUrl)}`;
}

function rewritePlaylist(req, playlistText, sourceUrl) {
  return playlistText
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          const absoluteUri = new URL(uri, sourceUrl).toString();
          return `URI="${proxiedUrl(req, absoluteUri)}"`;
        });
      }

      const absoluteUrl = new URL(trimmed, sourceUrl).toString();
      return proxiedUrl(req, absoluteUrl);
    })
    .join("\n");
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range,Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    return res.status(405).json({ error: "method not allowed" });
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;

  if (!rawUrl) {
    return res.status(400).json({
      error: "url required",
      example: `${getProxyBase(req)}?url=${encodeURIComponent("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")}`,
      allowedHosts: parseAllowedHosts()
    });
  }

  let target;
  try {
    target = new URL(rawUrl);
  } catch (_error) {
    return res.status(400).json({ error: "url must be a valid absolute URL" });
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return res.status(400).json({ error: "only http and https URLs are allowed" });
  }

  const allowedHosts = parseAllowedHosts();
  if (!isHostAllowed(target.hostname, allowedHosts)) {
    return res.status(403).json({
      error: "host is not allowlisted",
      host: target.hostname,
      allowedHosts,
      note: "Add trusted test domains with the PROXY_ALLOWED_HOSTS environment variable."
    });
  }

  const upstreamHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };

  if (req.headers.range) {
    upstreamHeaders.Range = req.headers.range;
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: upstreamHeaders,
      redirect: "follow"
    });

    res.status(upstream.status);

    const passthroughHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified"
    ];

    for (const header of passthroughHeaders) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    const contentType = upstream.headers.get("content-type") || "";
    const isPlaylist =
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegurl") ||
      target.pathname.endsWith(".m3u8");

    if (req.method === "HEAD") {
      return res.end();
    }

    if (isPlaylist) {
      const text = await upstream.text();
      res.setHeader("content-type", "application/vnd.apple.mpegurl; charset=utf-8");
      res.removeHeader("content-length");
      return res.send(rewritePlaylist(req, text, target));
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    return res.status(502).json({
      error: "upstream request failed",
      message: error.message
    });
  }
}
