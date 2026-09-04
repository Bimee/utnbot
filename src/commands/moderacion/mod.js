import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { config } from "../../config.js";
import { sanciones } from "../../database.js";
import { embedExito, responderError } from "../../utils/embeds.js";
import { logCanal } from "../../utils/logger.js";

const DURACIONES = {
  "60s": 60_000,
  "5m": 300_000,
  "10m": 600_000,
  "1h": 3_600_000,
  "6h": 21_600_000,
  "1d": 86_400_000,
  "7d": 604_800_000,
};

export default {
  data: new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Herramientas de moderación")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sc) =>
      sc
        .setName("advertir")
        .setDescription("Registra una advertencia a un usuario")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
        .addStringOption((o) => o.setName("motivo").setDescription("Motivo").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("historial")
        .setDescription("Muestra el historial de sanciones de un usuario")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("limpiar-historial")
        .setDescription("Borra el historial de sanciones de un usuario")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("silenciar")
        .setDescription("Aplica un timeout temporal")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("duracion")
            .setDescription("Duración del silencio")
            .setRequired(true)
            .addChoices(...Object.keys(DURACIONES).map((v) => ({ name: v, value: v })))
        )
        .addStringOption((o) => o.setName("motivo").setDescription("Motivo").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("expulsar")
        .setDescription("Expulsa a un usuario del servidor")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
        .addStringOption((o) => o.setName("motivo").setDescription("Motivo").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("banear")
        .setDescription("Banea a un usuario del servidor")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
        .addStringOption((o) => o.setName("motivo").setDescription("Motivo").setRequired(true))
        .addIntegerOption((o) =>
          o
            .setName("borrar-dias")
            .setDescription("Días de mensajes a borrar (0-7)")
            .setMinValue(0)
            .setMaxValue(7)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName("purgar")
        .setDescription("Elimina mensajes recientes del canal")
        .addIntegerOption((o) =>
          o
            .setName("cantidad")
            .setDescription("Cantidad de mensajes (1-100)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Filtrar solo mensajes de este usuario")
        )
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const manejadores = {
      advertir,
      historial,
      "limpiar-historial": limpiarHistorial,
      silenciar,
      expulsar,
      banear,
      purgar,
    };
    return manejadores[sub](interaction, client);
  },
};

async function verificarJerarquia(interaction, objetivo) {
  if (objetivo.id === interaction.user.id) return "No podés aplicar esta acción sobre vos mismo.";
  if (objetivo.id === interaction.guild.ownerId) return "No se puede sancionar al dueño del servidor.";

  const ejecutor = interaction.member;
  if (
    ejecutor.id !== interaction.guild.ownerId &&
    objetivo.roles.highest.position >= ejecutor.roles.highest.position
  ) {
    return "No podés sancionar a alguien con un rol igual o superior al tuyo.";
  }

  const yo = interaction.guild.members.me;
  if (objetivo.roles.highest.position >= yo.roles.highest.position) {
    return "Mi rol está por debajo del de ese usuario; no puedo aplicar la sanción.";
  }

  return null;
}

async function notificarPorDM(usuario, guildName, accion, motivo) {
  const embed = new EmbedBuilder()
    .setColor(config.colores.alerta)
    .setTitle(`Sanción en ${guildName}`)
    .addFields(
      { name: "Acción", value: accion, inline: true },
      { name: "Motivo", value: motivo }
    )
    .setTimestamp();

  await usuario.send({ embeds: [embed] }).catch(() => null);
}

async function registrar(interaction, client, objetivo, tipo, motivo) {
  sanciones.registrar.run(
    interaction.guildId,
    objetivo.id,
    interaction.user.id,
    tipo,
    motivo,
    Date.now()
  );

  await logCanal(
    client,
    new EmbedBuilder()
      .setColor(config.colores.alerta)
      .setTitle(`Moderación · ${tipo}`)
      .addFields(
        { name: "Usuario", value: `${objetivo.user?.tag ?? objetivo.tag} (${objetivo.id})` },
        { name: "Moderador", value: interaction.user.tag, inline: true },
        { name: "Motivo", value: motivo }
      )
      .setTimestamp()
  );
}

async function advertir(interaction, client) {
  const objetivo = interaction.options.getMember("usuario");
  const motivo = interaction.options.getString("motivo");

  if (!objetivo) return responderError(interaction, "Ese usuario no está en el servidor.");
  const error = await verificarJerarquia(interaction, objetivo);
  if (error) return responderError(interaction, error);

  await registrar(interaction, client, objetivo, "warn", motivo);
  await notificarPorDM(objetivo.user, interaction.guild.name, "Advertencia", motivo);

  const total = sanciones.contar.get(interaction.guildId, objetivo.id).total;

  await interaction.reply({
    embeds: [
      embedExito(
        "Advertencia registrada",
        `${objetivo} — **${total}** advertencia(s) acumulada(s).\n**Motivo:** ${motivo}`
      ),
    ],
  });
}

async function historial(interaction) {
  const usuario = interaction.options.getUser("usuario");
  const registros = sanciones.historial.all(interaction.guildId, usuario.id);

  if (!registros.length) {
    return interaction.reply({
      embeds: [embedExito("Sin sanciones", `${usuario} no tiene sanciones registradas.`)],
      ephemeral: true,
    });
  }

  const lineas = registros.map(
    (r) =>
      `**${r.tipo.toUpperCase()}** · <t:${Math.floor(r.creado_en / 1000)}:d>\n` +
      `Moderador: <@${r.moderador_id}>\nMotivo: ${r.motivo}`
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(config.colores.neutro)
        .setTitle(`Historial de ${usuario.tag}`)
        .setDescription(lineas.join("\n\n").slice(0, 4000))
        .setFooter({ text: `${registros.length} registro(s)` }),
    ],
    ephemeral: true,
  });
}

async function limpiarHistorial(interaction) {
  const usuario = interaction.options.getUser("usuario");
  const { changes } = sanciones.limpiar.run(interaction.guildId, usuario.id);

  await interaction.reply({
    embeds: [embedExito("Historial limpiado", `Se eliminaron ${changes} registro(s) de ${usuario}.`)],
    ephemeral: true,
  });
}

async function silenciar(interaction, client) {
  const objetivo = interaction.options.getMember("usuario");
  const duracion = interaction.options.getString("duracion");
  const motivo = interaction.options.getString("motivo");

  if (!objetivo) return responderError(interaction, "Ese usuario no está en el servidor.");
  const error = await verificarJerarquia(interaction, objetivo);
  if (error) return responderError(interaction, error);

  await objetivo.timeout(DURACIONES[duracion], motivo);
  await registrar(interaction, client, objetivo, `timeout ${duracion}`, motivo);
  await notificarPorDM(objetivo.user, interaction.guild.name, `Silencio de ${duracion}`, motivo);

  await interaction.reply({
    embeds: [embedExito("Usuario silenciado", `${objetivo} por **${duracion}**.\n**Motivo:** ${motivo}`)],
  });
}

async function expulsar(interaction, client) {
  const objetivo = interaction.options.getMember("usuario");
  const motivo = interaction.options.getString("motivo");

  if (!objetivo) return responderError(interaction, "Ese usuario no está en el servidor.");
  const error = await verificarJerarquia(interaction, objetivo);
  if (error) return responderError(interaction, error);

  await notificarPorDM(objetivo.user, interaction.guild.name, "Expulsión", motivo);
  await registrar(interaction, client, objetivo, "kick", motivo);
  await objetivo.kick(motivo);

  await interaction.reply({
    embeds: [embedExito("Usuario expulsado", `${objetivo.user.tag}\n**Motivo:** ${motivo}`)],
  });
}

async function banear(interaction, client) {
  const usuario = interaction.options.getUser("usuario");
  const motivo = interaction.options.getString("motivo");
  const dias = interaction.options.getInteger("borrar-dias") ?? 0;
  const objetivo = interaction.options.getMember("usuario");

  if (objetivo) {
    const error = await verificarJerarquia(interaction, objetivo);
    if (error) return responderError(interaction, error);
    await notificarPorDM(usuario, interaction.guild.name, "Baneo", motivo);
  }

  await interaction.guild.members.ban(usuario.id, {
    reason: motivo,
    deleteMessageSeconds: dias * 86_400,
  });
  await registrar(interaction, client, usuario, "ban", motivo);

  await interaction.reply({
    embeds: [embedExito("Usuario baneado", `${usuario.tag}\n**Motivo:** ${motivo}`)],
  });
}

async function purgar(interaction) {
  const cantidad = interaction.options.getInteger("cantidad");
  const usuario = interaction.options.getUser("usuario");

  await interaction.deferReply({ ephemeral: true });

  const mensajes = await interaction.channel.messages.fetch({ limit: 100 });
  const filtrados = [...mensajes.values()]
    .filter((m) => !usuario || m.author.id === usuario.id)
    .filter((m) => Date.now() - m.createdTimestamp < 1_209_600_000) // Discord no permite borrar en lote mensajes de más de 14 días
    .slice(0, cantidad);

  if (!filtrados.length) {
    return interaction.editReply({
      embeds: [embedExito("Sin resultados", "No hay mensajes que cumplan el filtro.")],
    });
  }

  const borrados = await interaction.channel.bulkDelete(filtrados, true);

  await interaction.editReply({
    embeds: [embedExito("Mensajes eliminados", `Se borraron **${borrados.size}** mensaje(s).`)],
  });
}
