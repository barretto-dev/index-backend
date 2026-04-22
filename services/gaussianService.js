const { spawn } = require("child_process");

let TRAIN_PROCESS = null;
const FRAMES_DIR = "/development/frames/";

function runTrain(onOutput) {
  return new Promise((resolve, reject) => {

    if (TRAIN_PROCESS) {
      return reject(new Error("Já existe um processo runColmap em execução"));
    }

    const child = spawn(
      "python3",
      [
        "train.py", "-s", FRAMES_DIR, 
        "--optimizer_type", "sparse_adam", 
        "--iterations", "7000", 
        "--resolution", "2", 
        "--save_iterations", "7000", 
        "--test_iterations", "7000",
      ],
      {
        cwd: "/development/gaussian-splatting/",
        env: process.env,
      }
    );

    TRAIN_PROCESS = child
    
    let stdout = "";
    let stderr = "";
    let settled = false;

    onOutput?.("$ cd /development/gaussian-splatting/\n");
    onOutput?.(
      "$python3 train.py -s "+FRAMES_DIR+
      " --optimizer_type sparse_adam"+
      " --iterations 7000"+
      " --resolution 2"+
      " --save_iterations 7000"+
      " --test_iterations 7000\n"
    );

    child.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      onOutput?.(text);
    });

    child.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      onOutput?.(text);
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      TRAIN_PROCESS = null;

      onOutput?.(`\n[erro ao iniciar processo: ${err.message}]\n`);
      reject(err);
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      TRAIN_PROCESS = null;

      if (signal)
        onOutput?.(`\n[processo encerrado por sinal ${signal}]\n`);
      else
        onOutput?.(`\n[processo finalizado com código ${code}]\n`);
      
      resolve({
        success: code === 0,
        exitCode: code,
        signal: signal || null,
        stdout,
        stderr,
      });
    });
  });
}

function endTrain() {

  if (!TRAIN_PROCESS) 
    return {success: false, message: "Não há processo train.py em execução"};

  const proc = TRAIN_PROCESS;

  try {
    proc.kill("SIGTERM");

    setTimeout(() => {
      if (TRAIN_PROCESS === proc) {
        try {
          proc.kill("SIGKILL");
        } catch (err) {
          console.error("Erro ao forçar parada do train.py:", err.message);
        }
      }
    }, 2000);

    return { success: true, message: "Processo de treinamento parado com sucesso"}
  } catch (err) {
    return { success: false, message: `Erro inesperado ao tentar parar treinamento: ${err.message}`}
  }
}

module.exports = {
  runTrain,
  endTrain,
};