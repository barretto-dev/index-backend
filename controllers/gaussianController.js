const fsp = require("fs").promises;
const path = require("path");
const service = require("../services/gaussianService");

let clients = [];
let start_train_running = false;

const FRAMES_DIR = "/development/frames";

async function startTrain(req, res) {

  if (start_train_running) 
    return res.status(400).json({message: "Treinamento já foi iniciado",});

  //VERIFICAR SE TODOS OS ARQUIVOS DE TREINAMENTO EXISTEM
  const {missingDirs, missingFiles} = await checkColmapStructure(FRAMES_DIR)

  if(missingDirs.length > 0 || missingFiles.length > 0){
    console.log("missingDirs: "+missingDirs)
    console.log("missingFiles: "+missingFiles)
    return res.status(400).json({message: "Falta de dados para inicia treinamento, por favor faça o preparo dos frames",});
  }

  start_train_running = true

  try{
    const result = await service.runTrain((output) => {broadcast(output)});
    start_train_running = false;

    if (!result.success) 
      return res.status(500).json({message: "Processo de treinamento encerrado com erro"});
    
    return res.status(200).json({message: "Processo de treinamento executado com sucesso"});

  } catch (err) {
    console.error("Erro ao executar train.py:", err);
    broadcast(`\n[erro interno: ${err.message}]\n`);

    return res.status(500).json({
      message: "Erro interno ao executar train.py",
      error: err.message,
    });
  }
}

function stopTrain(req, res) {
  const result = service.endTrain();

  if (!result.success) 
    return res.status(400).json(result);

  broadcast("\n[Pedido para encerrar treinamento enviado]\n");
  return res.status(200).json(result);
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

async function checkColmapStructure(baseDir) {
  
  const requiredDirs = ["distorted", "images", "input", "sparse", "stereo"]
  const requiredFiles = [
    "run-colmap-geometric.sh",
    "run-colmap-photometric.sh",
  ];

  const missingDirs = []
  const missingFiles = []

  //Verificando pastas
  for (const dir of requiredDirs) {
    const fullPath = path.join(baseDir, dir)

    try {
      const stats = await fsp.stat(fullPath)
      if (!stats.isDirectory()) 
        missingDirs.push(dir)
    
    } catch (err) {
      if (err.code === "ENOENT") 
        missingDirs.push(dir)
      else 
        throw err
    }
  }

  //Verificando arquivos
  for (const file of requiredFiles) {
    const fullPath = path.join(baseDir, file)

    try {
      const stats = await fsp.stat(fullPath)
      if (!stats.isFile()) 
        missingFiles.push(file)
    
    } catch (err) {
      if (err.code === "ENOENT") 
        missingFiles.push(file)
      else 
        throw err
    }
  }

  return {
    missingDirs,
    missingFiles,
  };
}

module.exports = {
  startTrain,
  stopTrain,
  registerSocket,
};