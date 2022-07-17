const { Client, CommandInteraction, MessageEmbed } = require("discord.js");
const logger = require("../logger.js");

module.exports = {
  name: "interactionCreate",
  /**
   *
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  execute: async (client, interaction) => {
    if (!interaction.isCommand()) return;
    await interaction.reply({
      embeds: [
        new MessageEmbed()
          .setTitle(interaction.client.cemojis.loading + " | Chargement...")
          .setColor("RED"),
      ],
    });
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      await interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setTitle(
              interaction.client.cemojis.error + " | Commande introuvable."
            )
            .setColor("RED"),
        ],
      });
      return;
    }
    if (client.devmode && interaction.user.id != "754038841001640099") {
      await interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setTitle(
              interaction.client.cemojis.error +
                " | Le bot est en mode développement."
            )
            .setColor("RED"),
        ],
      });
      logger.debug(
        `${interaction.user.tag} tried to use command ${command.data.name} in development mode.`
      );
      return;
    }

    try {
      logger.info(
        `Command executed ${command.data.name} by @${interaction.user.tag} in #${interaction.channel.name} -->`,
        "Commands"
      );
      await command.execute(interaction);
    } catch (e) {
      console.error(e);
    }
  },
};
