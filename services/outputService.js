const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = "/development/gaussian-splatting/output";

function listOutputFolders() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    throw new Error(`Diretório não encontrado: ${OUTPUT_DIR}`);
  }

  const entries = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true });

  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(OUTPUT_DIR, entry.name);
      const stats = fs.statSync(fullPath);

      const hasBirthtime =
        stats.birthtime instanceof Date &&
        !Number.isNaN(stats.birthtime.getTime()) &&
        stats.birthtime.getTime() > 0;

      return {
        name: entry.name,
        createdAt: hasBirthtime ? stats.birthtime.toISOString() : null,
        modifiedAt: stats.mtime ? stats.mtime.toISOString() : null,
      };
    })
    .sort((a, b) => {
      const aTime = a.createdAt || a.modifiedAt || "";
      const bTime = b.createdAt || b.modifiedAt || "";
      return bTime.localeCompare(aTime);
    });

  return folders;
}

module.exports = {
  listOutputFolders,
};