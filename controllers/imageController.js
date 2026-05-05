const axios = require("axios");
const fs = require("fs");
const fsp = require('fs').promises;
const path = require("path");
const unzipper = require("unzipper");
const service = require("../services/imageService");

const FRAMES_DIR = "/development/frames";

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
      const {droneApiUrl, droneApiPort} = req.body

      const apiUrl = `http://${droneApiUrl}:${droneApiPort}/api/camera/download-latest`
      console.log(apiUrl)

      //const apiUrl = "http://localhost:3001/images/download";
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

async function startPrepareFrames(req, res) {

  if (prepare_frames_running) 
    return res.status(400).json({message: "Frames já estão sendo preparados",});

  //Verifica se frames existem
  let msg = await framesExists(FRAMES_DIR+"/input")
  if(msg != null)
    return res.status(400).json({message: msg});
  
  //Limpar pastas e arquivos do ultimo preparo
  msg = await clearBeforePreparation(FRAMES_DIR)
  if(msg != null)
    return res.status(400).json({message: msg});

  prepare_frames_running = true

  try{
    const result = await service.runColmap((output) => {broadcast(output)});
    prepare_frames_running = false;

    if (!result.success) 
      return res.status(500).json({message: "Processo finalizado com erro"});
    
    return res.status(200).json({message: "Processo executado com sucesso"});

  } catch (err) {
    console.error("Erro ao executar convert.py:", err);
    broadcast(`\n[erro interno: ${err.message}]\n`);

    return res.status(500).json({
      message: "Erro interno ao executar convert.py",
      error: err.message,
    });
  }
}

function stopPrepareFrames(req, res) {
  const result = service.stopColmap();

  if (!result.success) 
    return res.status(400).json(result);

  broadcast("\n[solicitação de parada enviada]\n");
  return res.status(200).json(result);
}


//Verificar se existem frames para serem treinados
async function framesExists(input_dir){
  try {
    await fsp.access(input_dir);
    const files = await fsp.readdir(input_dir);
    const images = files.filter((f) =>/\.(jpg|jpeg|png)$/i.test(f));

    if (images.length === 0)
      return "Frames não encontrados, tenter recebe-los novamente "

  } catch (error) {
      if (error.code === "ENOENT") 
        return "Diretorio de frames não encontrado, tenter receber os frames novamente"
      else {
        console.log(error)
        return "Não foi possivel verificar ser frames existem"
      }
  }
  return null
}

async function clearBeforePreparation(frames_dir){
  //Apagar pastas do ultimo preparo de frames
  try {
      await fsp.rm(frames_dir+"/distorted", { recursive: true, force: true })
      await fsp.rm(frames_dir+"/images", { recursive: true, force: true })
      await fsp.rm(frames_dir+"/sparse", { recursive: true, force: true })
      await fsp.rm(frames_dir+"/stereo", { recursive: true, force: true })
  } catch (error) {
    console.log(error)
    return "Error ao limpar pastas de preparo de frames"
  }

   //Apagar arquivos do ultimo preparo de frames
  try {
    await fsp.unlink(frames_dir+"/run-colmap-geometric.sh");
    await fsp.unlink(frames_dir+"/run-colmap-photometric.sh");
  } catch (error) {
     if (error.code === "ENOENT") {
      //arquivo não existe, o que está ok
      return null
    }else
      return res.status(500).json({message: "Error ao limpar aquivos .sh de preparo de frames "});
  }
  return null

}

function registerSocket(ws) {
  clients.push(ws);

  ws.on("close", () => {
    clients = clients.filter((client) => client !== ws);
  });
}

function broadcast(message) {
  clients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  });
}

module.exports = {
  downloadImagesZip,
  downloadAndSave,
  startPrepareFrames,
  stopPrepareFrames,
  registerSocket,
};