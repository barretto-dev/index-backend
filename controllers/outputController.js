const outputService = require("../services/outputService");

function listFolders(req, res) {
  try {
    const folders = outputService.listOutputFolders();
    return res.status(200).json(folders);
  } catch (err) {
    console.error("Erro ao listar pastas de output:", err);
    return res.status(500).json({
      message: "Erro ao listar pastas",
      error: err.message,
    });
  }
}

module.exports = {
  listFolders,
};