const fs = require("fs");
const fsp = require('fs').promises;
const axios = require("axios");
const unzipper = require("unzipper");
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

async function downloadAndSave(apiUrl, zipPath, extractPath){

      //Limpando diteorio de extração do zip
      await fsp.rm(extractPath, { recursive: true, force: true })

      //Criando diretorio de extração caso não exista
      fs.mkdirSync(extractPath, { recursive: true });

      var response = null

      try {
        response = await axios({
          method: "GET",
          url: apiUrl,
          responseType: "stream",
        });
      } catch (error) {
        console.log(error.message)
        throw new Error(`Não foi possível adquirir arquivo .zip`);
      }

      // Retorna uma Promise que será resolvida ou rejeitada baseada nos eventos
      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);

        writer.on("finish", async () => {
          try {
            await fs
              .createReadStream(zipPath)
              .pipe(unzipper.Extract({ path: extractPath }))
              .promise();

            console.log(`ZIP salvo em: ${zipPath}`);
            console.log(`Arquivos extraídos em: ${extractPath}`);
            
            fs.unlinkSync(zipPath);
            
            console.log(`Arquivo salvo em ${zipPath} e extraído em ${extractPath}`)
            resolve({ message: `Download e extração do zip feita com sucesso`});

          } catch (err) {
            console.error("Erro ao extrair ZIP:", err);
            reject(new Error("ZIP baixado, mas houve erro ao extrair"));
          }
        });

        writer.on("error", (err) => {
          console.error("Erro ao salvar ZIP:", err);
          reject(new Error("Erro ao salvar arquivo ZIP"));
        });
      });
  }

function runColmap(onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "python3",
      ["convert.py", "-s", FRAMES_DIR],
      {
        cwd: "/development/gaussian-splatting/",
        env: { ...process.env },
      }
    );

    let stdout = "";
    let stderr = "";

    onOutput?.("$ cd /development/gaussian-splatting/\n");
    onOutput?.(`$ python3 convert.py -s ${FRAMES_DIR}\n\n`);

    child.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      onOutput?.(text);
    });

    child.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      onOutput?.(text);
    });

    child.on("error", (err) => {
      onOutput?.(`\n[erro ao iniciar processo: ${err.message}]\n`);
      reject(err);
    });

    child.on("close", (code) => {
      onOutput?.(`\n[processo finalizado com código ${code}]\n`);

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
  downloadAndSave,
  runColmap,
};