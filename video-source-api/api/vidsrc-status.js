import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default async function handler(req, res) {
  try {
    const packageJsonPath = require.resolve("vidsrc.extractor.module/package.json");
    const packageJson = require(packageJsonPath);

    return res.status(200).json({
      installed: true,
      package: packageJson.name,
      version: packageJson.version,
      importable: false,
      reason: "The GitHub package installs source files, but it does not publish an index.js/main/export entry.",
      expectedSource: "node_modules/vidsrc.extractor.module/src/vidsrc.ts"
    });
  } catch (error) {
    return res.status(500).json({
      installed: false,
      importable: false,
      error: error.message
    });
  }
}
