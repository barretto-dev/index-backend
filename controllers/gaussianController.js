const fsp = require("fs").promises;
const path = require("path");
const service = require("../services/gaussianService");

let clients = [];
let start_train_running = false;

const FRAMES_DIR = "/development/frames";
const GAUSSIAN_DIR = "/development/gaussian-splatting"

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

async function stopTrain(req, res) {

  let result  = null
  let newest_folder_name = null

  try {
    result = service.endTrain();

    //Deletar pasta do treinamento que foi encerrado
    newest_folder_name = await getLastTrainningFolderName(GAUSSIAN_DIR)

    if (!result.success) 
      return res.status(500).json(result);

    broadcast("\n[Pedido para encerrar treinamento enviado]\n");
  } catch (error) {
    console.log(error)
    return res.status(500).json({message:"Erro ao encerrar treinamento"});
  }
 
  try {
    const new_folder_dir = path.join(GAUSSIAN_DIR, "output", newest_folder_name);
    await fsp.rm(new_folder_dir, { recursive: true, force: true })
  } catch (error) {
    console.log(error)
    return res.status(400).json({
      message: `Treinamento encerrado, mas sua pasta (${newest_folder_name}) não foi removida`
    });
  }
  
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


async function getLastTrainningFolderName(dirPath){
  try {

    const outputPath = dirPath+`/output`

    // Verifica se pasta "output" existe,
    // retornando null caso negativo
    try {
      await fsp.access(outputPath);
    } catch {
      console.log("Pasta output não encontrada")
      return null
    }

    const items = await fsp.readdir(outputPath);

    //Caso pasta "output" esteja vazia
    if (!items.length){ 
      console.log("Pasta output está vazia")
      return null
    }

    const foldersWithStats = await Promise.all(
      items.map(async (name) => {
        const fullPath = path.join(outputPath, name)
        const stat = await fsp.stat(fullPath)
        return { name, time: stat.mtime }
      })
    );

    // const validFolders = foldersWithStats.filter(Boolean);
    // if (!validFolders.length) 
    //   return null;

    // Ordena pela data de modificação (mais recente primeiro)
    foldersWithStats.sort((a, b) => b.time - a.time)

    return foldersWithStats[0].name

  } catch (err) {
    console.log("Erro inesperado em getLastTrainningFolderName")
    throw err
  }
}

module.exports = {
  startTrain,
  stopTrain,
  registerSocket,
};