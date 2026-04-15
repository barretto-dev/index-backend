const axios = require("axios");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");


const service = require("../services/imageService");

function downloadImagesZip(req, res) {
  try {
    service.streamImagesZip(res);
  } catch (err) {
    console.error("Erro ao gerar zip das imagens:", err.message);
    return res.status(500).json({
      error: "Falha ao gerar zip das imagens",
      details: err.message,
    });
  }
}

async function downloadAndSave(req, res) {
    try {
      const url = "http://localhost:3001/images/download";
      const zipPath = "/development/images.zip";
      const extractPath = "/development/frames/input";
  
      // cria pasta de extração se não existir
      fs.mkdirSync(extractPath, { recursive: true });
  
      const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
      });
  
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

          res.send(`Arquivo salvo em ${zipPath} e extraído em ${extractPath}`);
        } catch (err) {
          console.error("Erro ao extrair ZIP:", err);
          res.status(500).send("ZIP baixado, mas houve erro ao extrair");
        }
      });
  
      writer.on("error", (err) => {
        console.error("Erro ao salvar ZIP:", err);
        res.status(500).send("Erro ao salvar arquivo ZIP");
      });
    } catch (err) {
      console.error("Erro no download:", err);
      res.status(500).send("Erro no download do ZIP");
    }
  }

async function prepareFrames(req, res) {
  try {
    const result = await service.runColmap();

    if (!result.success) {
      return res.status(500).json({
        message: "Comando finalizado com erro",
        ...result,
      });
    }

    return res.status(200).json({
      message: "Comando executado com sucesso",
      ...result,
    });
  } catch (err) {
    console.error("Erro ao executar convert.py:", err);

    return res.status(500).json({
      message: "Erro interno ao executar convert.py",
      error: err.message,
    });
  }
}

module.exports = {
  downloadImagesZip,
  downloadAndSave,
  prepareFrames,
};