import { Events, PermissionFlagsBits } from "discord.js";
import { config } from "../config.js";
import { embedAlerta } from "../utils/embeds.js";
import { logCanal } from "../utils/logger.js";

const REGEX_INVITE = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/\S+/i;

const historialMensajes = new Map();
const VENTANA_SPAM_MS = 7000;
const LIMITE_SPAM = 5;

export default {
  name: Events.MessageCreate,
  async execute(mensaje, client) {
    if (!config.automod.activo) return;
    if (mensaje.author.bot || !mensaje.guild) return;
    if (mensaje.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    const infraccion = detectar(mensaje);
    if (!infraccion) return;

    await mensaje.delete().catch(() => null);

    const aviso = await mensaje.channel
      .send({
        content: `${mensaje.author}`,
        embeds: [embedAlerta("Mensaje eliminado", infraccion)],
      })
      .catch(() => null);

    setTimeout(() => aviso?.delete().catch(() => null), 8000);

    await logCanal(
      client,
      embedAlerta("Automod", `**Usuario:** ${mensaje.author.tag}\n**Motivo:** ${infraccion}`)
    );
  },
};

function detectar(mensaje) {
  if (config.automod.antiInvites && REGEX_INVITE.test(mensaje.content)) {
    return "No se permiten invitaciones a otros servidores.";
  }

  const menciones = mensaje.mentions.users.size + mensaje.mentions.roles.size;
  if (menciones > config.automod.maxMenciones) {
    return `Se superó el límite de ${config.automod.maxMenciones} menciones por mensaje.`;
  }

  if (esSpam(mensaje)) {
    return "Estás enviando mensajes demasiado rápido.";
  }

  return null;
}

function esSpam(mensaje) {
  const ahora = Date.now();
  const clave = `${mensaje.guildId}:${mensaje.author.id}`;
  const registros = (historialMensajes.get(clave) ?? []).filter(
    (t) => ahora - t < VENTANA_SPAM_MS
  );

  registros.push(ahora);
  historialMensajes.set(clave, registros);

  return registros.length > LIMITE_SPAM;
}
