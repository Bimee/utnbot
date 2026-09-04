import cron from "node-cron";
import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { fechas } from "../database.js";
import { log } from "../utils/logger.js";

const HITOS = [
  { dias: 30, etiqueta: "Falta 1 mes" },
  { dias: 14, etiqueta: "Faltan 2 semanas" },
  { dias: 7, etiqueta: "Falta 1 semana" },
  { dias: 3, etiqueta: "Faltan 3 días" },
  { dias: 1, etiqueta: "Es mañana" },
  { dias: 0, etiqueta: "Es hoy" },
];

const MS_DIA = 86_400_000;

export function iniciarRecordatorios(client) {
  // 09:00 hora de Argentina, todos los días.
  cron.schedule("0 9 * * *", () => revisar(client), { timezone: "America/Argentina/Cordoba" });
  log.info("Recordatorios de fechas programados (09:00 ART)");
}

async function revisar(client) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (const registro of fechas.pendientes.all(hoy.toISOString().slice(0, 10))) {
    const objetivo = new Date(`${registro.fecha}T00:00:00`);
    const diasRestantes = Math.round((objetivo - hoy) / MS_DIA);

    const hito = HITOS.find((h) => h.dias === diasRestantes);
    if (!hito) continue;

    const enviados = JSON.parse(registro.avisos);
    if (enviados.includes(hito.dias)) continue;

    await enviarAviso(client, registro, hito, objetivo);

    enviados.push(hito.dias);
    fechas.marcarAviso.run(JSON.stringify(enviados), registro.id);
  }
}

async function enviarAviso(client, registro, hito, objetivo) {
  const canal = await client.channels.fetch(registro.canal_id).catch(() => null);
  if (!canal?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(hito.dias <= 1 ? config.colores.error : config.colores.alerta)
    .setTitle(`⏰ ${hito.etiqueta}: ${registro.titulo}`)
    .setDescription(registro.descripcion || null)
    .addFields({
      name: "Fecha",
      value: `<t:${Math.floor(objetivo.getTime() / 1000)}:D>`,
    })
    .setTimestamp();

  await canal.send({ embeds: [embed] }).catch((err) =>
    log.error(`No se pudo enviar el recordatorio "${registro.titulo}"`, err)
  );
}
