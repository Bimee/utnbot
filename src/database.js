import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ruta = resolve(process.cwd(), "data", "bot.db");
mkdirSync(dirname(ruta), { recursive: true });

const db = new Database(ruta);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS sanciones (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    usuario_id   TEXT NOT NULL,
    moderador_id TEXT NOT NULL,
    tipo         TEXT NOT NULL,
    motivo       TEXT NOT NULL,
    creado_en    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sanciones_usuario ON sanciones(guild_id, usuario_id);

  CREATE TABLE IF NOT EXISTS fechas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    titulo      TEXT NOT NULL,
    descripcion TEXT,
    fecha       TEXT NOT NULL,
    canal_id    TEXT NOT NULL,
    avisos      TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS encuestas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    mensaje_id TEXT UNIQUE,
    canal_id   TEXT NOT NULL,
    autor_id   TEXT NOT NULL,
    pregunta   TEXT NOT NULL,
    opciones   TEXT NOT NULL,
    multiple   INTEGER NOT NULL DEFAULT 0,
    cerrada    INTEGER NOT NULL DEFAULT 0,
    creado_en  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS votos (
    encuesta_id INTEGER NOT NULL,
    usuario_id  TEXT NOT NULL,
    opcion      INTEGER NOT NULL,
    PRIMARY KEY (encuesta_id, usuario_id, opcion)
  );

  CREATE TABLE IF NOT EXISTS canales_temporales (
    canal_id  TEXT PRIMARY KEY,
    dueno_id  TEXT NOT NULL,
    tipo      TEXT NOT NULL,
    creado_en INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_estado (
    url        TEXT PRIMARY KEY,
    ultimo_id  TEXT,
    revisado   INTEGER
  );
`);

export const sanciones = {
  registrar: db.prepare(
    `INSERT INTO sanciones (guild_id, usuario_id, moderador_id, tipo, motivo, creado_en)
     VALUES (?, ?, ?, ?, ?, ?)`
  ),
  historial: db.prepare(
    `SELECT * FROM sanciones WHERE guild_id = ? AND usuario_id = ? ORDER BY creado_en DESC LIMIT 25`
  ),
  contar: db.prepare(
    `SELECT COUNT(*) AS total FROM sanciones WHERE guild_id = ? AND usuario_id = ? AND tipo = 'warn'`
  ),
  limpiar: db.prepare(`DELETE FROM sanciones WHERE guild_id = ? AND usuario_id = ?`),
};

export const fechas = {
  crear: db.prepare(
    `INSERT INTO fechas (guild_id, titulo, descripcion, fecha, canal_id) VALUES (?, ?, ?, ?, ?)`
  ),
  listar: db.prepare(`SELECT * FROM fechas WHERE guild_id = ? ORDER BY fecha ASC`),
  pendientes: db.prepare(`SELECT * FROM fechas WHERE fecha >= ? ORDER BY fecha ASC`),
  eliminar: db.prepare(`DELETE FROM fechas WHERE id = ? AND guild_id = ?`),
  marcarAviso: db.prepare(`UPDATE fechas SET avisos = ? WHERE id = ?`),
};

export const encuestas = {
  crear: db.prepare(
    `INSERT INTO encuestas (canal_id, autor_id, pregunta, opciones, multiple, creado_en)
     VALUES (?, ?, ?, ?, ?, ?)`
  ),
  vincularMensaje: db.prepare(`UPDATE encuestas SET mensaje_id = ? WHERE id = ?`),
  porMensaje: db.prepare(`SELECT * FROM encuestas WHERE mensaje_id = ?`),
  cerrar: db.prepare(`UPDATE encuestas SET cerrada = 1 WHERE id = ?`),
};

export const votos = {
  registrar: db.prepare(
    `INSERT OR IGNORE INTO votos (encuesta_id, usuario_id, opcion) VALUES (?, ?, ?)`
  ),
  quitar: db.prepare(`DELETE FROM votos WHERE encuesta_id = ? AND usuario_id = ? AND opcion = ?`),
  limpiarUsuario: db.prepare(`DELETE FROM votos WHERE encuesta_id = ? AND usuario_id = ?`),
  existe: db.prepare(
    `SELECT 1 FROM votos WHERE encuesta_id = ? AND usuario_id = ? AND opcion = ?`
  ),
  conteo: db.prepare(
    `SELECT opcion, COUNT(*) AS total FROM votos WHERE encuesta_id = ? GROUP BY opcion`
  ),
  totalVotantes: db.prepare(
    `SELECT COUNT(DISTINCT usuario_id) AS total FROM votos WHERE encuesta_id = ?`
  ),
};

export const canalesTemporales = {
  crear: db.prepare(
    `INSERT INTO canales_temporales (canal_id, dueno_id, tipo, creado_en) VALUES (?, ?, ?, ?)`
  ),
  obtener: db.prepare(`SELECT * FROM canales_temporales WHERE canal_id = ?`),
  eliminar: db.prepare(`DELETE FROM canales_temporales WHERE canal_id = ?`),
  porDueno: db.prepare(`SELECT * FROM canales_temporales WHERE dueno_id = ? AND tipo = ?`),
  todos: db.prepare(`SELECT * FROM canales_temporales`),
};

export const feedEstado = {
  obtener: db.prepare(`SELECT * FROM feed_estado WHERE url = ?`),
  guardar: db.prepare(
    `INSERT INTO feed_estado (url, ultimo_id, revisado) VALUES (?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET ultimo_id = excluded.ultimo_id, revisado = excluded.revisado`
  ),
};

export default db;
