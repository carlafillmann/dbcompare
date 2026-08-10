import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Filter,
  Info,
  LogOut,
  Moon,
  Plus,
  ScrollText,
  Search,
  ServerCog,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import { auth, firestore } from "./firebase";
import "./styles.css";

type DbType = "oracle" | "postgres" | "sqlserver";
type Connection = {
  id?: string;
  name: string;
  environment: string;
  type: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
};
type Parameter = {
  code: string;
  description: string | null;
  value: string | null;
  explanation: string | null;
};
type ResultRow = Parameter & {
  secondValue: string | null;
  secondDescription: string | null;
  secondExplanation: string | null;
  changed: boolean;
  missingIn?: "first" | "second";
  firstConnectionName: string;
  secondConnectionName: string;
};
type TestReport = { ok: boolean; connection?: string; logs: string[] };
type LoginFloat = {
  id: number;
  color: "blue" | "green" | "white";
  x: number;
  y: number;
  transient?: boolean;
};
// A versão portátil é servida pelo agente local e usa a mesma origem.
// No desenvolvimento e na versão web, VITE_API_URL continua podendo apontar
// para uma API externa.
const apiBaseUrl = import.meta.env.VITE_API_URL || "/api";
const emptyConnection: Connection = {
  name: "",
  environment: "Homologação",
  type: "oracle",
  host: "",
  port: 1521,
  database: "",
  username: "",
};
const typeLabel: Record<DbType, string> = {
  oracle: "Oracle",
  postgres: "PostgreSQL",
  sqlserver: "SQL Server",
};

async function requestApi(
  path: string,
  user: User,
  body: unknown,
  method = "POST",
) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.message), { payload: result });
  return result;
}
async function requestGet(path: string, user: User) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message);
  return result;
}
function Login() {
  const [login, setLogin] = useState("SPCARLA"),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [tilt, setTilt] = useState({ x: 0, y: 0 }),
    [pointer, setPointer] = useState({ x: 50, y: 50 }),
    [floats, setFloats] = useState<LoginFloat[]>(() => {
      const colors: LoginFloat["color"][] = ["blue", "green", "white"];
      return Array.from({ length: 15 }, (_, index) => ({
        id: index + 1,
        color: colors[index % 3],
        x: 4 + ((index * 37) % 91),
        y: 7 + ((index * 53) % 84),
      }));
    });
  async function enter(event: React.FormEvent) {
    event.preventDefault();
    try {
      await signInWithEmailAndPassword(
        auth,
        `${login.toLowerCase()}@dbcompare.local`,
        password,
      );
    } catch {
      setMessage("Usuário ou senha inválidos.");
    }
  }
  function moveLogo(event: React.MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((event.clientY - box.top) / box.height - 0.5) * -14,
      y: ((event.clientX - box.left) / box.width - 0.5) * 14,
    });
  }
  function moveBackground(event: React.MouseEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    });
  }
  function addFloat(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest(".login-card")) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 100,
      y = ((event.clientY - box.top) / box.height) * 100;
    const burst = Array.from(
      { length: 7 },
      (_, index): LoginFloat => ({
        id: Date.now() + Math.random() + index,
        color: (["blue", "green", "white"] as const)[
          Math.floor(Math.random() * 3)
        ],
        x: Math.min(96, Math.max(4, x + (Math.random() - 0.5) * 18)),
        y: Math.min(94, Math.max(5, y + (Math.random() - 0.5) * 18)),
        transient: true,
      }),
    );
    setFloats((current) => [...current, ...burst]);
    window.setTimeout(
      () =>
        setFloats((current) =>
          current.filter(
            (item) => !burst.some((created) => created.id === item.id),
          ),
        ),
      3000,
    );
  }
  return (
    <main
      className="login"
      onMouseMove={moveBackground}
      onClick={addFloat}
      style={
        {
          "--pointer-x": `${pointer.x}%`,
          "--pointer-y": `${pointer.y}%`,
        } as React.CSSProperties
      }
    >
      <div className="login-orb orb-blue" />
      <div className="login-orb orb-green" />
      <div className="login-orb orb-purple" />
      <div className="login-grid" />
      <div className="login-floats" aria-hidden="true">
        {floats.map((item) => (
          <span
            key={item.id}
            className={`login-float database-symbol ${item.color} ${item.transient ? "transient" : ""}`}
            style={
              {
                "--float-x": `${item.x}%`,
                "--float-y": `${item.y}%`,
              } as React.CSSProperties
            }
          >
            <Database />
          </span>
        ))}
      </div>
      <section className="login-card">
        <div
          className="login-logo"
          onMouseMove={moveLogo}
          onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        >
          <img
            src="/db-compare-logo.png"
            alt="DB Compare"
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
          />
        </div>
        <p className="login-brand">
          DB <span>Compare</span>
        </p>
        <form onSubmit={enter}>
          <label>
            Usuário
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {message && <p className="error">{message}</p>}
          <button className="primary">Entrar</button>
        </form>
      </section>
    </main>
  );
}
function Picker({
  title,
  connections,
  id,
  password,
  setId,
  setPassword,
}: {
  title: string;
  connections: Connection[];
  id: string;
  password: string;
  setId: (v: string) => void;
  setPassword: (v: string) => void;
}) {
  return (
    <div className="picker">
      <label>
        {title}
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Selecione uma conexão</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Senha da base
        <input
          type="password"
          placeholder="Informe para esta sessão"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
    </div>
  );
}
function TestModal({
  report,
  close,
}: {
  report: TestReport;
  close: () => void;
}) {
  return (
    <div className="backdrop report-backdrop">
      <section className="modal report">
        <button className="close" onClick={close}>
          <X />
        </button>
        <p className="eyebrow">TESTE DE CONEXÃO</p>
        <h2 className={report.ok ? "success" : "error"}>
          {report.ok ? "Conexão realizada com sucesso" : "Falha ao conectar"}
        </h2>
        <p className="connection-info">{report.connection}</p>
        <LogPanel logs={report.logs} />
      </section>
    </div>
  );
}
function LogPanel({ logs }: { logs: string[] }) {
  const collapsible = logs[0]?.startsWith("Base 1");
  const [open, setOpen] = useState(!collapsible);
  useEffect(() => setOpen(!collapsible), [logs, collapsible]);
  if (collapsible && !open)
    return (
      <button
        className="log-toggle"
        onClick={() => setOpen(true)}
        title="Ver log da consulta"
        aria-label="Ver log da consulta"
      >
        <ScrollText />
      </button>
    );
  return (
    <div className="log-panel">
      <div className="log-title">
        <b>Log da operação</b>
        {collapsible && (
          <button
            className="icon"
            onClick={() => setOpen(false)}
            title="Ocultar log"
          >
            <ScrollText />
          </button>
        )}
      </div>
      {logs.length ? (
        <ol>
          {logs.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ol>
      ) : (
        <p>Nenhuma etapa registrada.</p>
      )}
    </div>
  );
}
function ConnectionModal({
  initial,
  user,
  close,
  save,
  remove,
  embedded = false,
}: {
  initial: Connection;
  user: User;
  close: () => void;
  save: (c: Connection) => Promise<void>;
  remove: (id: string) => Promise<void>;
  embedded?: boolean;
}) {
  const [data, setData] = useState(initial),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [report, setReport] = useState<TestReport | null>(null),
    [saved, setSaved] = useState<Connection[]>([]);
  const set = (key: keyof Connection, value: string | number) =>
    setData({ ...data, [key]: value });
  useEffect(() => {
    getDocs(query(collection(firestore, "connections"), orderBy("name"))).then(
      (snapshot) =>
        setSaved(
          snapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as Connection,
          ),
        ),
    );
  }, []);
  async function test() {
    try {
      setMessage("Testando conexão…");
      const response = await requestApi("/connections/test", user, {
        ...data,
        password,
      });
      setMessage("");
      setReport({
        ok: true,
        connection: response.connection,
        logs: response.logs,
      });
    } catch (error) {
      const failure = error as Error & { payload?: TestReport };
      setMessage("");
      setReport({
        ok: false,
        connection: failure.payload?.connection,
        logs: failure.payload?.logs ?? [failure.message],
      });
    }
  }
  async function persist() {
    try {
      await save(data);
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a conexão.";
      setMessage(
        text.includes("permission-denied")
          ? "O Firestore recusou o acesso. Publique as regras do Firestore antes de salvar."
          : text,
      );
    }
  }
  return (
    <>
      <div className={embedded ? "page-tab connections-tab" : "backdrop"}>
        <section className={embedded ? "connections-page" : "modal connections-modal"}>
          <button className="close" onClick={close}>
            <X />
          </button>
          <p className="eyebrow">CONEXÕES</p>
          <h2>Gerenciar bases de dados</h2>
          <div className="saved-connections">
            <b>Bases cadastradas</b>
            {saved.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Conexão</th>
                    <th>Ambiente</th>
                    <th>Banco</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {saved.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.environment}</td>
                      <td>{typeLabel[item.type]}</td>
                      <td>
                        <button
                          className="outline mini"
                          onClick={() => setData(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="danger mini"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Excluir a conexão “${item.name}”?`,
                              )
                            )
                              remove(item.id!);
                          }}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Nenhuma conexão cadastrada.</p>
            )}
          </div>
          <div className="connection-form-title">
            <h3>{data.id ? `Editando: ${data.name}` : "Nova conexão"}</h3>
            {data.id && (
              <button
                className="outline mini"
                onClick={() => setData({ ...emptyConnection })}
              >
                <Plus /> Nova
              </button>
            )}
          </div>
          <div className="fields">
            <label>
              Nome da Conexão
              <input
                value={data.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
            <label>
              Ambiente
              <select
                value={data.environment}
                onChange={(e) => set("environment", e.target.value)}
              >
                {[
                  "Produção",
                  "Homologação",
                  "Teste",
                  "Desenvolvimento",
                  "Interno (Espelho/Nimitz)",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Tipo de Banco
              <select
                value={data.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {Object.entries(typeLabel).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Host
              <input
                value={data.host}
                onChange={(e) => set("host", e.target.value)}
              />
            </label>
            <label>
              Porta
              <input
                type="number"
                value={data.port}
                onChange={(e) => set("port", Number(e.target.value))}
              />
            </label>
            <label>
              Base de Dados
              <input
                value={data.database}
                onChange={(e) => set("database", e.target.value)}
              />
            </label>
            <label>
              Usuário
              <input
                value={data.username}
                onChange={(e) => set("username", e.target.value)}
              />
            </label>
            <label className="wide">
              Senha para teste <span>Não é salva</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </div>
          {message && <p className="muted">{message}</p>}
          <footer>
            <div>
              {data.id && (
                <button className="danger" onClick={() => remove(data.id!)}>
                  Excluir
                </button>
              )}
              <button className="outline" onClick={test}>
                Testar Conexão
              </button>
            </div>
            <button
              className="primary"
              disabled={
                !data.name || !data.host || !data.database || !data.username
              }
              onClick={persist}
            >
              Salvar conexão
            </button>
          </footer>
        </section>
      </div>
      {report && <TestModal report={report} close={() => setReport(null)} />}
    </>
  );
}
function UsersModal({
  user,
  close,
  embedded = false,
}: {
  user: User;
  close: () => void;
  embedded?: boolean;
}) {
  const [users, setUsers] = useState<any[]>([]),
    [form, setForm] = useState({
      name: "",
      username: "",
      password: "",
      role: "common",
    }),
    [editing, setEditing] = useState<any | null>(null),
    [message, setMessage] = useState("");
  const load = () =>
    requestGet("/users", user)
      .then((data) => setUsers(data.users))
      .catch((error) => setMessage(error.message));
  useEffect(() => {
    load();
  }, []);
  async function create() {
    try {
      await requestApi("/users", user, form);
      setMessage("Usuário cadastrado com sucesso.");
      setForm({ name: "", username: "", password: "", role: "common" });
      load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o usuário.",
      );
    }
  }
  async function persist() {
    try {
      if (editing) {
        const update = form.password ? form : { ...form, password: undefined };
        await requestApi(`/users/${editing.uid}`, user, update, "PATCH");
      }
      else await requestApi("/users", user, form);
      setMessage(editing ? "Usuário atualizado com sucesso." : "Usuário cadastrado com sucesso.");
      setEditing(null);
      setForm({ name: "", username: "", password: "", role: "common" });
      load();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível salvar o usuário.";
      if (editing)
        await requestApi("/audit", user, {
          operation: "Alteração de usuário",
          connection: `Usuário: ${form.username}`,
          errorMessage,
        }).catch(() => undefined);
      setMessage(errorMessage);
    }
  }
  async function removeUser(item: any) {
    if (!window.confirm(`Excluir o usuário “${item.name}”?`)) return;
    try {
      await requestApi(`/users/${item.uid}`, user, {}, "DELETE");
      setMessage("Usuário excluído com sucesso.");
      if (editing?.uid === item.uid) {
        setEditing(null);
        setForm({ name: "", username: "", password: "", role: "common" });
      }
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir o usuário.");
    }
  }
  return (
    <div className={embedded ? "page-tab users-tab" : "backdrop"}>
      <section className={embedded ? "users-page" : "modal users-modal"}>
        <button className="close" onClick={close}>
          <X />
        </button>
        <p className="eyebrow">USUÁRIOS</p>
        <h2>Cadastro de usuários</h2>
        <div className="saved-connections">
          <b>Usuários existentes</b>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.uid}>
                  <td>{item.name}</td>
                  <td>{item.username || item.email}</td>
                  <td>{item.role === "admin" ? "Administrador" : "Comum"}</td>
                  <td>
                    <button
                      className="outline mini"
                      onClick={() => {
                        setEditing(item);
                        setForm({
                          name: item.name,
                          username: item.username || item.email?.split("@")[0] || "",
                          password: "",
                          role: item.role,
                        });
                        setMessage("");
                      }}
                    >
                      Editar
                    </button>
                    <button className="danger mini" onClick={() => removeUser(item)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Novo usuário</h3>
        <div className="fields">
          <label>
            Nome
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Login
            <input
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value.toUpperCase() })
              }
            />
          </label>
          <label>
            Senha {editing && <span>Deixe em branco para manter a atual</span>}
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            Tipo
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="common">Comum</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
        </div>
        {message && <p className="muted">{message}</p>}
        <footer>
          <span />
          <button
            className="primary"
            disabled={!form.name || !form.username || (!editing && form.password.length < 8) || (editing && !!form.password && form.password.length < 8)}
            onClick={persist}
          >
            {editing ? "Salvar alterações" : "Cadastrar usuário"}
          </button>
        </footer>
      </section>
    </div>
  );
}
function SettingsPage({
  user,
  ignoredParameters,
  setIgnoredParameters,
}: {
  user: User;
  ignoredParameters: string[];
  setIgnoredParameters: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState(ignoredParameters.join(", "));
  const [message, setMessage] = useState("");
  async function save() {
    const values = [...new Set(draft.split(",").map((value) => value.trim()).filter(Boolean))];
    try {
      await setDoc(doc(firestore, "users", user.uid), { ignoredParameters: values }, { merge: true });
      setIgnoredParameters(values);
      setDraft(values.join(", "));
      setMessage("Configurações salvas com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar as configurações.");
    }
  }
  return (
    <section className="page-tab settings-tab">
      <div className="settings-page">
        <p className="eyebrow">CONFIGURAÇÕES</p>
        <h2>Parâmetros ignorados</h2>
        <p className="muted">Informe os códigos que não devem aparecer no resultado das comparações, separados por vírgula.</p>
        <label className="settings-input">
          Códigos de parâmetros
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ex.: 80001, 80002"
          />
        </label>
        {message && <p className="muted">{message}</p>}
        <button className="primary" onClick={save}>Salvar configurações</button>
      </div>
    </section>
  );
}
function MonitoringModal({ user, close, embedded = false }: { user: User; close: () => void; embedded?: boolean }) {
  const [logs, setLogs] = useState<any[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [filter, setFilter] = useState(""),
    [loading, setLoading] = useState(false);
  async function load(next?: string | null) {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (next) params.set("cursor", next);
      if (filter.trim()) params.set("q", filter.trim());
      const data = await requestGet(
        `/monitoring${params.size ? `?${params}` : ""}`,
        user,
      );
      setLogs((current) => (next ? [...current, ...data.logs] : data.logs));
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [filter]);
  const shown = logs;
  const content = (
      <section className={embedded ? "monitor-tab" : "modal monitoring-modal"}>
        <button className="close" onClick={close}>
          <X />
        </button>
        <p className="eyebrow">MONITORAMENTO</p>
        <h2>Logs de operações</h2>
        <label className="search">
          <Search />
          <input
            placeholder="Filtrar em todos os logs…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <div
          className="monitor-list"
          onScroll={(event) => {
            const el = event.currentTarget;
            if (
              cursor &&
              el.scrollTop + el.clientHeight >= el.scrollHeight - 30
            )
              load(cursor);
          }}
        >
          {shown.map((log) => (
            <article key={log.id}>
              <b>
                {log.operation} {log.status === "error" && <em className="log-error">Erro</em>}
              </b>
              <span>
                {log.actor?.username} ·{" "}
                {log.createdAt
                  ? new Date(log.createdAt).toLocaleString("pt-BR")
                  : "processando…"}
              </span>
              <p>
                {Object.entries(log.details ?? {})
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" · ")}
              </p>
            </article>
          ))}
          {loading && <p className="muted">Carregando…</p>}
          {!loading && !shown.length && (
            <p className="muted">Nenhum log encontrado.</p>
          )}
        </div>
      </section>
  );
  return embedded ? content : <div className="backdrop">{content}</div>;
}
function Detail({ row, close }: { row: ResultRow; close: () => void }) {
  const missingConnection =
    row.missingIn === "first"
      ? row.firstConnectionName
      : row.secondConnectionName;
  const existingDescription =
    row.missingIn === "first" ? row.secondDescription : row.description;
  const existingExplanation =
    row.missingIn === "first" ? row.secondExplanation : row.explanation;
  return (
    <div className="backdrop">
      <section className="modal detail">
        <button className="close" onClick={close}>
          <X />
        </button>
        <p className="eyebrow">PARÂMETRO {row.code}</p>
        <h2>
          {row.missingIn ? "Parâmetro inexistente" : "Descrição Distinta"}
        </h2>
        {row.missingIn ? (
          <div className="missing-detail">
            <p>Parâmetro inexistente na base "{missingConnection}".</p>
            <h3>Descrição na base onde existe</h3>
            <b>{existingDescription ?? "Sem descrição disponível."}</b>
            <p>{existingExplanation ?? "Sem explicação disponível."}</p>
          </div>
        ) : (
          <div className="detail-grid">
            <div>
              <h3>{row.firstConnectionName}</h3>
              <b>{row.description ?? "Não encontrado"}</b>
              <p>{row.explanation ?? "Sem explicação disponível."}</p>
            </div>
            <div>
              <h3>{row.secondConnectionName}</h3>
              <b>{row.secondDescription ?? "Não encontrado"}</b>
              <p>{row.secondExplanation ?? "Sem explicação disponível."}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
function App({ user }: { user: User }) {
  const [connections, setConnections] = useState<Connection[]>([]),
    [firstId, setFirstId] = useState(""),
    [secondId, setSecondId] = useState(""),
    [firstPass, setFirstPass] = useState(
      import.meta.env.VITE_DEV_DB_PASSWORD ?? "",
    ),
    [secondPass, setSecondPass] = useState(
      import.meta.env.VITE_DEV_DB_PASSWORD ?? "",
    ),
    [hideEqual, setHideEqual] = useState(true),
    [resultsByType, setResultsByType] = useState<Record<"system" | "webservices" | "features", ResultRow[]>>({ system: [], webservices: [], features: [] }),
    [filter, setFilter] = useState(""),
    [showColumnFilters, setShowColumnFilters] = useState(false),
    [columnFilters, setColumnFilters] = useState({
      code: "",
      description: "",
      firstValue: "",
      secondValue: "",
      explanation: "",
    }),
    [modal, setModal] = useState<Connection | null>(null),
    [detail, setDetail] = useState<ResultRow | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [dark, setDark] = useState(false),
    [comparisonType, setComparisonType] = useState<"system" | "webservices" | "features">("system"),
    [webServices, setWebServices] = useState<{ first: { code: string; name: string }[]; second: { code: string; name: string }[] }>({ first: [], second: [] }),
    [firstWebService, setFirstWebService] = useState(""),
    [secondWebService, setSecondWebService] = useState(""),
    [operationLogs, setOperationLogs] = useState<string[]>([]),
    [page, setPage] = useState<
      "compare" | "connections" | "users" | "monitoring" | "settings"
    >("compare"),
    [ignoredParameters, setIgnoredParameters] = useState<string[]>([]),
    [admin, setAdmin] = useState(false);
  const rows = resultsByType[comparisonType];
  async function loadConnections() {
    const snapshot = await getDocs(
      query(collection(firestore, "connections"), orderBy("name")),
    );
    const list = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as Connection,
    );
    setConnections(list);
  }
  useEffect(() => {
    loadConnections().catch(() =>
      setNotice("Não foi possível carregar as conexões."),
    );
  }, []);
  useEffect(() => {
    getDoc(doc(firestore, "users", user.uid))
      .then((snapshot) => {
        const profile = snapshot.data();
        const values = profile?.ignoredParameters;
        if (Array.isArray(values))
          setIgnoredParameters(values.filter((value): value is string => typeof value === "string"));
        setDark(profile?.theme === "dark");
      })
      .catch(() => setNotice("Não foi possível carregar suas configurações."));
  }, [user.uid]);
  useEffect(() => {
    user.getIdTokenResult(true).then((token) => {
      setAdmin(token.claims.role === "admin");
      requestApi("/audit", user, { operation: "Login" }).catch(() => undefined);
    });
  }, [user]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  async function toggleTheme() {
    const next = !dark;
    setDark(next);
    try {
      await setDoc(doc(firestore, "users", user.uid), { theme: next ? "dark" : "light" }, { merge: true });
    } catch {
      setDark(!next);
      setNotice("Não foi possível salvar a preferência de tema.");
    }
  }
  function flattenLogs(logs?: { first: string[]; second: string[] }) {
    return logs ? [...logs.first, ...logs.second] : [];
  }
  async function openWebservices() {
    setComparisonType("webservices");
    if (!webServices.first.length || !webServices.second.length)
      setNotice("Clique em Comparar Bases para carregar os Webservices das duas bases.");
  }
  async function compare(webservicesOnly = false) {
    const first = connections.find((c) => c.id === firstId),
      second = connections.find((c) => c.id === secondId);
    if (!first || !second || !firstPass || !secondPass) {
      setNotice("Selecione as duas bases e informe as senhas.");
      return;
    }
    try {
      setBusy(true);
      setNotice("");
      setOperationLogs(["Preparando a comparação entre as duas bases…"]);
      const payload = {
        first: { ...first, password: firstPass },
        second: { ...second, password: secondPass },
      };
      if (webservicesOnly && (!firstWebService || !secondWebService)) {
        setNotice("Selecione um Webservice em cada base.");
        return;
      }
      const [systemData, firstWebServices, secondWebServices, featuresData] = await Promise.all([
        webservicesOnly ? Promise.resolve(null) : requestApi("/comparisons/parameters", user, payload),
        webservicesOnly ? Promise.resolve(null) : requestApi("/webservices", user, payload.first),
        webservicesOnly ? Promise.resolve(null) : requestApi("/webservices", user, payload.second),
        webservicesOnly ? Promise.resolve(null) : requestApi("/comparisons/features", user, payload),
      ]);
      if (firstWebServices && secondWebServices)
        setWebServices({ first: firstWebServices.webservices, second: secondWebServices.webservices });
      const webservicesData = firstWebService && secondWebService
        ? await requestApi("/comparisons/webservices", user, {
            ...payload,
            firstWebService: Number(firstWebService),
            secondWebService: Number(secondWebService),
          })
        : null;
      const merge = (data: { first: Parameter[]; second: Parameter[] }): ResultRow[] => {
        const other = new Map(data.second.map((p) => [p.code, p]));
        const merged: ResultRow[] = data.first.map((p) => {
          const pair = other.get(p.code);
          return {
            ...p, secondValue: pair?.value ?? null, secondDescription: pair?.description ?? null,
            secondExplanation: pair?.explanation ?? null, missingIn: !pair ? "second" : undefined,
            firstConnectionName: first.name, secondConnectionName: second.name,
            changed: !pair || p.value !== pair.value || p.description !== pair.description,
          };
        });
        data.second.filter((p) => !data.first.some((a) => a.code === p.code)).forEach((p) =>
          merged.push({ ...p, value: null, secondValue: p.value, secondDescription: p.description,
            secondExplanation: p.explanation, missingIn: "first", firstConnectionName: first.name,
            secondConnectionName: second.name, changed: true }),
        );
        return merged.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      };
      setResultsByType((current) => ({ system: systemData ? merge(systemData) : current.system, webservices: webservicesData ? merge(webservicesData) : current.webservices, features: featuresData ? merge(featuresData) : current.features }));
      setOperationLogs([...(systemData ? flattenLogs(systemData.logs) : []), ...(webservicesData ? flattenLogs(webservicesData.logs) : []), ...(featuresData ? flattenLogs(featuresData.logs) : [])]);
    } catch (error) {
      const failure = error as Error & {
        payload?: {
          logs?: { first: string[]; second: string[] };
          detail?: string;
        };
      };
      setOperationLogs([
        ...flattenLogs(failure.payload?.logs),
        ...(failure.payload?.detail
          ? [`Falha: ${failure.payload.detail}`]
          : [failure.message]),
      ]);
      await requestApi("/audit", user, {
        operation: "Consulta",
        connection: `${first?.name ?? "Base 1"} | ${second?.name ?? "Base 2"}`,
        errorMessage: failure.payload?.detail ?? failure.message,
      }).catch(() => undefined);
      setNotice(
        "Não foi possível concluir a comparação. Consulte o log abaixo.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(connection: Connection) {
    try {
    const { id, ...body } = connection;
    if (id) await updateDoc(doc(firestore, "connections", id), body);
    else await addDoc(collection(firestore, "connections"), body);
    await requestApi("/audit", user, {
      operation: id ? "Alteração de conexão" : "Inclusão de conexão",
      connection: `${body.name} | ${body.environment} | ${typeLabel[body.type]} | ${body.host}:${body.port} | base: ${body.database} | usuário: ${body.username}`,
    });
    await loadConnections();
    setModal({ ...emptyConnection });
    } catch (error) {
      const { id, ...body } = connection;
      await requestApi("/audit", user, {
        operation: id ? "Alteração de conexão" : "Inclusão de conexão",
        connection: `${body.name} | ${body.host}:${body.port} | base: ${body.database} | usuário: ${body.username}`,
        errorMessage: error instanceof Error ? error.message : "Erro não identificado.",
      }).catch(() => undefined);
      throw error;
    }
  }
  async function remove(id: string) {
    const connection = connections.find((item) => item.id === id);
    try {
    await deleteDoc(doc(firestore, "connections", id));
    if (connection)
      await requestApi("/audit", user, {
        operation: "Exclusão de conexão",
        connection: `${connection.name} | ${connection.environment} | ${typeLabel[connection.type]} | ${connection.host}:${connection.port} | base: ${connection.database} | usuário: ${connection.username}`,
      });
    await loadConnections();
    setModal({ ...emptyConnection });
    } catch (error) {
      await requestApi("/audit", user, {
        operation: "Exclusão de conexão",
        connection: connection ? `${connection.name} | ${connection.host}:${connection.port} | base: ${connection.database} | usuário: ${connection.username}` : id,
        errorMessage: error instanceof Error ? error.message : "Erro não identificado.",
      }).catch(() => undefined);
      throw error;
    }
  }
  const display = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!hideEqual || row.changed) &&
          !ignoredParameters.includes(row.code) &&
          row.code.toLowerCase().includes(columnFilters.code.toLowerCase()) &&
          `${row.description ?? ""} ${row.secondDescription ?? ""}`
            .toLowerCase()
            .includes(columnFilters.description.toLowerCase()) &&
          `${row.value ?? ""}`
            .toLowerCase()
            .includes(columnFilters.firstValue.toLowerCase()) &&
          `${row.secondValue ?? ""}`
            .toLowerCase()
            .includes(columnFilters.secondValue.toLowerCase()) &&
          `${row.explanation ?? ""} ${row.secondExplanation ?? ""}`
            .toLowerCase()
            .includes(columnFilters.explanation.toLowerCase()) &&
          `${row.code} ${row.description ?? ""} ${row.secondDescription ?? ""} ${row.value ?? ""} ${row.secondValue ?? ""} ${row.explanation ?? ""} ${row.secondExplanation ?? ""}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
      ),
    [rows, hideEqual, filter, ignoredParameters, columnFilters],
  );
  function exportFile() {
    const sheet = XLSX.utils.json_to_sheet(
      display.map((r) => ({
        Código: r.code,
        Descrição: r.description,
        [connections.find((c) => c.id === firstId)?.name ?? "Valor base 1"]:
          r.value,
        [connections.find((c) => c.id === secondId)?.name ?? "Valor base 2"]:
          r.secondValue,
        "Descrição base 2": r.secondDescription,
        "Explicação base 1": r.explanation,
        "Explicação base 2": r.secondExplanation,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Parâmetros");
    XLSX.writeFile(book, "comparacao-parametros.xlsx");
    setNotice("Arquivo Excel exportado com sucesso.");
  }
  return (
    <div className="app">
      <aside>
        <div className="logo">
          <span className="logo-icon">
            <img src="/db-compare-logo.png" alt="DB Compare" />
          </span>
          DB <b>Compare</b>
        </div>
        <nav>
          <a className={page === "compare" ? "active" : ""} onClick={() => setPage("compare")}>
            <Search /> Comparar bases
          </a>
          <a className={page === "connections" ? "active" : ""} onClick={() => { setModal({ ...emptyConnection }); setPage("connections"); }}>
            <ServerCog /> Conexões
          </a>
          <a className={page === "settings" ? "active" : ""} onClick={() => setPage("settings")} style={{ order: 99 }}>
            <Settings /> Configurações
          </a>
          {admin && (
            <a className={page === "users" ? "active" : ""} onClick={() => setPage("users")}>
              <Users /> Usuários
            </a>
          )}
          {admin && (
            <a className={page === "monitoring" ? "active" : ""} onClick={() => setPage("monitoring")}>
              <ClipboardList /> Monitoramento
            </a>
          )}
        </nav>
        <div className="account">
          <button onClick={toggleTheme}>
            {dark ? <Moon /> : <Sun />} Tema {dark ? "escuro" : "claro"}
          </button>
          <div>
            <span>{user.displayName?.[0] ?? "C"}</span>
            <p>
              <b>{user.displayName ?? "Carla Fillmann Barcelos"}</b>
              <small>Administrador</small>
            </p>
            <button title="Sair" onClick={() => signOut(auth)}>
              <LogOut />
            </button>
          </div>
        </div>
      </aside>
      <main>
        {page === "monitoring" && (
          <MonitoringModal user={user} close={() => setPage("compare")} embedded />
        )}
        {page === "connections" && modal && (
          <ConnectionModal initial={modal} user={user} close={() => setPage("compare")} save={save} remove={remove} embedded />
        )}
        {page === "settings" && (
          <SettingsPage
            user={user}
            ignoredParameters={ignoredParameters}
            setIgnoredParameters={setIgnoredParameters}
          />
        )}
        {page === "users" && admin && (
          <UsersModal user={user} close={() => setPage("compare")} embedded />
        )}
        {page === "compare" && <>
        <header>
          <div>
            <p className="eyebrow">COMPARAÇÃO ENTRE BASES DE DADOS</p>
            <h1>Comparador de Configurações - SAJ Procuradorias</h1>
          </div>
          <button
            className="outline"
            onClick={() => {
              setModal({ ...emptyConnection });
              setPage("connections");
            }}
          >
            <Plus /> Nova conexão
          </button>
        </header>
        <section className="compare">
          <Picker
            title="Base 1"
            connections={connections}
            id={firstId}
            password={firstPass}
            setId={setFirstId}
            setPassword={setFirstPass}
          />
          <div className="compare-action">
            <b className="vs">VS</b>
            <button className="primary run" onClick={() => compare()} disabled={busy}>
              <img src="/compare-bases-transparent.png" alt="" />
              {busy ? "Comparando…" : "Comparar Bases"}
            </button>
          </div>
          <Picker
            title="Base 2"
            connections={connections}
            id={secondId}
            password={secondPass}
            setId={setSecondId}
            setPassword={setSecondPass}
          />
          {operationLogs.length > 0 && <LogPanel logs={operationLogs} />}
        </section>
        <div className="tabs">
          <button
            className={comparisonType === "system" ? "selected" : ""}
            onClick={() => setComparisonType("system")}
          >
            Parâmetros do Sistema
          </button>
          <button
            className={comparisonType === "webservices" ? "selected" : ""}
            onClick={openWebservices}
          >
            Parâmetros de Webservices
          </button>
          <button
            className={comparisonType === "features" ? "selected" : ""}
            onClick={() => setComparisonType("features")}
          >
            Features
          </button>
        </div>
        {comparisonType === "webservices" && (
          <section className="webservice-selectors">
            <label>Webservice da Base 1
              <select value={firstWebService} onChange={(event) => setFirstWebService(event.target.value)}>
                <option value="">Selecione o Webservice</option>
                {webServices.first.map((item) => <option key={item.code} value={item.code}>{item.code} - {item.name}</option>)}
              </select>
            </label>
            <label>Webservice da Base 2
              <select value={secondWebService} onChange={(event) => setSecondWebService(event.target.value)}>
                <option value="">Selecione o Webservice</option>
                {webServices.second.map((item) => <option key={item.code} value={item.code}>{item.code} - {item.name}</option>)}
              </select>
            </label>
            <button className="primary" onClick={() => compare(true)} disabled={busy || !firstWebService || !secondWebService}>Comparar Webservices</button>
          </section>
        )}
        {notice && (
          <div className="notice">
            {notice}
            <button onClick={() => setNotice("")}>
              <X />
            </button>
          </div>
        )}
        <section className="results">
          <div className="result-head">
            <div>
              <h2>Resultado da comparação</h2>
              <p className="muted">
                {rows.length
                  ? `${display.length} de ${rows.length} parâmetros exibidos`
                  : "Execute uma comparação para visualizar os resultados."}
              </p>
            </div>
            <div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={hideEqual}
                  onChange={(e) => setHideEqual(e.target.checked)}
                />{" "}
                Ocultar valores iguais
              </label>
              <button
                className="outline export-excel"
                onClick={exportFile}
                disabled={!display.length}
                title="Exportar Excel"
                aria-label="Exportar Excel"
              >
                <FileSpreadsheet />
              </button>
            </div>
          </div>
          <label className="search">
            <Search />
            <input
              placeholder="Filtrar por código, descrição ou valor…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <div className="table-wrap">
            {comparisonType === "webservices" ? (
              <table className="webservices-table">
                <thead>
                  <tr>
                    <th>Parâmetro</th>
                    <th>Valor {connections.find((c) => c.id === firstId)?.name ?? "Base 1"}</th>
                    <th>Valor {connections.find((c) => c.id === secondId)?.name ?? "Base 2"}</th>
                    <th className="filterable-heading">
                      <span>Descrição</span>
                      <button
                        className={`column-filter-toggle ${showColumnFilters ? "active" : ""}`}
                        title="Exibir filtros por coluna"
                        aria-label="Exibir filtros por coluna"
                        onClick={() => setShowColumnFilters((current) => !current)}
                      >
                        <Filter />
                      </button>
                    </th>
                  </tr>
                  {showColumnFilters && (
                    <tr className="column-filters">
                      {([
                        ["description", "Parâmetro"],
                        ["firstValue", "Valor"],
                        ["secondValue", "Valor"],
                        ["explanation", "Descrição"],
                      ] as const).map(([key, placeholder]) => (
                        <th key={key}>
                          <input
                            value={columnFilters[key]}
                            placeholder={placeholder}
                            onChange={(event) => setColumnFilters((current) => ({ ...current, [key]: event.target.value }))}
                          />
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {display.map((row) => (
                    <tr className={row.changed ? "changed" : ""} key={row.code}>
                      <td>
                        {row.description ?? row.secondDescription ?? <em>Sem parâmetro</em>}
                        {row.missingIn && (
                          <button
                            className="icon missing"
                            onClick={() => setDetail(row)}
                            title="Parâmetro inexistente em uma das bases"
                          >
                            <AlertTriangle />
                          </button>
                        )}
                        {!hideEqual && row.changed && <span className="diff-badge">DIF</span>}
                      </td>
                      <td>{row.value ?? "—"}</td>
                      <td>{row.secondValue ?? "—"}</td>
                      <td>{row.explanation ?? row.secondExplanation ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : comparisonType === "features" ? (
              <table className="features-table">
                <thead>
                  <tr>
                    <th>Feature</th><th>Configuração</th>
                    <th>Valor {connections.find((c) => c.id === firstId)?.name ?? "Base 1"}</th>
                    <th>Valor {connections.find((c) => c.id === secondId)?.name ?? "Base 2"}</th>
                    <th className="filterable-heading"><span>Observação</span><button className={`column-filter-toggle ${showColumnFilters ? "active" : ""}`} title="Exibir filtros por coluna" onClick={() => setShowColumnFilters((current) => !current)}><Filter /></button></th>
                  </tr>
                  {showColumnFilters && <tr className="column-filters">{([['code','Feature'],['description','Configuração'],['firstValue','Valor'],['secondValue','Valor'],['explanation','Observação']] as const).map(([key, placeholder]) => <th key={key}><input value={columnFilters[key]} placeholder={placeholder} onChange={(event) => setColumnFilters((current) => ({ ...current, [key]: event.target.value }))} /></th>)}</tr>}
                </thead>
                <tbody>{display.map((row) => <tr className={row.changed ? "changed" : ""} key={row.code}><td><code>{row.code}</code>{!hideEqual && row.changed && <span className="diff-badge">DIF</span>}</td><td>{row.description ?? row.secondDescription ?? "—"}</td><td>{row.value ?? "—"}</td><td>{row.secondValue ?? "—"}</td><td>{row.explanation ?? row.secondExplanation ?? "—"}</td></tr>)}</tbody>
              </table>
            ) : (
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>
                    {connections.find((c) => c.id === firstId)?.name ??
                      "Valor base 1"}
                  </th>
                  <th>
                    {connections.find((c) => c.id === secondId)?.name ??
                      "Valor base 2"}
                  </th>
                  <th className="filterable-heading">
                    <span>Explicação</span>
                    <button
                      className={`column-filter-toggle ${showColumnFilters ? "active" : ""}`}
                      title="Exibir filtros por coluna"
                      aria-label="Exibir filtros por coluna"
                      onClick={() => setShowColumnFilters((current) => !current)}
                    >
                      <Filter />
                    </button>
                  </th>
                </tr>
                {showColumnFilters && (
                  <tr className="column-filters">
                    {([
                      ["code", "Código"],
                      ["description", "Descrição"],
                      ["firstValue", "Valor"],
                      ["secondValue", "Valor"],
                      ["explanation", "Explicação"],
                    ] as const).map(([key, placeholder]) => (
                      <th key={key}>
                        <input
                          value={columnFilters[key]}
                          placeholder={placeholder}
                          onChange={(event) =>
                            setColumnFilters((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {display.map((row) => (
                  <tr className={row.changed ? "changed" : ""} key={row.code}>
                    <td>
                      <code>{row.code}</code>
                      {!hideEqual && row.changed && <span className="diff-badge">DIF</span>}
                    </td>
                    <td>
                      {row.description ?? row.secondDescription ?? (
                        <em>Sem descrição</em>
                      )}
                      {(row.missingIn ||
                        row.description !== row.secondDescription) && (
                        <button
                          className={`icon ${row.missingIn ? "missing" : "warning"}`}
                          onClick={() => setDetail(row)}
                          title={
                            row.missingIn
                              ? "Parâmetro inexistente em uma das bases"
                              : "Descrição diferente"
                          }
                        >
                          <AlertTriangle />
                        </button>
                      )}
                    </td>
                    <td>{row.value ?? "—"}</td>
                    <td>{row.secondValue ?? <em>Não existe na base 2</em>}</td>
                    <td>
                      <button
                        className="icon"
                        onClick={() => setDetail(row)}
                        title="Ver explicações"
                      >
                        <Info />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </section>
        </>}
      </main>
      {detail && <Detail row={detail} close={() => setDetail(null)} />}
    </div>
  );
}
function Root() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user ? <App user={user} /> : <Login />;
}
createRoot(document.getElementById("root")!).render(<Root />);
