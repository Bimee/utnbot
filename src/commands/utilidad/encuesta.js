import { SlashCommandBuilder } from "discord.js";
import { encuestas } from "../../database.js";
import { construirEmbed, construirBotones } from "../../services/encuestas.js";
import { responderError } from "../../utils/embeds.js";

export default {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName("encuesta")
      .setDescription("Crea una encuesta con botones y resultados en vivo")
      .addStringOption((o) =>
        o.setName("pregunta").setDescription("Pregunta de la encuesta").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("opcion1").setDescription("Primera opción").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("opcion2").setDescription("Segunda opción").setRequired(true)
      );

    for (let i = 3; i <= 10; i++) {
      builder.addStringOption((o) =>
        o.setName(`opcion${i}`).setDescription(`Opción ${i}`)
      );
    }

    return builder.addBooleanOption((o) =>
      o.setName("multiple").setDescription("Permitir votar varias opciones")
    );
  })(),

  async execute(interaction) {
    const opciones = [];
    for (let i = 1; i <= 10; i++) {
      const valor = interaction.options.getString(`opcion${i}`);
      if (valor) opciones.push(valor.slice(0, 80));
    }

    if (new Set(opciones).size !== opciones.length) {
      return responderError(interaction, "Las opciones no pueden repetirse.");
    }

    const multiple = interaction.options.getBoolean("multiple") ?? false;
    const pregunta = interaction.options.getString("pregunta");

    const resultado = encuestas.crear.run(
      interaction.channelId,
      interaction.user.id,
      pregunta,
      JSON.stringify(opciones),
      multiple ? 1 : 0,
      Date.now()
    );

    const encuesta = {
      id: resultado.lastInsertRowid,
      pregunta,
      multiple: multiple ? 1 : 0,
      cerrada: 0,
    };

    const mensaje = await interaction.reply({
      embeds: [construirEmbed(encuesta, opciones)],
      components: construirBotones(encuesta, opciones),
      fetchReply: true,
    });

    encuestas.vincularMensaje.run(mensaje.id, encuesta.id);
  },
};
