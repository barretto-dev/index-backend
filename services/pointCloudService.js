const { spawn } = require("child_process");

let _3D_RECON_DEEP_PROCESS = null;

function run3DReconDeep(wsUrl, wsPort) {
  try {
    if (_3D_RECON_DEEP_PROCESS) {
      return {
        success: false,
        message: "Já existe um processo '3d recon deep' em execução",
      };
    }

    const child = spawn(
      "bash",
      [
        "-lc",
        `
        cd /development/3d_recon_deep &&
        source .venv/bin/activate &&
        export XFORMERS_MORE_DETAILS=1 &&
        python3 main.py --ip ws://${wsUrl}:${wsPort} --config config_da3metric_live.yaml
        `
      ],
      {
        cwd: "/development/3d_recon_deep",
        env: process.env,
        detached: true,
      }
    );

    // const child = spawn(
    //   "bash",
    //   [
    //     "-c",
    //     `
    //     source .venv/bin/activate &&
    //     python3 main.py --ip ws://${wsUrl}:${wsPort} --config config_da3metric_live.yaml
    //     `,
    //   ],
    //   {
    //     cwd: "/development/3d_recon_deep/",
    //     detached: true,
    //     env: process.env,
    //   }
    // );

    _3D_RECON_DEEP_PROCESS = child;

     console.log(`[3D_RECON_DEEP] PID GROUP: ${child.pid}`);

    child.stdout.on("data", (data) => {
      console.log(`[3D_RECON_DEEP][STDOUT] ${data}`);
    });

    child.stderr.on("data", (data) => {
      console.error(`[3D_RECON_DEEP][STDERR] ${data}`);
    });

    child.on("close", (code, signal) => {
      console.log(
        `[3D_RECON_DEEP] Finalizado | code=${code} signal=${signal}`
      );

      if (_3D_RECON_DEEP_PROCESS === child) {
        _3D_RECON_DEEP_PROCESS = null;
      }
    });

    child.on("error", (err) => {
      console.error("[3D_RECON_DEEP][ERROR]", err);

      if (_3D_RECON_DEEP_PROCESS === child) {
        _3D_RECON_DEEP_PROCESS = null;
      }
    });

    return {
      success: true,
      message: "Processo iniciado com sucesso",
    };
  } catch (error) {
    throw error;
  }
}

function stop3DReconDeep() {
  if (!_3D_RECON_DEEP_PROCESS) {
    return {
      success: false,
      message: "Não há processo em execução",
    };
  }

  const proc = _3D_RECON_DEEP_PROCESS;

  try {
    console.log(`[3D_RECON_DEEP] Encerrando grupo ${proc.pid}`);

    // MATA TODO O GRUPO
    process.kill(-proc.pid, "SIGTERM");

    setTimeout(() => {
      if (_3D_RECON_DEEP_PROCESS === proc) {
        try {
          console.log(
            `[3D_RECON_DEEP] Forçando encerramento grupo ${proc.pid}`
          );

          process.kill(-proc.pid, "SIGKILL");
        } catch (err) {
          console.error(err);
        }
      }
    }, 2000)

    return {
      success: true,
      message: "Processo encerrado com sucesso",
    }

  } catch (err) {
    throw err;
  }
}

module.exports = {
  run3DReconDeep,
  stop3DReconDeep,
};