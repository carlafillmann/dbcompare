import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import {
  connectionSummary,
  loadFeatures,
  loadParameters,
  loadWebServices,
  loadWebServiceParameters,
  testConnection,
} from "@dbcompare/api/database";

const firebaseApiKey = process.env.FIREBASE_API_KEY ?? "";
const localPort = Number(process.env.LOCAL_PORT ?? 38765);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "https://dbcompare-d1bc2.web.app,https://dbcompare-d1bc2.firebaseapp.com,http://localhost:5173")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (!firebaseApiKey) {
  throw new Error("FIREBASE_API_KEY deve ser informado na configuração do agente local.");
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

await app.register(cors, {
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 600,
});

// Chromium browsers may preflight a request from an HTTPS site to localhost.
// The agent stays bound to loopback and explicitly authorizes this access.
app.addHook("onSend", async (request, reply, payload) => {
  if (request.headers["access-control-request-private-network"] === "true")
    reply.header("Access-Control-Allow-Private-Network", "true");
  return payload;
});

function bearerToken(request: FastifyRequest) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Não autenticado.");
  return token;
}

async function requireAuthenticated(request: FastifyRequest) {
  const idToken = bearerToken(request);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) throw new Error("Sessão do Firebase inválida ou expirada.");
}

function messageOf(error: unknown, passwords: string[] = []) {
  let message = error instanceof Error ? error.message : "Erro não identificado.";
  for (const password of passwords) message = message.replaceAll(password, "[oculta]");
  return message.slice(0, 700);
}

app.post("/api/connections/test", async (request, reply) => {
  const connection = connectionSchema.parse(request.body);
  await requireAuthenticated(request);
  const logs: string[] = [];
  try {
    await testConnection(connection, (line) => logs.push(line));
    return { ok: true, message: "Conexão realizada com sucesso.", connection: connectionSummary(connection), logs };
  } catch (error) {
    const detail = messageOf(error, [connection.password]);
    logs.push(`Falha: ${detail}`);
    return reply.code(400).send({ ok: false, message: "Não foi possível conectar.", connection: connectionSummary(connection), logs });
  }
});

app.post("/api/comparisons/parameters", async (request, reply) => {
  const body = comparisonSchema.parse(request.body);
  await requireAuthenticated(request);
  const logs = { first: [`Base 1 — ${connectionSummary(body.first)}`], second: [`Base 2 — ${connectionSummary(body.second)}`] };
  try {
    const [first, second] = await Promise.all([
      loadParameters(body.first, (line) => logs.first.push(line)),
      loadParameters(body.second, (line) => logs.second.push(line)),
    ]);
    return { first, second, logs };
  } catch (error) {
    const detail = messageOf(error, [body.first.password, body.second.password]);
    return reply.code(400).send({ message: "Não foi possível consultar uma das bases.", logs, detail });
  }
});

app.post("/api/comparisons/features", async (request, reply) => {
  const body = comparisonSchema.parse(request.body);
  await requireAuthenticated(request);
  const logs = { first: [`Base 1 — ${connectionSummary(body.first)}`], second: [`Base 2 — ${connectionSummary(body.second)}`] };
  try {
    const [first, second] = await Promise.all([
      loadFeatures(body.first, (line) => logs.first.push(line)),
      loadFeatures(body.second, (line) => logs.second.push(line)),
    ]);
    return { first, second, logs };
  } catch (error) {
    const detail = messageOf(error, [body.first.password, body.second.password]);
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
  await requireAuthenticated(request);
  const logs = { first: [`Base 1 — ${connectionSummary(body.first)}`], second: [`Base 2 — ${connectionSummary(body.second)}`] };
  try {
    const [first, second] = await Promise.all([
      loadWebServiceParameters(body.first, body.firstWebService, (line) => logs.first.push(line)),
      loadWebServiceParameters(body.second, body.secondWebService, (line) => logs.second.push(line)),
    ]);
    return { first, second, logs };
  } catch (error) {
    const detail = messageOf(error, [body.first.password, body.second.password]);
    return reply.code(400).send({ message: "Não foi possível consultar uma das bases.", logs, detail });
  }
});

await app.listen({ port: localPort, host: "127.0.0.1" });
