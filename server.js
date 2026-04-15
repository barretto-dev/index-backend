const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const pty = require("node-pty");
const cors = require("cors");
const url = require("url");

const sibrRoutes = require("./routes/sibrRoutes");
const imageRoutes = require("./routes/imageRoutes");
const convertRoutes = require("./routes/convertRoutes");
const convertController = require("./controllers/convertController");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use("/sibr", sibrRoutes);
app.use("/images", imageRoutes);
app.use("/convert", convertRoutes);

const wss = new WebSocket.Server({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;

  if (pathname === "/terminal") {
    wss.handleUpgrade(request, socket, head, (ws) => {
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
          console.error("Erro WS terminal:", err.message);
        }
      });

      ws.on("close", () => {
        ptyProcess.kill();
      });
    });
  } else if (pathname === "/convert-stream") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      convertController.registerConvertSocket(ws);
    });
  } else {
    socket.destroy();
  }
});

server.listen(3001, "0.0.0.0", () => {
  console.log("Servidor rodando em http://0.0.0.0:3001");
});