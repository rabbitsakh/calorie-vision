export type MysqlConnection = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

export function parseMysqlUrl(url: string): MysqlConnection {
  const trimmed = url.trim().replace(/^\uFEFF/, "");
  const withoutProtocol = trimmed.replace(/^mysql:\/\//i, "");
  const slash = withoutProtocol.indexOf("/");
  if (slash === -1) {
    throw new Error("Invalid DATABASE_URL: missing database name");
  }

  const authority = withoutProtocol.slice(0, slash);
  const database = withoutProtocol.slice(slash + 1).split("?")[0];
  const at = authority.lastIndexOf("@");
  if (at === -1) {
    throw new Error("Invalid DATABASE_URL: missing host");
  }

  const userInfo = authority.slice(0, at);
  const hostPort = authority.slice(at + 1);
  const colon = userInfo.indexOf(":");
  const user = decodeURIComponent(colon >= 0 ? userInfo.slice(0, colon) : userInfo);
  const password = decodeURIComponent(colon >= 0 ? userInfo.slice(colon + 1) : "");

  const portMatch = hostPort.match(/:(\d+)$/);
  const host = portMatch ? hostPort.slice(0, -portMatch[0].length) : hostPort;
  const port = portMatch ? portMatch[1] : "3306";

  if (!host || !user || !database) {
    throw new Error("Invalid DATABASE_URL: host, user, or database is empty");
  }

  return { host, port, user, password, database };
}

export function readEnvFileValue(fileContents: string, key: string): string | undefined {
  const text = fileContents.replace(/^\uFEFF/, "");
  let found: string | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const name = line.slice(0, eq).trim();
    if (name !== key) {
      continue;
    }

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    found = value;
  }

  return found;
}
