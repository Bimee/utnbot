import "dotenv/config";

const required = ["DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID"];
const faltantes = required.filter((k) => !process.env[k]);

if (faltantes.length) {
  console.error(`Faltan variables de entorno obligatorias: ${faltantes.join(", ")}`);
  process.exit(1);
}

const lista = (valor) =>
  (valor ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  canales: {
    bienvenida: process.env.CHANNEL_BIENVENIDA,
    anuncios: process.env.CHANNEL_ANUNCIOS,
    fechas: process.env.CHANNEL_FECHAS,
    logs: process.env.CHANNEL_LOGS,
    reglas: process.env.CHANNEL_REGLAS,
    presentaciones: process.env.CHANNEL_PRESENTACIONES,
  },

  voz: {
    hubId: process.env.VOICE_HUB_ID,
    categoriaId: process.env.VOICE_CATEGORY_ID,
  },

  privadas: {
    categoriaId: process.env.PRIVATE_CATEGORY_ID,
  },

  roles: {
    miembro: process.env.ROLE_MIEMBRO,
    moderador: process.env.ROLE_MODERADOR,
  },

  feeds: {
    urls: lista(process.env.FEED_URLS),
    canal: process.env.FEED_CHANNEL,
    intervaloMin: Number(process.env.FEED_INTERVAL ?? 15),
  },

  automod: {
    activo: process.env.AUTOMOD_ENABLED !== "false",
    maxMenciones: Number(process.env.AUTOMOD_MAX_MENCIONES ?? 5),
    antiInvites: process.env.AUTOMOD_ANTI_INVITES !== "false",
  },

  colores: {
    primario: 0x0d6efd,
    exito: 0x2ecc71,
    alerta: 0xf1c40f,
    error: 0xe74c3c,
    neutro: 0x2b2d31,
  },
};
