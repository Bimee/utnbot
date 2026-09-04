import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { encuestas, votos } from "../database.js";
import { responderError } from "../utils/embeds.js";

const EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
const LARGO_BARRA = 12;

export function construirEmbed(encuesta, opciones) {
  const conteos = new Map(votos.conteo.all(encuesta.id).map((r) => [r.opcion, r.total]));
  const totalVotos = [...conteos.values()].reduce((a, b) => a + b, 0);
  const votantes = votos.totalVotantes.get(encuesta.id)?.total ?? 0;

  const lineas = opciones.map((texto, i) => {
    const cantidad = conteos.get(i) ?? 0;
    const porcentaje = totalVotos ? Math.round((cantidad / totalVotos) * 100) : 0;
    const llenos = Math.round((porcentaje / 100) * LARGO_BARRA);
    const barra = "█".repeat(llenos) + "░".repeat(LARGO_BARRA - llenos);
    return `${EMOJIS[i]} **${texto}**\n\`${barra}\` ${porcentaje}% · ${cantidad} voto(s)`;
  });

  return new EmbedBuilder()
    .setColor(encuesta.cerrada ? config.colores.neutro : config.colores.primario)
    .setTitle(`📊 ${encuesta.pregunta}`)
    .setDescription(lineas.join("\n\n"))
    .setFooter({
      text: [
        `${votantes} participante(s)`,
        encuesta.multiple ? "Selección múltiple" : "Una opción",
        encuesta.cerrada ? "CERRADA" : "Abierta",
      ].join(" · "),
    })
    .setTimestamp();
}

export function construirBotones(encuesta, opciones) {
  const filas = [];
  for (let i = 0; i < opciones.length; i += 5) {
    const fila = new ActionRowBuilder().addComponents(
      opciones.slice(i, i + 5).map((_, j) =>
        new ButtonBuilder()
          .setCustomId(`voto:${encuesta.id}:${i + j}`)
          .setEmoji(EMOJIS[i + j])
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(Boolean(encuesta.cerrada))
      )
    );
    filas.push(fila);
  }

  filas.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cerrarEncuesta:${encuesta.id}`)
        .setLabel(encuesta.cerrada ? "Encuesta cerrada" : "Cerrar encuesta")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(Boolean(encuesta.cerrada))
    )
  );

  return filas;
}

export async function manejarVoto(interaction) {
  const [, encuestaId, opcion] = interaction.customId.split(":");
  const encuesta = encuestas.porMensaje.get(interaction.message.id);

  if (!encuesta) return responderError(interaction, "Esta encuesta ya no está disponible.");
  if (encuesta.cerrada) return responderError(interaction, "Esta encuesta está cerrada.");

  const indice = Number(opcion);
  const yaVoto = votos.existe.get(encuesta.id, interaction.user.id, indice);

  if (yaVoto) {
    votos.quitar.run(encuesta.id, interaction.user.id, indice);
  } else {
    if (!encuesta.multiple) votos.limpiarUsuario.run(encuesta.id, interaction.user.id);
    votos.registrar.run(encuesta.id, interaction.user.id, indice);
  }

  const opciones = JSON.parse(encuesta.opciones);
  await interaction.update({
    embeds: [construirEmbed(encuesta, opciones)],
    components: construirBotones(encuesta, opciones),
  });
}

export async function manejarCierreEncuesta(interaction) {
  const encuesta = encuestas.porMensaje.get(interaction.message.id);
  if (!encuesta) return responderError(interaction, "Esta encuesta ya no está disponible.");

  const esAutor = interaction.user.id === encuesta.autor_id;
  const esModerador = config.roles.moderador
    ? interaction.member.roles.cache.has(config.roles.moderador)
    : interaction.memberPermissions.has("ManageMessages");

  if (!esAutor && !esModerador) {
    return responderError(interaction, "Solo quien creó la encuesta o un moderador puede cerrarla.");
  }

  encuestas.cerrar.run(encuesta.id);
  const cerrada = { ...encuesta, cerrada: 1 };
  const opciones = JSON.parse(encuesta.opciones);

  await interaction.update({
    embeds: [construirEmbed(cerrada, opciones)],
    components: construirBotones(cerrada, opciones),
  });
}
