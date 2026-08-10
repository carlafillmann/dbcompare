import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { getAuth } from "firebase-admin/auth";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  connectionSummary,
  loadFeatures,
  loadParameters,
  loadWebServices,
  loadWebServiceParameters,
  testConnection,
} from "./database.js";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_FILE
  ? JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, "utf8"))
  : {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };
if (!getApps().length)
  initializeApp({
    credential: process.env.FIREBASE_SERVICE_ACCOUNT_FILE || process.env.FIREBASE_PROJECT_ID
      ? cert(serviceAccount)
      : applicationDefault(),
  });
const connectionSchema = z.object({
  type: z.enum(["oracle", "postgres", "sqlserver"]),
  host: z.string().min(1).max(253),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1).max(128),
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(512),
});
const app = Fastify({ logger: true });
const firestore = getFirestore();
await app.register(cors, {
  origin: process.env.WEB_ORIGIN?.split(",") ?? false,
  methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
});
await app.register(rateLimit, { max: 20, timeWindow: "1 minute" });

app.addHook("preHandler", async (request, reply) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return reply.code(401).send({ message: "Não autenticado." });
  try {
    (request as any).authUser = await getAuth().verifyIdToken(token);
  } catch {
    return reply.code(401).send({ message: "Token inválido." });
  }
});
function actor(request: any) {
  return {
    uid: request.authUser.uid,
    username: request.authUser.username ?? request.authUser.email ?? "Usuário",
    name: request.authUser.name ?? request.authUser.email ?? "Usuário",
  };
}
async function audit(
  request: any,
  operation: string,
  details: Record<string, unknown>,
) {
  await firestore
    .collection("operationLogs")
    .add({
      operation,
      actor: actor(request),
      details,
      status: details.errorMessage ? "error" : "success",
      errorMessage:
        typeof details.errorMessage === "string" ? details.errorMessage : null,
      createdAt: FieldValue.serverTimestamp(),
    });
}
function isAdmin(request: any) {
  return request.authUser?.role === "admin";
}
// Used by the local agent. It validates a Firebase session without giving the
// agent any administrative Firebase credential.
app.get("/session/validate", async (_request, reply) => reply.code(204).send());
app.post("/connections/test", async (request, reply) => {
  const connection = connectionSchema.parse(request.body);
  const logs: string[] = [];
  try {
    await testConnection(connection, (line) => logs.push(line));
    await audit(request, "Teste de conexão", {
      connection: connectionSummary(connection),
      occurredAt: new Date().toISOString(),
    });
    return {
      ok: true,
      message: "Conexão realizada com sucesso.",
      connection: connectionSummary(connection),
      logs,
    };
  } catch (error) {
    request.log.warn(error);
    const detail =
      error instanceof Error
        ? error.message.replace(connection.password, "[oculta]").slice(0, 700)
        : "Erro não identificado.";
    logs.push(`Falha: ${detail}`);
    await audit(request, "Teste de conexão", {
      connection: connectionSummary(connection),
      occurredAt: new Date().toISOString(),
      errorMessage: detail,
    });
    return reply
      .code(400)
      .send({
        ok: false,
        message: "Não foi possível conectar.",
        connection: connectionSummary(connection),
        logs,
      });
  }
});
app.post("/comparisons/parameters", async (request, reply) => {
  const body = z
    .object({ first: connectionSchema, second: connectionSchema })
    .parse(request.body);
  const logs = {
    first: [`Base 1 — ${connectionSummary(body.first)}`],
    second: [`Base 2 — ${connectionSummary(body.second)}`],
  };
  const startedAt = new Date().toISOString();
  try {
    const [first, second] = await Promise.all([
      loadParameters(body.first, (line) => logs.first.push(line)),
      loadParameters(body.second, (line) => logs.second.push(line)),
    ]);
    await audit(request, "Consulta", {
      base1: connectionSummary(body.first),
      base2: connectionSummary(body.second),
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    return { first, second, logs };
  } catch (error) {
    request.log.warn(error);
    const detail =
      error instanceof Error
        ? error.message
            .replace(body.first.password, "[oculta]")
            .replace(body.second.password, "[oculta]")
            .slice(0, 700)
        : "Erro não identificado.";
    return reply
      .code(400)
      .send({
        message: "Não foi possível consultar uma das bases.",
        logs,
        detail,
      });
  }
});
app.post("/comparisons/webservices", async (request, reply) => {
  const body = z
    .object({ first: connectionSchema, second: connectionSchema, firstWebService: z.number().int().positive(), secondWebService: z.number().int().positive() })
    .parse(request.body);
  const logs = {
    first: [`Base 1 — ${connectionSummary(body.first)}`],
    second: [`Base 2 — ${connectionSummary(body.second)}`],
  };
  const startedAt = new Date().toISOString();
  try {
    const [first, second] = await Promise.all([
      loadWebServiceParameters(body.first, body.firstWebService, (line) => logs.first.push(line)),
      loadWebServiceParameters(body.second, body.secondWebService, (line) => logs.second.push(line)),
    ]);
    await audit(request, "Consulta", {
      comparison: "Parâmetros de Webservices",
      base1: connectionSummary(body.first),
      base2: connectionSummary(body.second),
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    return { first, second, logs };
  } catch (error) {
    request.log.warn(error);
    const detail =
      error instanceof Error
        ? error.message
            .replace(body.first.password, "[oculta]")
            .replace(body.second.password, "[oculta]")
            .slice(0, 700)
        : "Erro não identificado.";
    return reply.code(400).send({
      message: "Não foi possível consultar uma das bases.",
      logs,
      detail,
    });
  }
});
app.post("/comparisons/features", async (request, reply) => {
  const body = z.object({ first: connectionSchema, second: connectionSchema }).parse(request.body);
  const logs = { first: [`Base 1 — ${connectionSummary(body.first)}`], second: [`Base 2 — ${connectionSummary(body.second)}`] };
  const startedAt = new Date().toISOString();
  try {
    const [first, second] = await Promise.all([
      loadFeatures(body.first, (line) => logs.first.push(line)),
      loadFeatures(body.second, (line) => logs.second.push(line)),
    ]);
    await audit(request, "Consulta", { comparison: "Features", base1: connectionSummary(body.first), base2: connectionSummary(body.second), startedAt, finishedAt: new Date().toISOString() });
    return { first, second, logs };
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(body.first.password, "[oculta]").replace(body.second.password, "[oculta]").slice(0, 700) : "Erro não identificado.";
    return reply.code(400).send({ message: "Não foi possível consultar uma das bases.", logs, detail });
  }
});
app.post("/webservices", async (request, reply) => {
  const connection = connectionSchema.parse(request.body);
  try {
    return { webservices: await loadWebServices(connection) };
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(connection.password, "[oculta]").slice(0, 700) : "Erro não identificado.";
    return reply.code(400).send({ message: "Não foi possível carregar os Webservices.", detail });
  }
});
app.post("/audit", async (request, reply) => {
  const body = z
    .object({
      operation: z.enum([
        "Login",
        "Consulta",
        "Alteração de usuário",
        "Inclusão de conexão",
        "Alteração de conexão",
        "Exclusão de conexão",
        "Teste de conexão",
      ]),
      connection: z.string().optional(),
      errorMessage: z.string().max(1000).optional(),
    })
    .parse(request.body);
  const details: Record<string, string> = {
    occurredAt: new Date().toISOString(),
  };
  if (body.connection) details.connection = body.connection;
  if (body.errorMessage) details.errorMessage = body.errorMessage;

  await audit(request, body.operation, details);
  return reply.code(204).send();
});
app.get("/users", async (request, reply) => {
  if (!isAdmin(request))
    return reply
      .code(403)
      .send({ message: "Acesso restrito a administradores." });
  const users = await getAuth().listUsers();
  const profiles = await Promise.all(
    users.users.map(async (u) => ({
      uid: u.uid,
      name: u.displayName ?? "",
      email: u.email ?? "",
      username: u.customClaims?.username ?? "",
      role: u.customClaims?.role ?? "common",
      disabled: u.disabled,
    })),
  );
  return { users: profiles };
});
app.post("/users", async (request, reply) => {
  if (!isAdmin(request))
    return reply
      .code(403)
      .send({ message: "Acesso restrito a administradores." });
  const body = z
    .object({
      name: z.string().min(3).max(100),
      username: z
        .string()
        .min(3)
        .max(40)
        .regex(/^[a-zA-Z0-9._-]+$/),
      password: z.string().min(8).max(128),
      role: z.enum(["admin", "common"]),
    })
    .parse(request.body);
  const email = `${body.username.toLowerCase()}@dbcompare.local`;
  const user = await getAuth().createUser({
    email,
    password: body.password,
    displayName: body.name,
  });
  await getAuth().setCustomUserClaims(user.uid, {
    role: body.role,
    username: body.username,
  });
  await firestore
    .collection("users")
    .doc(user.uid)
    .set({
      name: body.name,
      username: body.username,
      role: body.role,
      theme: "system",
      updatedAt: FieldValue.serverTimestamp(),
    });
  await audit(request, "Inclusão de usuário", {
    username: body.username,
    role: body.role,
  });
  return reply.code(201).send({ uid: user.uid });
});
app.patch("/users/:uid", async (request, reply) => {
  if (!isAdmin(request))
    return reply
      .code(403)
      .send({ message: "Acesso restrito a administradores." });
  const { uid } = z.object({ uid: z.string().min(1) }).parse(request.params);
  const body = z
    .object({
      name: z.string().min(3).max(100),
      username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
      password: z.string().min(8).max(128).optional(),
      role: z.enum(["admin", "common"]),
    })
    .parse(request.body);
  if (uid === (request as any).authUser.uid && body.role !== "admin")
    return reply
      .code(400)
      .send({ message: "NÃ£o Ã© permitido remover seu prÃ³prio perfil administrador." });

  await getAuth().updateUser(uid, {
    displayName: body.name,
    email: `${body.username.toLowerCase()}@dbcompare.local`,
    ...(body.password ? { password: body.password } : {}),
  });
  await getAuth().setCustomUserClaims(uid, {
    role: body.role,
    username: body.username,
  });
  await firestore.collection("users").doc(uid).set(
    {
      name: body.name,
      username: body.username,
      role: body.role,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await audit(request, "AlteraÃ§Ã£o de usuÃ¡rio", {
    uid,
    username: body.username,
    role: body.role,
  });
  return reply.code(204).send();
});
app.delete("/users/:uid", async (request, reply) => {
  if (!isAdmin(request))
    return reply
      .code(403)
      .send({ message: "Acesso restrito a administradores." });
  const { uid } = z.object({ uid: z.string().min(1) }).parse(request.params);
  if (uid === (request as any).authUser.uid)
    return reply
      .code(400)
      .send({ message: "NÃ£o Ã© permitido excluir o prÃ³prio usuÃ¡rio." });
  const existing = await getAuth().getUser(uid);
  await getAuth().deleteUser(uid);
  await firestore.collection("users").doc(uid).delete();
  await audit(request, "ExclusÃ£o de usuÃ¡rio", {
    uid,
    username: existing.customClaims?.username ?? existing.email ?? "",
  });
  return reply.code(204).send();
});
app.get("/monitoring", async (request, reply) => {
  if (!isAdmin(request))
    return reply
      .code(403)
      .send({ message: "Acesso restrito a administradores." });
  const cursor =
    typeof (request.query as any).cursor === "string"
      ? (request.query as any).cursor
      : undefined;
  const search = typeof (request.query as any).q === "string" ? (request.query as any).q.trim().toLowerCase() : "";
  if (search) {
    const all = await firestore.collection("operationLogs").orderBy("createdAt", "desc").get();
    const matches = all.docs.filter(item => JSON.stringify(item.data()).toLowerCase().includes(search));
    const start = cursor ? Math.max(0, matches.findIndex(item => item.id === cursor) + 1) : 0;
    const page = matches.slice(start, start + 100);
    return { logs: page.map(item => ({ id: item.id, ...item.data(), createdAt: item.get("createdAt")?.toDate?.().toISOString() ?? null })), nextCursor: start + 100 < matches.length ? page.at(-1)?.id : null };
  }
  let query = firestore
    .collection("operationLogs")
    .orderBy("createdAt", "desc")
    .limit(100);
  if (cursor) {
    const item = await firestore.collection("operationLogs").doc(cursor).get();
    if (item.exists) query = query.startAfter(item);
  }
  const snapshot = await query.get();
  return {
    logs: snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
      createdAt: item.get("createdAt")?.toDate?.().toISOString() ?? null,
    })),
    nextCursor: snapshot.docs.length === 100 ? snapshot.docs.at(-1)?.id : null,
  };
});
await app.listen({ port: Number(process.env.PORT ?? 3333), host: "0.0.0.0" });
