import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { log } from "../utils/logger.js";

const raizSrc = join(dirname(fileURLToPath(import.meta.url)), "..");

function archivosJs(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivosJs(ruta));
    else if (entrada.endsWith(".js")) salida.push(ruta);
  }
  return salida;
}

export async function cargarComandos(client) {
  const dir = join(raizSrc, "commands");
  for (const ruta of archivosJs(dir)) {
    const mod = await import(pathToFileURL(ruta).href);
    const comando = mod.default;
    if (!comando?.data || !comando?.execute) {
      log.warn(`Comando inválido omitido: ${ruta}`);
      continue;
    }
    client.commands.set(comando.data.name, comando);
  }
  log.info(`${client.commands.size} comandos cargados`);
}

export async function cargarEventos(client) {
  const dir = join(raizSrc, "events");
  for (const ruta of archivosJs(dir)) {
    const mod = await import(pathToFileURL(ruta).href);
    const evento = mod.default;
    if (!evento?.name || !evento?.execute) continue;
    const manejador = (...args) => evento.execute(...args, client);
    evento.once ? client.once(evento.name, manejador) : client.on(evento.name, manejador);
  }
  log.info("Eventos registrados");
}

export async function listarDatosComandos() {
  const dir = join(raizSrc, "commands");
  const datos = [];
  for (const ruta of archivosJs(dir)) {
    const mod = await import(pathToFileURL(ruta).href);
    if (mod.default?.data) datos.push(mod.default.data.toJSON());
  }
  return datos;
}
