import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { listarDatosComandos } from "./handlers/loader.js";
import { log } from "./utils/logger.js";

const comandos = await listarDatosComandos();
const rest = new REST().setToken(config.token);

try {
  const resultado = await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: comandos }
  );
  log.info(`${resultado.length} comandos registrados en el servidor`);
} catch (err) {
  log.error("Fallo al registrar comandos", err);
  process.exit(1);
}
