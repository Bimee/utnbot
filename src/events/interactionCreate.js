import { Events } from "discord.js";
import { manejarBotonAutorol } from "../services/autoroles.js";
import { manejarVoto, manejarCierreEncuesta } from "../services/encuestas.js";
import { responderError } from "../utils/embeds.js";
import { log } from "../utils/logger.js";

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const comando = client.commands.get(interaction.commandName);
        if (!comando) return;
        await comando.execute(interaction, client);
        return;
      }

      if (interaction.isButton()) {
        const [prefijo] = interaction.customId.split(":");
        if (prefijo === "autorol") return manejarBotonAutorol(interaction);
        if (prefijo === "voto") return manejarVoto(interaction);
        if (prefijo === "cerrarEncuesta") return manejarCierreEncuesta(interaction);
      }
    } catch (err) {
      log.error(`Fallo procesando la interacción ${interaction.customId ?? interaction.commandName}`, err);
      await responderError(interaction, "Ocurrió un error al procesar la acción.").catch(() => null);
    }
  },
};
