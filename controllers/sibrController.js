const sibrService = require("../services/sibrService");

function start(req, res) {
  try {
    const { folderName } = req.body;
    const result = sibrService.startSibr(folderName);
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao iniciar SIBR");
  }
}

function stop(req, res) {
  try {
    const result = sibrService.stopSibr();
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao parar SIBR");
  }
}

module.exports = {
  start,
  stop,
};