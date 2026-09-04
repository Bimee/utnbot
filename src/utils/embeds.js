import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";

const base = (color) => new EmbedBuilder().setColor(color).setTimestamp();

export const embedExito = (titulo, descripcion) =>
  base(config.colores.exito).setTitle(`✅ ${titulo}`).setDescription(descripcion ?? null);

export const embedError = (descripcion) =>
  base(config.colores.error).setTitle("❌ Error").setDescription(descripcion);

export const embedAlerta = (titulo, descripcion) =>
  base(config.colores.alerta).setTitle(`⚠️ ${titulo}`).setDescription(descripcion ?? null);

export const embedInfo = (titulo, descripcion) =>
  base(config.colores.primario).setTitle(titulo).setDescription(descripcion ?? null);

export const embedNeutro = () => base(config.colores.neutro);

export const responderError = (interaction, mensaje) => {
  const payload = { embeds: [embedError(mensaje)], ephemeral: true };
  return interaction.replied || interaction.deferred
    ? interaction.followUp(payload)
    : interaction.reply(payload);
};
