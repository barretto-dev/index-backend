const axios = require("axios");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");


const service = require("../services/imageService");

let clients = [];
let prepare_frames_running = false;

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

  if (prepare_frames_running) 
    return res.status(400).json({message: "Frames já estão sendo preparados",});

  prepare_frames_running = true

  try{
    const result = await service.runColmap((output) => {
      clients.forEach((ws) => {
        if (ws.readyState === 1) 
          ws.send(output);
      });
    });

    prepare_frames_running = false;

    if (!result.success) 
      return res.status(500).json({message: "Processo finalizado com erro"});
    
    return res.status(200).json({message: "Processo executado com sucesso"});

  } catch (err) {
    console.error("Erro ao executar convert.py:", err);
    return res.status(500).json({message: "Erro interno ao executar convert.py"});
  }
}

function registerSocket(ws) {
  clients.push(ws);

  ws.on("close", () => {
    clients = clients.filter((client) => client !== ws);
  });
}

module.exports = {
  downloadImagesZip,
  downloadAndSave,
  prepareFrames,
  registerSocket,
};