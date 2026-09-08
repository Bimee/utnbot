import cron from "node-cron";
import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { mensajesProgramados } from "../database.js";
import { log } from "../utils/logger.js";

const TZ = "America/Argentina/Cordoba";

// Tareas cron vivas, indexadas por id de la base. Permiten reprogramar o
// cancelar sin reiniciar el bot cuando se crea, pausa o elimina un mensaje.
const tareas = new Map();

export const TIPOS = {
  general: { color: config.colores.primario, icono: "📢" },
  recordatorio: { color: config.colores.alerta, icono: "⏰" },
  tip: { color: config.colores.exito, icono: "💡" },
  info: { color: config.colores.neutro, icono: "ℹ️" },
};

export function iniciarMensajesProgramados(client) {
  for (const registro of mensajesProgramados.activos.all()) programar(client, registro);
  log.info(`Mensajes programados activos: ${tareas.size}`);
}

export function programar(client, registro) {
  cancelar(registro.id);
  if (!cron.validate(registro.cron)) {
    log.warn(`Cron inválido en mensaje programado #${registro.id}: ${registro.cron}`);
    return false;
  }
  const tarea = cron.schedule(registro.cron, () => enviar(client, registro), { timezone: TZ });
  tareas.set(registro.id, tarea);
  return true;
}

export function cancelar(id) {
  const tarea = tareas.get(id);
  if (!tarea) return;
  tarea.stop();
  tareas.delete(id);
}

export async function enviar(client, registro) {
  const canal = await client.channels.fetch(registro.canal_id).catch(() => null);
  if (!canal?.isTextBased()) {
    log.warn(`Mensaje programado #${registro.id}: canal ${registro.canal_id} no disponible`);
    return;
  }

  const tipo = TIPOS[registro.tipo] ?? TIPOS.general;
  const embed = new EmbedBuilder()
    .setColor(tipo.color)
    .setDescription(registro.contenido.replace(/\\n/g, "\n"))
    .setTimestamp();
  if (registro.titulo) embed.setTitle(`${tipo.icono} ${registro.titulo}`);

  await canal
    .send({ embeds: [embed] })
    .then(() => mensajesProgramados.marcarEnvio.run(Date.now(), registro.id))
    .catch((err) => log.error(`No se pudo enviar el mensaje programado #${registro.id}`, err));
}
