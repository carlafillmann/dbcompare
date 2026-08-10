export type DatabaseType = 'oracle' | 'postgres' | 'sqlserver';

export interface ConnectionInput {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface ParameterRow {
  code: string;
  description: string | null;
  value: string | null;
  explanation: string | null;
}
