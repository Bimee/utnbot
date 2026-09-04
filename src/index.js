import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config.js";
import { cargarComandos, cargarEventos } from "./handlers/loader.js";
import { log } from "./utils/logger.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
});

client.commands = new Collection();

await cargarComandos(client);
await cargarEventos(client);

process.on("unhandledRejection", (err) => log.error("Promesa no manejada", err));
process.on("uncaughtException", (err) => log.error("Excepción no capturada", err));

await client.login(config.token);
