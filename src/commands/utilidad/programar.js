import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { config } from "../../config.js";
import { mensajesProgramados } from "../../database.js";
import { programar, cancelar, enviar, TIPOS } from "../../services/mensajesProgramados.js";
import { embedExito, responderError } from "../../utils/embeds.js";

const FORMATO_HORA = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const DIAS = [
  { name: "Lunes", value: "1" },
  { name: "Martes", value: "2" },
  { name: "Miércoles", value: "3" },
  { name: "Jueves", value: "4" },
  { name: "Viernes", value: "5" },
  { name: "Sábado", value: "6" },
  { name: "Domingo", value: "0" },
];
const NOMBRE_DIA = Object.fromEntries(DIAS.map((d) => [d.value, d.name]));

// Traduce las opciones amigables a una expresión cron y su descripción legible.
// Devuelve { cron, descripcion } o { error } si falta o sobra algún dato.
function construirProgramacion(opts) {
  const { frecuencia, hora, dia, cadaHoras } = opts;

  if (frecuencia !== "cada-horas") {
    if (!hora) return { error: "Indicá la `hora` en formato `HH:MM` (ej: `09:00`)." };
    if (!FORMATO_HORA.test(hora)) return { error: "La `hora` debe tener el formato `HH:MM` (24 h)." };
  }

  const [h, m] = (hora ?? "0:0").split(":").map(Number);

  switch (frecuencia) {
    case "diaria":
      return { cron: `${m} ${h} * * *`, descripcion: `Todos los días a las ${hora}` };
    case "dias-habiles":
      return { cron: `${m} ${h} * * 1-5`, descripcion: `De lunes a viernes a las ${hora}` };
    case "semanal":
      if (!dia) return { error: "Elegí el `dia` de la semana para la frecuencia semanal." };
      return { cron: `${m} ${h} * * ${dia}`, descripcion: `Cada ${NOMBRE_DIA[dia]} a las ${hora}` };
    case "cada-horas":
      if (!cadaHoras || cadaHoras < 1 || cadaHoras > 23) {
        return { error: "Para `cada-horas` indicá un intervalo entre 1 y 23 en `cada-horas`." };
      }
      return { cron: `0 */${cadaHoras} * * *`, descripcion: `Cada ${cadaHoras} h` };
    default:
      return { error: "Frecuencia no reconocida." };
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName("programar")
    .setDescription("Mensajes recurrentes automáticos a un canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sc) =>
      sc
        .setName("crear")
        .setDescription("Programa un mensaje recurrente")
        .addStringOption((o) =>
          o
            .setName("frecuencia")
            .setDescription("Cada cuánto se envía")
            .setRequired(true)
            .addChoices(
              { name: "Diaria", value: "diaria" },
              { name: "Días hábiles (lun-vie)", value: "dias-habiles" },
              { name: "Semanal", value: "semanal" },
              { name: "Cada N horas", value: "cada-horas" }
            )
        )
        .addStringOption((o) =>
          o
            .setName("mensaje")
            .setDescription("Contenido. Usá \\n para saltos de línea")
            .setRequired(true)
        )
        .addStringOption((o) => o.setName("titulo").setDescription("Título opcional del embed"))
        .addStringOption((o) =>
          o.setName("hora").setDescription("Hora HH:MM (24 h). Requerido salvo 'Cada N horas'")
        )
        .addStringOption((o) =>
          o
            .setName("dia")
            .setDescription("Día de la semana (solo frecuencia semanal)")
            .addChoices(...DIAS)
        )
        .addIntegerOption((o) =>
          o
            .setName("cada-horas")
            .setDescription("Intervalo en horas 1-23 (solo 'Cada N horas')")
            .setMinValue(1)
            .setMaxValue(23)
        )
        .addStringOption((o) =>
          o
            .setName("tipo")
            .setDescription("Estilo del embed")
            .addChoices(...Object.keys(TIPOS).map((v) => ({ name: v, value: v })))
        )
        .addChannelOption((o) =>
          o.setName("canal").setDescription("Canal destino (por defecto, el de anuncios)")
        )
    )
    .addSubcommand((sc) =>
      sc.setName("listar").setDescription("Lista los mensajes programados")
    )
    .addSubcommand((sc) =>
      sc
        .setName("eliminar")
        .setDescription("Elimina un mensaje programado por su ID")
        .addIntegerOption((o) => o.setName("id").setDescription("ID del mensaje").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("pausar")
        .setDescription("Pausa un mensaje sin borrarlo")
        .addIntegerOption((o) => o.setName("id").setDescription("ID del mensaje").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("reanudar")
        .setDescription("Reactiva un mensaje pausado")
        .addIntegerOption((o) => o.setName("id").setDescription("ID del mensaje").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("probar")
        .setDescription("Envía ahora un mensaje programado, para previsualizarlo")
        .addIntegerOption((o) => o.setName("id").setDescription("ID del mensaje").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === "crear") return crear(interaction);
    if (sub === "listar") return listar(interaction);
    if (sub === "eliminar") return eliminar(interaction);
    if (sub === "pausar" || sub === "reanudar") return alternarEstado(interaction, sub);
    return probar(interaction);
  },
};

async function crear(interaction) {
  const canalId = interaction.options.getChannel("canal")?.id ?? config.canales.anuncios;
  if (!canalId) {
    return responderError(
      interaction,
      "No hay canal configurado. Indicá uno con la opción `canal`."
    );
  }

  const canal = await interaction.client.channels.fetch(canalId).catch(() => null);
  if (!canal?.isTextBased()) {
    return responderError(interaction, "El canal indicado no es un canal de texto válido.");
  }

  const { cron, descripcion, error } = construirProgramacion({
    frecuencia: interaction.options.getString("frecuencia"),
    hora: interaction.options.getString("hora"),
    dia: interaction.options.getString("dia"),
    cadaHoras: interaction.options.getInteger("cada-horas"),
  });
  if (error) return responderError(interaction, error);

  const titulo = interaction.options.getString("titulo");
  const contenido = interaction.options.getString("mensaje");
  const tipo = interaction.options.getString("tipo") ?? "general";

  const { lastInsertRowid } = mensajesProgramados.crear.run(
    interaction.guildId,
    canalId,
    titulo,
    contenido,
    tipo,
    cron,
    descripcion,
    interaction.user.id,
    Date.now()
  );

  const registro = mensajesProgramados.obtener.get(Number(lastInsertRowid), interaction.guildId);
  programar(interaction.client, registro);

  await interaction.reply({
    embeds: [
      embedExito(
        "Mensaje programado",
        `**ID ${lastInsertRowid}** · ${descripcion}\nDestino: <#${canalId}>\nHorario: Córdoba (ART). Probalo con \`/programar probar id:${lastInsertRowid}\`.`
      ),
    ],
    ephemeral: true,
  });
}

async function listar(interaction) {
  const registros = mensajesProgramados.listar.all(interaction.guildId);
  if (!registros.length) {
    return interaction.reply({
      embeds: [embedExito("Sin mensajes", "Todavía no hay mensajes programados.")],
      ephemeral: true,
    });
  }

  const lineas = registros.map((r) => {
    const estado = r.activo ? "🟢 activo" : "⏸️ pausado";
    const ultimo = r.ultimo_envio ? ` · último: <t:${Math.floor(r.ultimo_envio / 1000)}:R>` : "";
    const encabezado = r.titulo ? `**${r.titulo}**` : "_(sin título)_";
    return (
      `\`#${r.id}\` ${encabezado} — ${estado}\n` +
      `> ${r.descripcion} · <#${r.canal_id}>${ultimo}`
    );
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(config.colores.primario)
        .setTitle("🗓️ Mensajes programados")
        .setDescription(lineas.join("\n\n").slice(0, 4000)),
    ],
    ephemeral: true,
  });
}

async function eliminar(interaction) {
  const id = interaction.options.getInteger("id");
  const { changes } = mensajesProgramados.eliminar.run(id, interaction.guildId);
  if (!changes) return responderError(interaction, "No existe un mensaje programado con ese ID.");

  cancelar(id);
  await interaction.reply({
    embeds: [embedExito("Eliminado", "El mensaje programado fue dado de baja.")],
    ephemeral: true,
  });
}

async function alternarEstado(interaction, accion) {
  const id = interaction.options.getInteger("id");
  const registro = mensajesProgramados.obtener.get(id, interaction.guildId);
  if (!registro) return responderError(interaction, "No existe un mensaje programado con ese ID.");

  const activar = accion === "reanudar";
  mensajesProgramados.cambiarEstado.run(activar ? 1 : 0, id, interaction.guildId);

  if (activar) {
    programar(interaction.client, { ...registro, activo: 1 });
    return interaction.reply({
      embeds: [embedExito("Reanudado", `El mensaje \`#${id}\` volvió a estar activo.`)],
      ephemeral: true,
    });
  }

  cancelar(id);
  await interaction.reply({
    embeds: [embedExito("Pausado", `El mensaje \`#${id}\` no se enviará hasta reanudarlo.`)],
    ephemeral: true,
  });
}

async function probar(interaction) {
  const registro = mensajesProgramados.obtener.get(
    interaction.options.getInteger("id"),
    interaction.guildId
  );
  if (!registro) return responderError(interaction, "No existe un mensaje programado con ese ID.");

  await enviar(interaction.client, registro);
  await interaction.reply({
    embeds: [embedExito("Enviado", `Se envió el mensaje \`#${registro.id}\` a <#${registro.canal_id}>.`)],
    ephemeral: true,
  });
}
