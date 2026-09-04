import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { config } from "../../config.js";
import { fechas } from "../../database.js";
import { embedExito, responderError } from "../../utils/embeds.js";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 86_400_000;

export default {
  data: new SlashCommandBuilder()
    .setName("fecha")
    .setDescription("Gestiona las fechas importantes del ingreso")
    .addSubcommand((sc) =>
      sc
        .setName("agregar")
        .setDescription("Agrega una fecha con recordatorios automáticos")
        .addStringOption((o) =>
          o.setName("titulo").setDescription("Ej: Examen de Matemática").setRequired(true)
        )
        .addStringOption((o) =>
          o.setName("fecha").setDescription("Formato AAAA-MM-DD").setRequired(true)
        )
        .addStringOption((o) => o.setName("descripcion").setDescription("Detalle adicional"))
        .addChannelOption((o) =>
          o.setName("canal").setDescription("Canal donde avisar (por defecto, el de fechas)")
        )
    )
    .addSubcommand((sc) => sc.setName("listar").setDescription("Lista las fechas cargadas"))
    .addSubcommand((sc) =>
      sc
        .setName("eliminar")
        .setDescription("Elimina una fecha por su ID")
        .addIntegerOption((o) => o.setName("id").setDescription("ID de la fecha").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === "agregar") return agregar(interaction);
    if (sub === "listar") return listar(interaction);
    return eliminar(interaction);
  },
};

function requierePermiso(interaction) {
  return !interaction.memberPermissions.has(PermissionFlagsBits.ManageEvents)
    ? "Necesitás el permiso de gestionar eventos para modificar las fechas."
    : null;
}

async function agregar(interaction) {
  const error = requierePermiso(interaction);
  if (error) return responderError(interaction, error);

  const fecha = interaction.options.getString("fecha");
  if (!FORMATO_FECHA.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00`))) {
    return responderError(interaction, "La fecha debe tener el formato `AAAA-MM-DD` y ser válida.");
  }

  const canalId = interaction.options.getChannel("canal")?.id ?? config.canales.fechas;
  if (!canalId) {
    return responderError(
      interaction,
      "No hay canal de fechas configurado. Indicá uno con la opción `canal`."
    );
  }

  const resultado = fechas.crear.run(
    interaction.guildId,
    interaction.options.getString("titulo"),
    interaction.options.getString("descripcion"),
    fecha,
    canalId
  );

  await interaction.reply({
    embeds: [
      embedExito(
        "Fecha registrada",
        `**ID ${resultado.lastInsertRowid}** · <t:${Math.floor(
          Date.parse(`${fecha}T00:00:00`) / 1000
        )}:D>\nSe avisará en ${`<#${canalId}>`} a 30, 14, 7, 3 y 1 día(s), y el mismo día.`
      ),
    ],
  });
}

async function listar(interaction) {
  const registros = fechas.listar.all(interaction.guildId);

  if (!registros.length) {
    return interaction.reply({
      embeds: [embedExito("Sin fechas", "Todavía no hay fechas cargadas.")],
      ephemeral: true,
    });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const lineas = registros.map((r) => {
    const objetivo = new Date(`${r.fecha}T00:00:00`);
    const dias = Math.round((objetivo - hoy) / MS_DIA);
    const estado = dias < 0 ? "pasada" : dias === 0 ? "**hoy**" : `en ${dias} día(s)`;
    return (
      `\`#${r.id}\` **${r.titulo}** — <t:${Math.floor(objetivo.getTime() / 1000)}:D> (${estado})` +
      (r.descripcion ? `\n> ${r.descripcion}` : "")
    );
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(config.colores.primario)
        .setTitle("📅 Fechas importantes")
        .setDescription(lineas.join("\n\n").slice(0, 4000)),
    ],
  });
}

async function eliminar(interaction) {
  const error = requierePermiso(interaction);
  if (error) return responderError(interaction, error);

  const { changes } = fechas.eliminar.run(
    interaction.options.getInteger("id"),
    interaction.guildId
  );

  if (!changes) return responderError(interaction, "No existe una fecha con ese ID.");

  await interaction.reply({
    embeds: [embedExito("Fecha eliminada", "El recordatorio fue dado de baja.")],
    ephemeral: true,
  });
}
