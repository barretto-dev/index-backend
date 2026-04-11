const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const pty = require("node-pty");
const cors = require("cors");

const sibrRoutes = require("./routes/sibrRoutes");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// 👉 rotas separadas
app.use("/sibr", sibrRoutes);

// =============================
// 💻 Terminal WebSocket
// =============================
wss.on("connection", (ws) => {
  console.log("Cliente conectado ao terminal");

  const shell = process.env.SHELL || "/bin/bash";

  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env,
  });

  ptyProcess.onData((data) => {
    ws.send(data);
  });

  ws.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());

      if (parsed.type === "input") {
        ptyProcess.write(parsed.data);
      }

      if (parsed.type === "resize") {
        ptyProcess.resize(parsed.cols, parsed.rows);
      }
    } catch (err) {
      console.error("Erro WS:", err.message);
    }
  });

  ws.on("close", () => {
    ptyProcess.kill();
  });
});

// =============================
// 🚀 Start
// =============================
server.listen(3001, "0.0.0.0", () => {
  console.log("Servidor rodando em http://0.0.0.0:3001");
});