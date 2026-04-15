const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { spawn } = require("child_process");

const IMAGES_DIR = "/development/camera_data/images";
const FRAMES_DIR = "/development/frames/";

function streamImagesZip(res) {
  if (!fs.existsSync(IMAGES_DIR)) {
    throw new Error(`Diretório não encontrado: ${IMAGES_DIR}`);
  }

  const stats = fs.statSync(IMAGES_DIR);
  if (!stats.isDirectory()) {
    throw new Error(`O caminho não é um diretório: ${IMAGES_DIR}`);
  }

  const files = fs.readdirSync(IMAGES_DIR);
  if (files.length === 0) {
    throw new Error("Não há arquivos para compactar");
  }

  const zipName = `images_${Date.now()}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("warning", (err) => {
    if (err.code === "ENOENT") {
      console.warn("Aviso ao gerar zip:", err.message);
      return;
    }
    throw err;
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(res);

  // Adiciona todo o conteúdo da pasta, sem incluir a pasta pai no zip
  archive.directory(IMAGES_DIR, false);

  return archive.finalize();
}

function runColmap() {
  return new Promise((resolve, reject) => {
    const imgProcess = spawn(
      "python3",
      ["convert.py", "-s", FRAMES_DIR],
      {
        cwd: "/development/gaussian-splatting/",
        env: {...process.env},
      }
    );

    let stdout = "";
    let stderr = "";

    imgProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    imgProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    imgProcess.on("error", (err) => {
      reject(err);
    });

    imgProcess.on("close", (code) => {
      resolve({
        success: code === 0,
        exitCode: code,
        stdout,
        stderr,
      });
    });
  });
}

module.exports = {
  streamImagesZip,
  runColmap,
};