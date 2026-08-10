import oracledb from 'oracledb';
import pg from 'pg';
import sql from 'mssql';
import type { ConnectionInput, ParameterRow } from './types.js';

const parameterSql = `SELECT D.CDPARAMETRO, D.DEPARAMETRO, V.VLPARAMETRO, D.DEEXPLICACAO
FROM EPADDEFPARAMETRO D
JOIN EPADVALORPARAMETRO V ON (D.CDPARAMETRO = V.CDPARAMETRO)
WHERE V.CDSISTEMA = 91 AND V.CDINSTALACAO = 1`;
const webServiceSql = `SELECT P.CDWEBSERVICES, W.DEWEBSERVICES, P.DEPARAMETRO, P.VLPARAMETRO, P.DEDESCRICAO
FROM ESPJWSPARAMETROS P
JOIN ESPJWS W ON (P.CDWEBSERVICES = W.CDWEBSERVICES)
WHERE P.CDWEBSERVICES = `;
const webServicesListSql = `SELECT CDWEBSERVICES, DEWEBSERVICES FROM ESPJWS ORDER BY CDWEBSERVICES`;
const featuresSql = `SELECT NMCONFIGFEATURE, DECONFIG, VLCONFIG, DEOBSERVACAO FROM ESPJCONFIGFEATURE ORDER BY NMCONFIGFEATURE`;

function normalize(row: Record<string, unknown>): ParameterRow {
  const val = (key: string) => row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
  return {
    code: String(val('CDPARAMETRO')),
    description: val('DEPARAMETRO') == null ? null : String(val('DEPARAMETRO')),
    value: val('VLPARAMETRO') == null ? null : String(val('VLPARAMETRO')),
    explanation: val('DEEXPLICACAO') == null ? null : String(val('DEEXPLICACAO'))
  };
}
function normalizeWebService(row: Record<string, unknown>): ParameterRow {
  const val = (key: string) => row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
  const parameter = val('DEPARAMETRO') == null ? '' : String(val('DEPARAMETRO'));
  return {
    code: parameter,
    description: parameter || null,
    value: val('VLPARAMETRO') == null ? null : String(val('VLPARAMETRO')),
    explanation: val('DEDESCRICAO') == null ? null : String(val('DEDESCRICAO')),
  };
}
function normalizeFeature(row: Record<string, unknown>): ParameterRow {
  const val = (key: string) => row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
  return {
    code: String(val('NMCONFIGFEATURE')),
    description: val('DECONFIG') == null ? null : String(val('DECONFIG')),
    value: val('VLCONFIG') == null ? null : String(val('VLCONFIG')),
    explanation: val('DEOBSERVACAO') == null ? null : String(val('DEOBSERVACAO')),
  };
}

export function connectionSummary(c: ConnectionInput) { return `${c.type} | ${c.host}:${c.port} | base: ${c.database} | usuário: ${c.username}`; }
export async function testConnection(c: ConnectionInput, log: (line: string) => void = () => {}) {
  log(`Iniciando conexão: ${connectionSummary(c)}`);
  if (c.type === 'postgres') {
    const client = new pg.Client({ host: c.host, port: c.port, database: c.database, user: c.username, password: c.password, connectionTimeoutMillis: 8000 });
    await client.connect(); log('Conexão estabelecida. Executando SELECT 1.'); await client.query('SELECT 1'); await client.end(); log('Teste concluído com sucesso.'); return;
  }
  if (c.type === 'sqlserver') {
    const pool = await sql.connect({ server: c.host, port: c.port, database: c.database, user: c.username, password: c.password, options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 8000 });
    log('Conexão estabelecida. Executando SELECT 1.'); await pool.request().query('SELECT 1'); await pool.close(); log('Teste concluído com sucesso.'); return;
  }
  const conn = await oracledb.getConnection({ user: c.username, password: c.password, connectString: `${c.host}:${c.port}/${c.database}` });
  log('Conexão estabelecida. Executando SELECT 1 FROM DUAL.'); await conn.execute('SELECT 1 FROM DUAL'); await conn.close(); log('Teste concluído com sucesso.');
}

export async function loadParameters(c: ConnectionInput, log: (line: string) => void = () => {}): Promise<ParameterRow[]> {
  log(`Conectando: ${connectionSummary(c)}`);
  log('Executando consulta de Parâmetros do Sistema (V.CDSISTEMA=91; V.CDINSTALACAO=1).');
  if (c.type === 'postgres') {
    const client = new pg.Client({ host: c.host, port: c.port, database: c.database, user: c.username, password: c.password, connectionTimeoutMillis: 10000 });
    await client.connect(); const result = await client.query(parameterSql); await client.end(); log(`${result.rows.length} parâmetros retornados.`); return result.rows.map(normalize);
  }
  if (c.type === 'sqlserver') {
    const pool = await sql.connect({ server: c.host, port: c.port, database: c.database, user: c.username, password: c.password, options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 10000 });
    const result = await pool.request().query(parameterSql); await pool.close(); log(`${result.recordset.length} parâmetros retornados.`); return result.recordset.map(normalize);
  }
  const conn = await oracledb.getConnection({ user: c.username, password: c.password, connectString: `${c.host}:${c.port}/${c.database}` });
  const result = await conn.execute(parameterSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }); await conn.close(); log(`${result.rows?.length ?? 0} parâmetros retornados.`); return ((result.rows ?? []) as Record<string, unknown>[]).map(normalize);
}

export async function loadWebServices(c: ConnectionInput) {
  const normalizeList = (row: Record<string, unknown>) => {
    const val = (key: string) => row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
    return { code: String(val('CDWEBSERVICES')), name: String(val('DEWEBSERVICES') ?? '') };
  };
  if (c.type === 'postgres') {
    const client = new pg.Client({ host: c.host, port: c.port, database: c.database, user: c.username, password: c.password, connectionTimeoutMillis: 10000 });
    await client.connect(); const result = await client.query(webServicesListSql); await client.end(); return result.rows.map(normalizeList);
  }
  if (c.type === 'sqlserver') {
    const pool = await sql.connect({ server: c.host, port: c.port, database: c.database, user: c.username, password: c.password, options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 10000 });
    const result = await pool.request().query(webServicesListSql); await pool.close(); return result.recordset.map(normalizeList);
  }
  const conn = await oracledb.getConnection({ user: c.username, password: c.password, connectString: `${c.host}:${c.port}/${c.database}` });
  const result = await conn.execute(webServicesListSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }); await conn.close(); return ((result.rows ?? []) as Record<string, unknown>[]).map(normalizeList);
}
export async function loadFeatures(c: ConnectionInput, log: (line: string) => void = () => {}): Promise<ParameterRow[]> {
  log(`Conectando: ${connectionSummary(c)}`);
  log('Executando consulta de Features.');
  if (c.type === 'postgres') {
    const client = new pg.Client({ host: c.host, port: c.port, database: c.database, user: c.username, password: c.password, connectionTimeoutMillis: 10000 });
    await client.connect(); const result = await client.query(featuresSql); await client.end(); log(`${result.rows.length} features retornadas.`); return result.rows.map(normalizeFeature);
  }
  if (c.type === 'sqlserver') {
    const pool = await sql.connect({ server: c.host, port: c.port, database: c.database, user: c.username, password: c.password, options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 10000 });
    const result = await pool.request().query(featuresSql); await pool.close(); log(`${result.recordset.length} features retornadas.`); return result.recordset.map(normalizeFeature);
  }
  const conn = await oracledb.getConnection({ user: c.username, password: c.password, connectString: `${c.host}:${c.port}/${c.database}` });
  const result = await conn.execute(featuresSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }); await conn.close(); log(`${result.rows?.length ?? 0} features retornadas.`); return ((result.rows ?? []) as Record<string, unknown>[]).map(normalizeFeature);
}
export async function loadWebServiceParameters(c: ConnectionInput, serviceCode: number, log: (line: string) => void = () => {}): Promise<ParameterRow[]> {
  log(`Conectando: ${connectionSummary(c)}`);
  log('Executando consulta de Parâmetros de Webservices.');
  if (c.type === 'postgres') {
    const client = new pg.Client({ host: c.host, port: c.port, database: c.database, user: c.username, password: c.password, connectionTimeoutMillis: 10000 });
    await client.connect(); const result = await client.query(`${webServiceSql}${serviceCode} ORDER BY P.CDWEBSERVICES, P.DEPARAMETRO`); await client.end(); log(`${result.rows.length} parâmetros retornados.`); return result.rows.map(normalizeWebService);
  }
  if (c.type === 'sqlserver') {
    const pool = await sql.connect({ server: c.host, port: c.port, database: c.database, user: c.username, password: c.password, options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 10000 });
    const result = await pool.request().query(`${webServiceSql}${serviceCode} ORDER BY P.CDWEBSERVICES, P.DEPARAMETRO`); await pool.close(); log(`${result.recordset.length} parâmetros retornados.`); return result.recordset.map(normalizeWebService);
  }
  const conn = await oracledb.getConnection({ user: c.username, password: c.password, connectString: `${c.host}:${c.port}/${c.database}` });
  const result = await conn.execute(`${webServiceSql}${serviceCode} ORDER BY P.CDWEBSERVICES, P.DEPARAMETRO`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }); await conn.close(); log(`${result.rows?.length ?? 0} parâmetros retornados.`); return ((result.rows ?? []) as Record<string, unknown>[]).map(normalizeWebService);
}
