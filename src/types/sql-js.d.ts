declare module 'sql.js' {
  export type SqlValue = number | string | Uint8Array | null;
  export type BindParams = SqlValue[];

  export interface Statement {
    bind(values?: BindParams): boolean;
    step(): boolean;
    getAsObject(params?: BindParams): Record<string, SqlValue>;
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | null);
    run(sql: string, params?: BindParams): this;
    exec(sql: string, params?: BindParams): { columns: string[]; values: SqlValue[][] }[];
    prepare(sql: string, params?: BindParams): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface SqlJsConfig {
    locateFile?: (url: string, scriptDirectory: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
