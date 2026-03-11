const app = require("./app");
const env = require("./config/env");
const pool = require("./db/pool");

let server;

const startServer = async () => {
  await pool.query("SELECT 1");
  server = app.listen(env.PORT, () => {
    process.stdout.write(`Backend API listening on port ${env.PORT}\n`);
  });
};

const shutdown = async () => {
  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
  await pool.end();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer().catch((error) => {
  process.stderr.write(`Server failed to start: ${error.message}\n`);
  process.exit(1);
});
