import { PermissionFlagsBits } from "discord.js";
import { embedExito, responderError } from "../utils/embeds.js";

export async function manejarBotonAutorol(interaction) {
  const [, rolId] = interaction.customId.split(":");
  const rol = interaction.guild.roles.cache.get(rolId);

  if (!rol) return responderError(interaction, "Ese rol ya no existe en el servidor.");

  const yo = interaction.guild.members.me;
  if (!yo.permissions.has(PermissionFlagsBits.ManageRoles) || rol.position >= yo.roles.highest.position) {
    return responderError(
      interaction,
      "No tengo permisos suficientes para asignar ese rol. Revisá que mi rol esté por encima del suyo."
    );
  }

  const tiene = interaction.member.roles.cache.has(rolId);

  if (tiene) {
    await interaction.member.roles.remove(rolId);
  } else {
    await interaction.member.roles.add(rolId);
  }

  await interaction.reply({
    embeds: [embedExito(tiene ? "Rol quitado" : "Rol asignado", `${rol}`)],
    ephemeral: true,
  });
}
