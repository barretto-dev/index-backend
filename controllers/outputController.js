const service = require("../services/outputService");
const fsp = require("fs").promises;

function listFolders(req, res) {
  try {
    const folders = service.listOutputFolders();
    return res.status(200).json(folders);
  } catch (err) {
    console.error("Erro ao listar pastas de output:", err);
    return res.status(500).json({
      message: "Erro ao listar pastas",
      error: err.message,
    });
  }
}

async function deleteFolder(req, res) {
  try {
    const { name } = req.params
    const {success, message} = await service.deleteFolder(name);

    if(!success)
      res.status(500).json({message: message});

    return res.status(200).json({message: message});
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Erro interno ao executar remoção da pasta de treinamento",
    });
  }
}

module.exports = {
  listFolders,
  deleteFolder
};