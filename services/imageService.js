const fs = require("fs");
const fsp = require('fs').promises;
const axios = require("axios");
const unzipper = require("unzipper");
const path = require("path");
const archiver = require("archiver");
const { spawn } = require("child_process");
const WebSocket = require("ws");


const IMAGES_DIR = "/development/camera_data/images";
const FRAMES_DIR = "/development/frames/";
let COLMAP_PROCESS = null;
let RECORD_PROCESS = null;
let RECORD_WS = null;
let RECORD_WS_PAUSED = false;
let RTMP_PREVIEW_PROCESS = null;
let RTMP_PREVIEW_KEY = null;
const RTMP_PREVIEW_CLIENTS = new Set();


function streamImagesZip(res) {
  if (!fs.existsSync(IMAGES_DIR)) {
    throw new Error(`Diretório não encontrado: ${IMAGES_DIR}`);
  }

  const stats = fs.statSync(IMAGES_DIR);
  if (!stats.isDirectory()) {
    throw new Error(`O caminho não é um diretório: ${IMAGES_DIR}`);
  }

  const files = fs.readdirSync(IMAGES_DIR);
  if (files.length === 0) {
    throw new Error("Não há arquivos para compactar");
  }

  const zipName = `images_${Date.now()}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("warning", (err) => {
    if (err.code === "ENOENT") {
      console.warn("Aviso ao gerar zip:", err.message);
      return;
    }
    throw err;
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(res);

  // Adiciona todo o conteúdo da pasta, sem incluir a pasta pai no zip
  archive.directory(IMAGES_DIR, false);

  return archive.finalize();
}

async function downloadAndSave(apiUrl, zipPath, extractPath) {

  //Limpando diteorio de extração do zip
  await fsp.rm(extractPath, { recursive: true, force: true })

  //Criando diretorio de extração caso não exista
  fs.mkdirSync(extractPath, { recursive: true });

  var response = null

  try {
    response = await axios({
      method: "GET",
      url: apiUrl,
      responseType: "stream",
    });
  } catch (error) {
    console.log(error.message)
    throw new Error(`Não foi possível adquirir arquivo .zip`);
  }

  // Retorna uma Promise que será resolvida ou rejeitada baseada nos eventos
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    writer.on("finish", async () => {
      try {
        await fs
          .createReadStream(zipPath)
          .pipe(unzipper.Extract({ path: extractPath }))
          .promise();

        console.log(`ZIP salvo em: ${zipPath}`);
        console.log(`Arquivos extraídos em: ${extractPath}`);

        fs.unlinkSync(zipPath);

        console.log(`Arquivo salvo em ${zipPath} e extraído em ${extractPath}`)
        resolve({ message: `Download e extração do zip feita com sucesso` });

      } catch (err) {
        console.error("Erro ao extrair ZIP:", err);
        reject(new Error("ZIP baixado, mas houve erro ao extrair"));
      }
    });

    writer.on("error", (err) => {
      console.error("Erro ao salvar ZIP:", err);
      reject(new Error("Erro ao salvar arquivo ZIP"));
    });
  });
}

function runColmap(onOutput) {
  return new Promise((resolve, reject) => {

    if (COLMAP_PROCESS) {
      return reject(new Error("Já existe um processo runColmap em execução"));
    }

    const child = spawn(
      "python3",
      ["convert.py", "-s", FRAMES_DIR, "--no_gpu"],
      {
        cwd: "/development/gaussian-splatting/",
        env: { ...process.env },
      }
    );

    COLMAP_PROCESS = child

    let stdout = "";
    let stderr = "";
    let settled = false;

    onOutput?.("$ cd /development/gaussian-splatting/\n");
    onOutput?.(`$ python3 convert.py -s ${FRAMES_DIR}\n\n`);

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
      COLMAP_PROCESS = null;

      onOutput?.(`\n[erro ao iniciar processo: ${err.message}]\n`);
      reject(err);
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      COLMAP_PROCESS = null;

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

function stopColmap() {

  if (!COLMAP_PROCESS)
    return { success: false, message: "Não há processo runColmap em execução" };

  const proc = COLMAP_PROCESS;

  try {
    proc.kill("SIGTERM");

    setTimeout(() => {
      if (COLMAP_PROCESS === proc) {
        try {
          proc.kill("SIGKILL");
        } catch (err) {
          console.error("Erro ao forçar parada do runColmap:", err.message);
        }
      }
    }, 2000);

    return { success: true, message: "Comando de parada enviado" }
  } catch (err) {
    return { success: false, message: `Erro ao encerrar processo: ${err.message}` }
  }
}

function addRtmpPreviewClient(ws, rtmpUrl, fps) {
  RTMP_PREVIEW_CLIENTS.add(ws);

  ws.on("close", () => {
    RTMP_PREVIEW_CLIENTS.delete(ws);

    if (RTMP_PREVIEW_CLIENTS.size === 0) {
      stopRtmpPreview();
    }
  });

  ws.on("error", () => {
    RTMP_PREVIEW_CLIENTS.delete(ws);
  });

  const previewKey = `${rtmpUrl}|${fps}`;
  if (!RTMP_PREVIEW_PROCESS || RTMP_PREVIEW_KEY !== previewKey) {
    startRtmpPreview(rtmpUrl, fps, previewKey);
  }
}

function startRtmpPreview(rtmpUrl, fps, previewKey) {
  stopRtmpPreview();

  RTMP_PREVIEW_KEY = previewKey;
  RTMP_PREVIEW_PROCESS = spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-fflags", "nobuffer",
    "-flags", "low_delay",
    "-probesize", "1000000",
    "-analyzeduration", "1000000",
    "-i", rtmpUrl,
    "-an",
    "-codec:v", "mpeg1video",
    "-bf", "0",
    "-r", String(fps),
    "-g", "30",
    "-b:v", "5000k",
    "-maxrate", "8000k",
    "-bufsize", "4000k",
    "-f", "mpegts",
    "-flush_packets", "1",
    "-muxdelay", "0.001",
    "-"
  ]);

  RTMP_PREVIEW_PROCESS.stdout.on("data", (data) => {
    RTMP_PREVIEW_CLIENTS.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        if (client.bufferedAmount > 2 * 1024 * 1024) {
          return;
        }
        client.send(data);
      }
    });
  });

  RTMP_PREVIEW_PROCESS.stderr.on("data", (data) => {
    const message = data.toString().trim();
    if (message) {
      console.error(`[ffmpeg-rtmp-preview] ${message}`);
    }
  });

  RTMP_PREVIEW_PROCESS.on("error", (err) => {
    console.error("Erro no preview RTMP:", err.message);
    stopRtmpPreview();
  });

  RTMP_PREVIEW_PROCESS.on("close", () => {
    RTMP_PREVIEW_PROCESS = null;
    RTMP_PREVIEW_KEY = null;
  });
}

function stopRtmpPreview() {
  if (!RTMP_PREVIEW_PROCESS) return;

  const proc = RTMP_PREVIEW_PROCESS;
  RTMP_PREVIEW_PROCESS = null;
  RTMP_PREVIEW_KEY = null;

  try {
    proc.kill("SIGTERM");

    setTimeout(() => {
      try {
        if (proc.exitCode === null) {
          proc.kill("SIGKILL");
        }
      } catch (err) { }
    }, 2000);
  } catch (err) {
    console.error("Erro ao encerrar preview RTMP:", err.message);
  }
}

function pauseRecordWebSocket() {
  if (!RECORD_WS || RECORD_WS_PAUSED || !RECORD_WS._socket) return;

  RECORD_WS._socket.pause();
  RECORD_WS_PAUSED = true;
}

function resumeRecordWebSocket() {
  if (!RECORD_WS || !RECORD_WS_PAUSED || !RECORD_WS._socket || RECORD_WS.readyState !== WebSocket.OPEN) return;

  RECORD_WS._socket.resume();
  RECORD_WS_PAUSED = false;
}

function drainProcessStderr(process, prefix) {
  if (!process || !process.stderr) return;

  process.stderr.on("data", (data) => {
    const message = data.toString().trim();
    if (message) {
      console.error(`[${prefix}] ${message}`);
    }
  });
}

async function startRecordWS(wsUrl, outputDir) {
  if (RECORD_PROCESS) {
    throw new Error("Já existe uma gravação via WebSocket em execução");
  }

  // Limpar a pasta frames antes de começar (conforme solicitado pelo usuário)
  try {
    const parentDir = path.dirname(outputDir); // /development/frames
    if (fs.existsSync(parentDir)) {
      console.log(`Limpando diretório de frames: ${parentDir}`);
      fs.rmSync(parentDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    console.error("Erro ao limpar/criar pastas de frames:", err.message);
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    try {
      RECORD_WS = new WebSocket(wsUrl);

      // Use PNG frames in live_stream mode to avoid lossy JPEG recompression.
      RECORD_PROCESS = spawn("ffmpeg", [
        "-hide_banner",
        "-loglevel", "error",
        "-fflags", "nobuffer",
        "-flags", "low_delay",
        "-probesize", "1000000",
        "-analyzeduration", "1000000",
        "-i", "pipe:0",
        "-an",
        "-vf", "fps=5",
        "-compression_level", "0",
        path.join(outputDir, "frame_%05d.png")
      ]);

      drainProcessStderr(RECORD_PROCESS, "ffmpeg-record-ws");

      RECORD_PROCESS.stdin.on("drain", () => {
        resumeRecordWebSocket();
      });

      RECORD_WS.on("open", () => {
        console.log(`Conectado ao WebSocket da câmera: ${wsUrl}`);
        settled = true;
        resolve({ success: true, message: "Gravação via WebSocket iniciada" });
      });

      RECORD_WS.on("message", (data) => {
        if (RECORD_PROCESS && RECORD_PROCESS.stdin.writable) {
          const canContinue = RECORD_PROCESS.stdin.write(data);
          if (!canContinue) {
            pauseRecordWebSocket();
          }
        }
      });

      RECORD_WS.on("error", (err) => {
        console.error("Erro no WebSocket de gravação:", err.message);
        stopRecordWS();
        if (!settled) {
          settled = true;
          reject(new Error(`Falha ao conectar ao WebSocket da câmera ${wsUrl}: ${err.message}`));
        }
      });

      RECORD_PROCESS.on("error", (err) => {
        console.error("Erro no processo FFmpeg de gravação:", err.message);
        stopRecordWS();
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      RECORD_PROCESS.on("close", () => {
        RECORD_PROCESS = null;
        if (RECORD_WS) {
          RECORD_WS.close();
          RECORD_WS = null;
        }
        RECORD_WS_PAUSED = false;
      });

      // Timeout para caso o WebSocket não conecte
      setTimeout(() => {
        if (!settled && RECORD_WS && RECORD_WS.readyState !== WebSocket.OPEN) {
          stopRecordWS();
          settled = true;
          reject(new Error("Timeout ao conectar ao WebSocket da câmera"));
        }
      }, 5000);

    } catch (err) {
      stopRecordWS();
      settled = true;
      reject(err);
    }
  });
}

function prepareRecordOutputDir(outputDir) {
  try {
    const parentDir = path.dirname(outputDir);
    if (fs.existsSync(parentDir)) {
      console.log(`Limpando diretório de frames: ${parentDir}`);
      fs.rmSync(parentDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    console.error("Erro ao limpar/criar pastas de frames:", err.message);
  }
}

async function startRecordRTMP(rtmpUrl, outputDir) {
  if (RECORD_PROCESS) {
    throw new Error("Já existe uma gravação em execução");
  }

  prepareRecordOutputDir(outputDir);

  RECORD_PROCESS = spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-fflags", "nobuffer",
    "-flags", "low_delay",
    "-probesize", "1000000",
    "-analyzeduration", "1000000",
    "-i", rtmpUrl,
    "-an",
    "-vf", "fps=2",
    "-q:v", "2",
    path.join(outputDir, "frame_%05d.jpg")
  ]);

  drainProcessStderr(RECORD_PROCESS, "ffmpeg-rtmp");

  RECORD_PROCESS.on("error", (err) => {
    console.error("Erro no processo FFmpeg RTMP:", err.message);
    stopRecordRTMP();
  });

  RECORD_PROCESS.on("close", () => {
    RECORD_PROCESS = null;
  });

  return { success: true, message: "Gravação via RTMP iniciada" };
}

function stopRecordWS() {
  if (RECORD_WS) {
    RECORD_WS.close();
    RECORD_WS = null;
  }
  RECORD_WS_PAUSED = false;

  if (RECORD_PROCESS) {
    const proc = RECORD_PROCESS;
    try {
      proc.stdin.end();
      proc.kill("SIGTERM");

      setTimeout(() => {
        try {
          if (proc.exitCode === null) {
            proc.kill("SIGKILL");
          }
        } catch (err) { }
      }, 2000);

    } catch (err) {
      console.error("Erro ao encerrar FFmpeg:", err.message);
    }
    RECORD_PROCESS = null;
  }


  return { success: true, message: "Gravação via WebSocket encerrada" };
}

function stopRecordRTMP() {
  if (RECORD_PROCESS) {
    const proc = RECORD_PROCESS;
    try {
      proc.kill("SIGTERM");

      setTimeout(() => {
        try {
          if (proc.exitCode === null) {
            proc.kill("SIGKILL");
          }
        } catch (err) { }
      }, 2000);

    } catch (err) {
      console.error("Erro ao encerrar FFmpeg RTMP:", err.message);
    }
    RECORD_PROCESS = null;
  }

  return { success: true, message: "Gravação via RTMP encerrada" };
}

module.exports = {
  streamImagesZip,
  downloadAndSave,
  runColmap,
  stopColmap,
  addRtmpPreviewClient,
  startRecordWS,
  stopRecordWS,
  startRecordRTMP,
  stopRecordRTMP,
};
