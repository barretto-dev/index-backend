const { spawn } = require("child_process");

let sibrProcess = null;

function startSibr() {
  if (sibrProcess) {
    return "SIBR já está rodando";
  }

  sibrProcess = spawn(
    "./SIBR_viewers/install/bin/SIBR_gaussianViewer_app",
    ["-m", "/development/gaussian-splatting/output/93b9bc89-1", "--fullscreen"],
    {
      cwd: "/development/gaussian-splatting/",
      env: { ...process.env},
    }
  );

  sibrProcess.stdout.on("data", (data) => {
    console.log(`SIBR: ${data}`);
  });

  sibrProcess.stderr.on("data", (data) => {
    console.error(`SIBR ERROR: ${data}`);
  });

  sibrProcess.on("close", () => {
    console.log("SIBR finalizado");
    sibrProcess = null;
  });

  return "SIBR iniciado";
}

function stopSibr() {
  if (!sibrProcess) {
    return "SIBR não está rodando";
  }

  const proc = sibrProcess;

  proc.kill("SIGTERM");

  setTimeout(() => {
    if (sibrProcess === proc) {
      try {
        proc.kill("SIGKILL");
      } catch (err) {
        console.error("Erro ao forçar parada:", err.message);
      }
    }
  }, 2000);

  return "Comando de parada enviado";
}

module.exports = {
  startSibr,
  stopSibr,
};