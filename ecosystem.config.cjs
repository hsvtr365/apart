const path = require("node:path");
module.exports = {
  apps: [{
    name: "apart",
    cwd: path.join(__dirname, "front"),
    script: path.join(__dirname, "front/node_modules/next/dist/bin/next"),
    args: "start --hostname 127.0.0.1 --port 28004",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    restart_delay: 3000,
    time: true,
  }],
};
