const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, CommandInteraction } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("summary")
    .setDescription("Affiche le résumé du bot"),
  /**
   *
   * @param {CommandInteraction} interaction
   */
  execute: async (interaction) => {
    const embed = new MessageEmbed();
    embed.setTitle("Résumé du bot");
    embed.setDescription("Voici le résumé du bot");
    for (const [key, value] of Object.entries(
      interaction.client.summary.data
    )) {
      embed.addField(key[0].toUpperCase() + key.slice(1), value);
    }
    await interaction.editReply({ embeds: [embed] });
  },
};
