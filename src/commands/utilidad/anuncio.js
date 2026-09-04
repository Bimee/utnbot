import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { config } from "../../config.js";
import { embedExito, responderError } from "../../utils/embeds.js";

const TIPOS = {
  general: { color: config.colores.primario, icono: "📢" },
  academico: { color: config.colores.exito, icono: "📚" },
  urgente: { color: config.colores.error, icono: "🚨" },
  evento: { color: config.colores.alerta, icono: "🎉" },
};

export default {
  data: new SlashCommandBuilder()
    .setName("anuncio")
    .setDescription("Publica un anuncio con formato")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((o) => o.setName("titulo").setDescription("Título").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("mensaje")
        .setDescription("Contenido. Usá \\n para saltos de línea")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("tipo")
        .setDescription("Tipo de anuncio")
        .addChoices(...Object.keys(TIPOS).map((v) => ({ name: v, value: v })))
    )
    .addChannelOption((o) =>
      o.setName("canal").setDescription("Canal destino (por defecto, el de anuncios)")
    )
    .addRoleOption((o) => o.setName("mencionar").setDescription("Rol a mencionar"))
    .addStringOption((o) => o.setName("enlace").setDescription("URL relacionada"))
    .addStringOption((o) => o.setName("imagen").setDescription("URL de imagen")),

  async execute(interaction) {
    const tipo = TIPOS[interaction.options.getString("tipo") ?? "general"];
    const canalId = interaction.options.getChannel("canal")?.id ?? config.canales.anuncios;

    if (!canalId) {
      return responderError(
        interaction,
        "No hay canal de anuncios configurado. Indicá uno con la opción `canal`."
      );
    }

    const canal = await interaction.client.channels.fetch(canalId).catch(() => null);
    if (!canal?.isTextBased()) {
      return responderError(interaction, "El canal indicado no es un canal de texto válido.");
    }

    const embed = new EmbedBuilder()
      .setColor(tipo.color)
      .setTitle(`${tipo.icono} ${interaction.options.getString("titulo")}`)
      .setDescription(interaction.options.getString("mensaje").replace(/\\n/g, "\n"))
      .setFooter({
        text: `Publicado por ${interaction.user.displayName}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    const enlace = interaction.options.getString("enlace");
    const imagen = interaction.options.getString("imagen");
    if (enlace) embed.setURL(enlace);
    if (imagen) embed.setImage(imagen);

    const rol = interaction.options.getRole("mencionar");

    await canal.send({
      content: rol ? `${rol}` : undefined,
      embeds: [embed],
      allowedMentions: rol ? { roles: [rol.id] } : { parse: [] },
    });

    await interaction.reply({
      embeds: [embedExito("Anuncio publicado", `Enviado a ${canal}.`)],
      ephemeral: true,
    });
  },
};
