import { Events, EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { log } from "../utils/logger.js";

export default {
  name: Events.GuildMemberAdd,
  async execute(miembro) {
    if (config.roles.miembro) {
      await miembro.roles.add(config.roles.miembro).catch((err) =>
        log.error(`No se pudo asignar el rol de miembro a ${miembro.user.tag}`, err)
      );
    }

    if (!config.canales.bienvenida) return;

    const canal = await miembro.client.channels
      .fetch(config.canales.bienvenida)
      .catch(() => null);
    if (!canal?.isTextBased()) return;

    const referencia = (id, texto) => (id ? `<#${id}>` : `**${texto}**`);

    const embed = new EmbedBuilder()
      .setColor(config.colores.primario)
      .setTitle("¡Bienvenido/a a UTN Sistemas — Ingresantes 2027!")
      .setDescription(
        `Hola ${miembro}, te sumaste al servidor de estudio del ingreso a ` +
          `Ingeniería en Sistemas de Información (UTN FRC).\n\n` +
          `Este espacio es para preparar el seminario de ingreso entre todos: ` +
          `Matemática, Física e Introducción a la Universidad.`
      )
      .addFields(
        {
          name: "Primeros pasos",
          value:
            `• Leé ${referencia(config.canales.reglas, "reglas")}\n` +
            `• Presentate en ${referencia(config.canales.presentaciones, "presentaciones")}\n` +
            `• Elegí tus roles con el panel de autoroles\n` +
            `• Mirá ${referencia(config.canales.fechas, "fechas-importantes")}`,
        },
        {
          name: "Salas de estudio",
          value:
            "Entrá al canal de voz **Únete para crear** y se genera automáticamente " +
            "tu propia sala. Podés usar `/sala` para configurarla.",
        }
      )
      .setThumbnail(miembro.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `Miembro n.º ${miembro.guild.memberCount}` })
      .setTimestamp();

    await canal.send({ content: `${miembro}`, embeds: [embed] }).catch(() => null);
  },
};
