const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const pty = require("node-pty");
const cors = require("cors");
const url = require("url");

const sibrRoutes = require("./routes/sibrRoutes");
const imageRoutes = require("./routes/imageRoutes");
const gaussianRoutes = require("./routes/gaussianRoutes");
const outputRoutes = require("./routes/outputRoutes");

const imageController = require("./controllers/imageController")
const gaussianController = require("./controllers/gaussianController");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use("/sibr", sibrRoutes);
app.use("/images", imageRoutes);
app.use("/gaussian", gaussianRoutes);
app.use("/output", outputRoutes);

const wss = new WebSocket.Server({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  
  if (pathname === "/gaussian-train-stream") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      gaussianController.registerSocket(ws);
    });
  } else if (pathname === "/prepare-frames-stream") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        imageController.registerSocket(ws);
      });
  } else if (pathname === "/rtmp-preview") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        imageController.registerRtmpPreviewSocket(ws, request);
      });
  } else {
    socket.destroy();
  }
});

server.listen(3001, "0.0.0.0", () => {
  console.log("Servidor rodando em http://0.0.0.0:3001");
});
