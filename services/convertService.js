const { spawn } = require("child_process");

function runConvertWithStreaming(onOutput, onDone) {
  const child = spawn(
    "python3",
    ["train.py", "-s", "/development/frames/"],
    {
      cwd: "/development/gaussian-splatting/",
      env: process.env,
    }
  );

  onOutput("$ cd /development/gaussian-splatting/\n");
  onOutput("$ python3 train.py -s /development/frames/\n");

  child.stdout.on("data", (data) => {
    onOutput(data.toString());
  });

  child.stderr.on("data", (data) => {
    onOutput(data.toString());
  });

  child.on("close", (code) => {
    onDone(code);
  });

  child.on("error", (err) => {
    onOutput(`Erro ao iniciar processo: ${err.message}\n`);
    onDone(1);
  });

  return child;
}

module.exports = {
  runConvertWithStreaming,
};