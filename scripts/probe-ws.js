const dns = require("dns").promises;
const WebSocket = require("ws");

const wsUrl = process.argv[2];
const timeoutMs = Number(process.argv[3] || 10000);

if (!wsUrl) {
  console.error("Uso: npm run probe:ws -- ws://host:porta[/path] [timeoutMs]");
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(wsUrl);
} catch (err) {
  console.error(`URL invalida: ${err.message}`);
  process.exit(2);
}

async function main() {
  console.log(`[probe-ws] url=${wsUrl}`);
  console.log(`[probe-ws] host=${parsed.hostname} port=${parsed.port || (parsed.protocol === "wss:" ? "443" : "80")} path=${parsed.pathname}`);

  try {
    const records = await dns.lookup(parsed.hostname, { all: true });
    console.log(`[probe-ws] dns=${records.map((item) => `${item.address}/${item.family}`).join(", ")}`);
  } catch (err) {
    console.log(`[probe-ws] dns_error=${err.code || err.message}`);
  }

  const startedAt = Date.now();
  const socket = new WebSocket(wsUrl, {
    handshakeTimeout: timeoutMs,
    perMessageDeflate: false,
  });

  const timeout = setTimeout(() => {
    console.error(`[probe-ws] timeout after ${timeoutMs}ms`);
    socket.terminate();
    process.exit(1);
  }, timeoutMs);

  socket.on("open", () => {
    console.log(`[probe-ws] open after ${Date.now() - startedAt}ms`);
  });

  socket.on("message", (data, isBinary) => {
    console.log(`[probe-ws] first_message bytes=${data.length} binary=${isBinary}`);
    clearTimeout(timeout);
    socket.close();
    process.exit(0);
  });

  socket.on("error", (err) => {
    clearTimeout(timeout);
    console.error(`[probe-ws] error=${err.code || err.message} message=${err.message}`);
    process.exit(1);
  });

  socket.on("close", (code, reason) => {
    clearTimeout(timeout);
    console.log(`[probe-ws] close code=${code} reason=${reason.toString()}`);
    process.exit(code === 1000 ? 0 : 1);
  });
}

main().catch((err) => {
  console.error(`[probe-ws] fatal=${err.stack || err.message}`);
  process.exit(1);
});
