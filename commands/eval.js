const { SlashCommandBuilder } = require("@discordjs/builders");
const { CommandInteraction, MessageEmbed } = require("discord.js");
const logger = require("../logger");

const clean = async (text) => {
  // If our input is a promise, await it before continuing
  if (text && text.constructor.name == "Promise") text = await text;

  // If the response isn't a string, `util.inspect()`
  // is used to 'stringify' the code in a safe way that
  // won't error out on objects with circular references
  // (like Collections, for example)
  if (typeof text !== "string")
    text = require("util").inspect(text, { depth: 1 });

  // Replace symbols with character code alternatives
  text = text
    .replace(/`/g, "`" + String.fromCharCode(8203))
    .replace(/@/g, "@" + String.fromCharCode(8203));

  // Send off the cleaned up result
  return text;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("eval")
    .setDescription("Exécuter le code JavaScript.")
    .addStringOption((o) =>
      o
        .setName("code")
        .setDescription("Le bloc de code à exécuter.")
        .setRequired(true)
    ),
  /**
   *
   * @param {CommandInteraction} interaction
   */
  execute: async (interaction) => {
    if (interaction.user.id !== "754038841001640099") {
      await interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setTitle(
              interaction.client.cemojis.error +
                " | Vous n'êtes pas le propriétaire de ce bot."
            )
            .setColor("RED"),
        ],
      });
      return;
    }
    // Get our input arguments
    const code = interaction.options.getString("code");
    if (
      code.includes("interaction.client.token") ||
      code.includes('require("../config.json")') ||
      code.includes("require('../config.json')")
    ) {
      await interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setTitle(
              interaction.client.cemojis.error +
                " | Certains codes ont été mis sur liste noire."
            )
            .setColor("RED"),
        ],
      });
      return;
    }

    try {
      // Evaluate (execute) our input
      const evaled = eval(code);

      // Put our eval result through the function
      // we defined above
      const cleaned = await clean(evaled);

      // Reply in the channel with our result
      await interaction.editReply(
        `\`\`\`js\n${cleaned.replace(
          interaction.client.token,
          "TOK3N"
        )}\n\`\`\``
      );
    } catch (err) {
      // Reply in the channel with our error
      logger.warn(err.stack, "Eval");
      await interaction.editReply(
        `\`ERREUR\` \`\`\`xl\n${err
          .toString()
          .replace(interaction.client.token, "TOK3N")}\n\`\`\``
      );
    }
  },
};
