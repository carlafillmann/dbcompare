import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { get } from "node:https";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const configuredApiKey = args.find((item) => item.startsWith("--firebase-api-key="))?.slice("--firebase-api-key=".length);
const skipBuild = args.includes("--skip-build");
const firebaseApiKey = configuredApiKey || "__INFORME_A_CHAVE_PUBLICA_DO_FIREBASE__";
const version = JSON.parse(await readFile(join(root, "package.json"), "utf8")).version ?? "1.0.0";
const bundle = resolve(root, "release", `DBCompare-${version}-windows-local`);
const nodeVersion = process.versions.node;
const nodeArchive = `node-v${nodeVersion}-win-x64.zip`;
const nodeUrl = `https://nodejs.org/dist/v${nodeVersion}/${nodeArchive}`;
const zipPath = join(root, "release", nodeArchive);

function run(file, parameters, options = {}) {
  execFileSync(file, parameters, { cwd: root, stdio: "inherit", ...options });
}
function runNpm(parameters, cwd = root) {
  if (process.platform === "win32") {
    run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `npm ${parameters.join(" ")}`], { cwd });
    return;
  }
  run("npm", parameters, { cwd });
}
function download(url, destination) {
  return new Promise((resolveDownload, reject) => {
    get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Não foi possível baixar o runtime Node (${response.statusCode}).`));
        return;
      }
      const output = createWriteStream(destination);
      response.pipe(output);
      output.on("finish", () => output.close(resolveDownload));
      output.on("error", reject);
    }).on("error", reject);
  });
}

if (!skipBuild) runNpm(["run", "build:portable"]);
await mkdir(bundle, { recursive: true });
await cp(join(root, "apps", "local-agent", "dist"), join(bundle, "agent", "dist"), { recursive: true });
await cp(join(root, "portable", "DB Compare.cmd"), join(bundle, "DB Compare.cmd"));
await cp(join(root, "portable", "README.txt"), join(bundle, "README.txt"));

await mkdir(join(bundle, "agent"), { recursive: true });
await writeFile(join(bundle, "agent", ".env"), [
  `FIREBASE_API_KEY=${firebaseApiKey}`,
  "LOCAL_PORT=38765",
  "ALLOWED_ORIGINS=https://dbcompare-d1bc2.web.app,https://dbcompare-d1bc2.firebaseapp.com",
  "",
].join("\r\n"));

// Install only the runtime dependencies needed by the local agent. This avoids
// copying development tools and prevents workspace links from carrying .env files.
await writeFile(join(bundle, "package.json"), JSON.stringify({
  private: true,
  type: "module",
  dependencies: {
    "@fastify/cors": "^11.0.0",
    fastify: "^5.2.0",
    mssql: "^11.0.1",
    oracledb: "^6.7.0",
    pg: "^8.13.0",
    zod: "^3.24.1",
  },
}, null, 2));
runNpm(["install", "--omit=dev", "--no-audit", "--no-fund"], bundle);
await mkdir(join(bundle, "node_modules", "@dbcompare", "api"), { recursive: true });
await cp(join(root, "apps", "api", "dist"), join(bundle, "node_modules", "@dbcompare", "api", "dist"), { recursive: true });
await cp(join(root, "apps", "api", "package.json"), join(bundle, "node_modules", "@dbcompare", "api", "package.json"));

await mkdir(join(root, "release"), { recursive: true });
if (!existsSync(zipPath)) {
  console.log(`Baixando Node.js ${nodeVersion} para a distribuicao portatil...`);
  await download(nodeUrl, zipPath);
}
const extraction = join(root, "release", `node-v${nodeVersion}-win-x64`);
if (!existsSync(extraction)) {
  run(process.platform === "win32" ? "powershell.exe" : "powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${join(root, "release").replace(/'/g, "''")}' -Force`]);
}
await cp(extraction, join(bundle, "runtime"), { recursive: true });

console.log(`\nDistribuicao criada em:\n${bundle}`);
console.log("Crie um atalho para 'DB Compare.cmd' na Area de Trabalho.");
