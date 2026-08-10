import Fastify, { type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { resolve } from "node:path";
import { z } from "zod";
import {
  connectionSummary,
  loadFeatures,
  loadParameters,
  loadWebServices,
  loadWebServiceParameters,
  testConnection,
} from "@dbcompare/api/database";

const controlApiUrl = (process.env.CONTROL_API_URL ?? "").replace(/\/$/, "");
const localPort = Number(process.env.LOCAL_PORT ?? 38765);
const webDist = resolve(
  process.cwd(),
  process.env.WEB_DIST_PATH ?? "../../web/dist",
);

if (!controlApiUrl) {
  throw new Error("CONTROL_API_URL deve apontar para a API central do DB Compare.");
}

const connectionSchema = z.object({
  type: z.enum(["oracle", "postgres", "sqlserver"]),
  host: z.string().min(1).max(253),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1).max(128),
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(512),
});
const comparisonSchema = z.object({ first: connectionSchema, second: connectionSchema });
const webServicesSchema = comparisonSchema.extend({
  firstWebService: z.number().int().positive(),
  secondWebService: z.number().int().positive(),
});
const app = Fastify({ logger: true });

await app.register(fastifyStatic, { root: webDist, index: ["index.html"] });

function bearerToken(request: FastifyRequest) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Não autenticado.");
  return token;
}

async function controlRequest(
  path: string,
  token: string,
  method = "POST",
  body?: unknown,
) {
  const response = await fetch(`${controlApiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Sessão não autorizada pela API central.");
  return response;
}

async function requireAuthenticated(request: FastifyRequest) {
  const token = bearerToken(request);
  await controlRequest("/session/validate", token, "GET");
  return token;
}

async function recordAudit(
  token: string,
  operation: string,
  connection: string,
  errorMessage?: string,
) {
  try {
    await controlRequest("/audit", token, "POST", {
      operation,
      connection,
      ...(errorMessage ? { errorMessage } : {}),
    });
  } catch (error) {
    app.log.warn(error, "Não foi possível registrar o log central.");
  }
}

function messageOf(error: unknown, passwords: string[] = []) {
  let message = error instanceof Error ? error.message : "Erro não identificado.";
  for (const password of passwords) message = message.replaceAll(password, "[oculta]");
  return message.slice(0, 700);
}

app.post("/api/connections/test", async (request, reply) => {
  const connection = connectionSchema.parse(request.body);
  const token = await requireAuthenticated(request);
  const logs: string[] = [];
  try {
    await testConnection(connection, (line) => logs.push(line));
    await recordAudit(token, "Teste de conexão", connectionSummary(connection));
    return { ok: true, message: "Conexão realizada com sucesso.", connection: connectionSummary(connection), logs };
  } catch (error) {
    const detail = messageOf(error, [connection.password]);
    logs.push(`Falha: ${detail}`);
    await recordAudit(token, "Teste de conexão", connectionSummary(connection), detail);
    return reply.code(400).send({ ok: false, message: "Não foi possível conectar.", connection: connectionSummary(connection), logs });
  }
});

app.post("/api/comparisons/parameters", async (request, reply) => {
  const body = comparisonSchema.parse(request.body);
  const token = await requireAuthenticated(request);
  const logs = { first: [`Base 1 — ${connectionSummary(body.first)}`], second: [`Base 2 — ${connectionSummary(body.second)}`] };
  const summary = `Base 1: ${connectionSummary(body.first)} | Base 2: ${connectionSummary(body.second)}`;
  try {
    const [first, second] = await Promise.all([
      loadParameters(body.first, (line) => logs.first.push(line)),
      loadParameters(body.second, (line) => logs.second.push(line)),
    ]);
    await recordAudit(token, "Consulta", summary);
    return { first, second, logs };
  } catch (error) {
    const detail = messageOf(error, [body.first.password, body.second.password]);
    await recordAudit(token, "Consulta", summary, detail);
    return reply.code(400).send({ message: "Não foi possível consultar uma das bases.", logs, detail });
  }
});

app.post("/api/comparisons/features", async (request, reply) => {
  const body = comparisonSchema.parse(request.body);
  const token = await requireAuthenticated(request);
  const logs = { first: [`Base 1 — ${connectionSummary(body.first)}`], second: [`Base 2 — ${connectionSummary(body.second)}`] };
  const summary = `Features | Base 1: ${connectionSummary(body.first)} | Base 2: ${connectionSummary(body.second)}`;
  try {
    const [first, second] = await Promise.all([
      loadFeatures(body.first, (line) => logs.first.push(line)),
      loadFeatures(body.second, (line) => logs.second.push(line)),
    ]);
    await recordAudit(token, "Consulta", summary);
    return { first, second, logs };
  } catch (error) {
    const detail = messageOf(error, [body.first.password, body.second.password]);
    await recordAudit(token, "Consulta", summary, detail);
    return reply.code(400).send({ message: "Não foi possível consultar uma das bases.", logs, detail });
  }
});

app.post("/api/webservices", async (request, reply) => {
  const connection = connectionSchema.parse(request.body);
  await requireAuthenticated(request);
  try {
    return { webservices: await loadWebServices(connection) };
  } catch (error) {
    return reply.code(400).send({ message: "Não foi possível carregar os Webservices.", detail: messageOf(error, [connection.password]) });
  }
});

app.post("/api/comparisons/webservices", async (request, reply) => {
  const body = webServicesSchema.parse(request.body);
  const token = await requireAuthenticated(request);
  const logs = { first: [`Base 1 — ${connectionSummary(body.first)}`], second: [`Base 2 — ${connectionSummary(body.second)}`] };
  const summary = `Parâmetros de Webservices | Base 1: ${connectionSummary(body.first)} | Base 2: ${connectionSummary(body.second)}`;
  try {
    const [first, second] = await Promise.all([
      loadWebServiceParameters(body.first, body.firstWebService, (line) => logs.first.push(line)),
      loadWebServiceParameters(body.second, body.secondWebService, (line) => logs.second.push(line)),
    ]);
    await recordAudit(token, "Consulta", summary);
    return { first, second, logs };
  } catch (error) {
    const detail = messageOf(error, [body.first.password, body.second.password]);
    await recordAudit(token, "Consulta", summary, detail);
    return reply.code(400).send({ message: "Não foi possível consultar uma das bases.", logs, detail });
  }
});

// As rotas administrativas permanecem centralizadas; o agente apenas as encaminha.
app.all("/api/*", async (request, reply) => {
  const token = await requireAuthenticated(request);
  const suffix = (request.params as { "*": string })["*"];
  const response = await controlRequest(
    `/${suffix}${request.url.includes("?") ? request.url.slice(request.url.indexOf("?")) : ""}`,
    token,
    request.method,
    ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
  );
  const content = await response.text();
  if (!content) return reply.code(response.status).send();
  reply.code(response.status).type(response.headers.get("content-type") ?? "application/json");
  return reply.send(content);
});

app.get("/*", async (_request, reply) => reply.sendFile("index.html"));

await app.listen({ port: localPort, host: "127.0.0.1" });
