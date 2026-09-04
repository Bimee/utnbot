import { config } from "../config.js";

const marca = () => new Date().toISOString().replace("T", " ").slice(0, 19);

export const log = {
  info: (msg) => console.log(`[${marca()}] INFO  ${msg}`),
  warn: (msg) => console.warn(`[${marca()}] WARN  ${msg}`),
  error: (msg, err) => console.error(`[${marca()}] ERROR ${msg}`, err ?? ""),
};

export async function logCanal(client, embed) {
  if (!config.canales.logs) return;
  try {
    const canal = await client.channels.fetch(config.canales.logs);
    if (canal?.isTextBased()) await canal.send({ embeds: [embed] });
  } catch (err) {
    log.error("No se pudo escribir en el canal de logs", err);
  }
}
