const fs = require("fs");
const path = require("path");

const appDir = "/var/www/calorie-vision";
const standaloneServer = path.join(appDir, ".next/standalone/server.js");
const useStandalone = fs.existsSync(standaloneServer);

/** Minimal .env reader (KEY=VALUE, ignores comments / blanks). */
function loadEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = loadEnvFile(path.join(appDir, ".env"));
const baseEnv = {
  NODE_ENV: "production",
  PORT: fileEnv.PORT || "3000",
  ...fileEnv,
};

/** Prefer CI/artifact standalone (`node server.js`); fall back to `npm start` after classic deploy.sh. */
module.exports = {
  apps: [
    useStandalone
      ? {
          name: "calorie-vision",
          cwd: path.join(appDir, ".next/standalone"),
          script: "server.js",
          interpreter: "node",
          env: {
            ...baseEnv,
            HOSTNAME: "0.0.0.0",
            // Keep uploads on the git checkout even when cwd is standalone.
            UPLOAD_DIR:
              fileEnv.UPLOAD_DIR && path.isAbsolute(fileEnv.UPLOAD_DIR)
                ? fileEnv.UPLOAD_DIR
                : path.join(appDir, "public/uploads"),
          },
        }
      : {
          name: "calorie-vision",
          cwd: appDir,
          script: "npm",
          args: "start",
          env: baseEnv,
        },
  ],
};
