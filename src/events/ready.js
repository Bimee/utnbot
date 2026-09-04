import { Events, ActivityType } from "discord.js";
import { canalesTemporales } from "../database.js";
import { iniciarRecordatorios } from "../services/scheduler.js";
import { iniciarFeeds } from "../services/feeds.js";
import { log } from "../utils/logger.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    log.info(`Conectado como ${client.user.tag}`);

    client.user.setActivity("el ingreso 2027", { type: ActivityType.Watching });

    // Los canales temporales no sobreviven a un reinicio del bot: si el proceso
    // cayó con salas abiertas, quedan huérfanas en la base y hay que reconciliar.
    for (const registro of canalesTemporales.todos.all()) {
      const canal = await client.channels.fetch(registro.canal_id).catch(() => null);
      if (!canal) {
        canalesTemporales.eliminar.run(registro.canal_id);
        continue;
      }
      if (registro.tipo === "voz" && canal.members.size === 0) {
        await canal.delete().catch(() => null);
        canalesTemporales.eliminar.run(registro.canal_id);
      }
    }

    iniciarRecordatorios(client);
    iniciarFeeds(client);
  },
};
