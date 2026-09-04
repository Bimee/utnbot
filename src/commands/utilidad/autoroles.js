import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { config } from "../../config.js";
import { embedExito, responderError } from "../../utils/embeds.js";

const ESTILOS = {
  azul: ButtonStyle.Primary,
  gris: ButtonStyle.Secondary,
  verde: ButtonStyle.Success,
  rojo: ButtonStyle.Danger,
};

export default {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName("autoroles")
      .setDescription("Publica un panel de roles autoasignables")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addStringOption((o) => o.setName("titulo").setDescription("Título del panel").setRequired(true))
      .addStringOption((o) =>
        o.setName("descripcion").setDescription("Texto explicativo").setRequired(true)
      )
      .addRoleOption((o) => o.setName("rol1").setDescription("Primer rol").setRequired(true));

    for (let i = 2; i <= 10; i++) {
      builder.addRoleOption((o) => o.setName(`rol${i}`).setDescription(`Rol ${i}`));
    }

    return builder
      .addStringOption((o) =>
        o
          .setName("estilo")
          .setDescription("Color de los botones")
          .addChoices(...Object.keys(ESTILOS).map((v) => ({ name: v, value: v })))
      )
      .addChannelOption((o) => o.setName("canal").setDescription("Canal donde publicar"));
  })(),

  async execute(interaction) {
    const roles = [];
    for (let i = 1; i <= 10; i++) {
      const rol = interaction.options.getRole(`rol${i}`);
      if (rol) roles.push(rol);
    }

    const yo = interaction.guild.members.me;
    const inaccesibles = roles.filter((r) => r.position >= yo.roles.highest.position);

    if (inaccesibles.length) {
      return responderError(
        interaction,
        `No puedo asignar estos roles porque están por encima del mío: ${inaccesibles.join(", ")}.\n` +
          "Moveme por encima de ellos en la lista de roles del servidor."
      );
    }

    const estilo = ESTILOS[interaction.options.getString("estilo") ?? "gris"];
    const canal = interaction.options.getChannel("canal") ?? interaction.channel;

    const embed = new EmbedBuilder()
      .setColor(config.colores.primario)
      .setTitle(interaction.options.getString("titulo"))
      .setDescription(
        `${interaction.options.getString("descripcion").replace(/\\n/g, "\n")}\n\n` +
          "Tocá un botón para asignarte o quitarte el rol."
      );

    const filas = [];
    for (let i = 0; i < roles.length; i += 5) {
      filas.push(
        new ActionRowBuilder().addComponents(
          roles.slice(i, i + 5).map((rol) =>
            new ButtonBuilder()
              .setCustomId(`autorol:${rol.id}`)
              .setLabel(rol.name.slice(0, 80))
              .setStyle(estilo)
          )
        )
      );
    }

    await canal.send({ embeds: [embed], components: filas });

    await interaction.reply({
      embeds: [embedExito("Panel publicado", `Se creó el panel en ${canal}.`)],
      ephemeral: true,
    });
  },
};
