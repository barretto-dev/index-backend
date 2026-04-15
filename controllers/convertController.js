const convertService = require("../services/convertService");

let convertClients = [];
let convertRunning = false;

function registerConvertSocket(ws) {
  convertClients.push(ws);

  ws.on("close", () => {
    convertClients = convertClients.filter((client) => client !== ws);
  });
}

function broadcast(message) {
  convertClients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  });
}

function runConvert(req, res) {
  if (convertRunning) {
    return res.status(400).json({
      message: "Já existe uma conversão em andamento",
    });
  }

  convertRunning = true;

  convertService.runConvertWithStreaming(
    (output) => {
      broadcast(output);
    },
    (exitCode) => {
      broadcast(`\n[processo finalizado com código ${exitCode}]\n`);
      convertRunning = false;
    }
  );

  return res.status(200).json({
    message: "Conversão iniciada",
  });
}

module.exports = {
  runConvert,
  registerConvertSocket,
};