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
      //const apiUrl = "http://192.168.0.20:8080/api/camera/download-latest"
      const apiUrl = "http://localhost:3001/images/download";
      const zipPath = "/development/images.zip";
      const extractPath = "/development/frames/input";

      const result = await service.downloadAndSave(apiUrl, zipPath, extractPath);

      res.status(200).json({
        message: "Download e extração de frames concluídos com sucesso",
      })

    } catch (err) {
      console.log(err.message)
      res.status(500).json({ message: err.message })
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