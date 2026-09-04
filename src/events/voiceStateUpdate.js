import { Events, ChannelType, PermissionFlagsBits } from "discord.js";
import { config } from "../config.js";
import { canalesTemporales } from "../database.js";
import { log } from "../utils/logger.js";

export default {
  name: Events.VoiceStateUpdate,
  async execute(anterior, actual) {
    const miembro = actual.member ?? anterior.member;

    if (actual.channelId && actual.channelId === config.voz.hubId) {
      await crearSala(miembro, actual);
    }

    // El borrado se evalúa sobre el canal que se dejó, no sobre el nuevo:
    // moverse entre dos salas temporales dispara ambos caminos en el mismo evento.
    if (anterior.channelId && anterior.channelId !== actual.channelId) {
      await limpiarSala(anterior);
    }
  },
};

async function crearSala(miembro, estado) {
  const existente = canalesTemporales.porDueno.get(miembro.id, "voz");
  if (existente) {
    const canal = await miembro.guild.channels.fetch(existente.canal_id).catch(() => null);
    if (canal) return miembro.voice.setChannel(canal).catch(() => null);
    canalesTemporales.eliminar.run(existente.canal_id);
  }

  try {
    const canal = await miembro.guild.channels.create({
      name: `🔊 Sala de ${miembro.displayName}`,
      type: ChannelType.GuildVoice,
      parent: config.voz.categoriaId ?? estado.channel.parentId,
      permissionOverwrites: [
        {
          id: miembro.id,
          allow: [
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.Connect,
          ],
        },
      ],
    });

    canalesTemporales.crear.run(canal.id, miembro.id, "voz", Date.now());
    await miembro.voice.setChannel(canal);
  } catch (err) {
    log.error(`No se pudo crear la sala temporal de ${miembro.user.tag}`, err);
  }
}

async function limpiarSala(estado) {
  const registro = canalesTemporales.obtener.get(estado.channelId);
  if (!registro || registro.tipo !== "voz") return;

  const canal = estado.channel;
  if (!canal || canal.members.size > 0) return;

  await canal.delete().catch(() => null);
  canalesTemporales.eliminar.run(registro.canal_id);
}
