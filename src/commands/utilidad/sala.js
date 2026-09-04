import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import { config } from "../../config.js";
import { canalesTemporales } from "../../database.js";
import { embedExito, responderError } from "../../utils/embeds.js";

const LIMITE_POR_USUARIO = 1;

export default {
  data: new SlashCommandBuilder()
    .setName("sala")
    .setDescription("Gestiona salas de estudio")
    .addSubcommand((sc) =>
      sc
        .setName("privada")
        .setDescription("Crea un canal de texto privado de estudio")
        .addStringOption((o) => o.setName("nombre").setDescription("Nombre de la sala").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("invitar")
        .setDescription("Da acceso a alguien a tu sala privada")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("expulsar")
        .setDescription("Quita el acceso de alguien a tu sala privada")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    )
    .addSubcommand((sc) => sc.setName("cerrar").setDescription("Elimina tu sala privada"))
    .addSubcommand((sc) =>
      sc
        .setName("renombrar")
        .setDescription("Cambia el nombre de tu sala de voz temporal")
        .addStringOption((o) => o.setName("nombre").setDescription("Nuevo nombre").setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName("limite")
        .setDescription("Fija el máximo de personas en tu sala de voz temporal")
        .addIntegerOption((o) =>
          o
            .setName("cantidad")
            .setDescription("0 = sin límite")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(99)
        )
    ),

  async execute(interaction) {
    const manejadores = {
      privada: crearPrivada,
      invitar: invitar,
      expulsar: expulsar,
      cerrar: cerrar,
      renombrar: renombrar,
      limite: limite,
    };
    return manejadores[interaction.options.getSubcommand()](interaction);
  },
};

function salaPrivadaDe(interaction) {
  const registro = canalesTemporales.porDueno.get(interaction.user.id, "texto");
  if (!registro) return null;
  return interaction.guild.channels.cache.get(registro.canal_id) ?? null;
}

function salaVozDe(interaction) {
  const canal = interaction.member.voice?.channel;
  if (!canal) return { error: "Tenés que estar conectado a tu sala de voz." };

  const registro = canalesTemporales.obtener.get(canal.id);
  if (!registro || registro.tipo !== "voz") {
    return { error: "Este comando solo funciona en salas de voz temporales." };
  }
  if (registro.dueno_id !== interaction.user.id) {
    return { error: "Solo el dueño de la sala puede modificarla." };
  }

  return { canal };
}

async function crearPrivada(interaction) {
  if (!config.privadas.categoriaId) {
    return responderError(interaction, "No hay categoría configurada para salas privadas.");
  }

  const existente = canalesTemporales.porDueno.get(interaction.user.id, "texto");
  if (existente && interaction.guild.channels.cache.has(existente.canal_id)) {
    return responderError(
      interaction,
      `Ya tenés una sala privada abierta (<#${existente.canal_id}>). Cerrala con \`/sala cerrar\`.`
    );
  }
  if (existente) canalesTemporales.eliminar.run(existente.canal_id);

  const nombre = interaction.options
    .getString("nombre")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 90);

  if (!nombre) return responderError(interaction, "El nombre no contiene caracteres válidos.");

  const canal = await interaction.guild.channels.create({
    name: `📕-${nombre}`,
    type: ChannelType.GuildText,
    parent: config.privadas.categoriaId,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ],
  });

  canalesTemporales.crear.run(canal.id, interaction.user.id, "texto", Date.now());

  await canal.send({
    embeds: [
      embedExito(
        "Sala privada creada",
        `${interaction.user}, esta sala es tuya.\n\n` +
          "`/sala invitar` — agregar gente\n" +
          "`/sala expulsar` — quitar acceso\n" +
          "`/sala cerrar` — eliminarla"
      ),
    ],
  });

  await interaction.reply({
    embeds: [embedExito("Listo", `Tu sala privada es ${canal}.`)],
    ephemeral: true,
  });
}

async function invitar(interaction) {
  const canal = salaPrivadaDe(interaction);
  if (!canal) return responderError(interaction, "No tenés ninguna sala privada abierta.");

  const usuario = interaction.options.getUser("usuario");
  await canal.permissionOverwrites.edit(usuario.id, {
    ViewChannel: true,
    SendMessages: true,
  });

  await canal.send({ content: `${usuario} fue agregado a la sala.` });
  await interaction.reply({
    embeds: [embedExito("Acceso otorgado", `${usuario} ya puede ver ${canal}.`)],
    ephemeral: true,
  });
}

async function expulsar(interaction) {
  const canal = salaPrivadaDe(interaction);
  if (!canal) return responderError(interaction, "No tenés ninguna sala privada abierta.");

  const usuario = interaction.options.getUser("usuario");
  if (usuario.id === interaction.user.id) {
    return responderError(interaction, "No podés quitarte el acceso a tu propia sala.");
  }

  await canal.permissionOverwrites.delete(usuario.id);
  await interaction.reply({
    embeds: [embedExito("Acceso retirado", `${usuario} ya no tiene acceso a ${canal}.`)],
    ephemeral: true,
  });
}

async function cerrar(interaction) {
  const canal = salaPrivadaDe(interaction);
  if (!canal) return responderError(interaction, "No tenés ninguna sala privada abierta.");

  canalesTemporales.eliminar.run(canal.id);
  await interaction.reply({
    embeds: [embedExito("Sala cerrada", "El canal se eliminará en unos segundos.")],
    ephemeral: true,
  });
  setTimeout(() => canal.delete().catch(() => null), 3000);
}

async function renombrar(interaction) {
  const { canal, error } = salaVozDe(interaction);
  if (error) return responderError(interaction, error);

  const nombre = interaction.options.getString("nombre").slice(0, 90);
  await canal.setName(`🔊 ${nombre}`);

  await interaction.reply({
    embeds: [embedExito("Sala renombrada", `Ahora se llama **${nombre}**.`)],
    ephemeral: true,
  });
}

async function limite(interaction) {
  const { canal, error } = salaVozDe(interaction);
  if (error) return responderError(interaction, error);

  const cantidad = interaction.options.getInteger("cantidad");
  await canal.setUserLimit(cantidad);

  await interaction.reply({
    embeds: [
      embedExito(
        "Límite actualizado",
        cantidad === 0 ? "La sala no tiene límite de personas." : `Máximo: **${cantidad}** persona(s).`
      ),
    ],
    ephemeral: true,
  });
}
