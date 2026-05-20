import { createRequire } from "node:module";
import tmdbScrape from "../lib/vidsrc/vidsrc.js";

const require = createRequire(import.meta.url);

export default async function handler(req, res) {
  try {
    const packageJsonPath = require.resolve("vidsrc.extractor.module/package.json");
    const packageJson = require(packageJsonPath);

    return res.status(200).json({
      installed: true,
      package: packageJson.name,
      version: packageJson.version,
      importable: typeof tmdbScrape === "function",
      adapter: "lib/vidsrc/vidsrc.js",
      defaultBaseUrl: process.env.VIDSRC_BASE_URL || "https://vidsrc.me",
      note: "The GitHub package is installed, and this project uses a compiled JavaScript adapter. Upstream pages may still return no streams if they require browser verification."
    });
  } catch (error) {
    return res.status(500).json({
      installed: false,
      importable: false,
      error: error.message
    });
  }
}
