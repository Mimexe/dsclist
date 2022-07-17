const { SlashCommandBuilder } = require("@discordjs/builders");
const { CommandInteraction, MessageEmbed, Collection } = require("discord.js");
const logger = require("../logger");
const moment = require("moment");
const ms = require("ms");
const cooldown = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bump")
    .setDescription("Mettre en avant votre serveur.")
    .setDMPermission(false),
  /**
   *
   * @param {CommandInteraction} interaction
   */
  execute: async (interaction) => {
    const guild = interaction.guild;
    /**
     * @type {import("mysql").Connection}
     */
    const database = interaction.client.database;

    if (cooldown.has(guild.id)) {
      return await interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setTitle("Erreur.")
            .setColor("RED")
            .setDescription(
              "`Vous devez attendre 1 heure entre chaque mise en avant.`"
            )
            .setFooter({
              text: "Utiliser la commande /notifications enable pour avoir une notification.",
            }),
        ],
      });
    }

    const result = await new Promise((resolve, reject) => {
      database.query(
        "UPDATE servers SET `bump_date` = '" +
          moment().format("YYYY-MM-DD HH:mm:ss") +
          "' WHERE `id`=" +
          guild.id,
        (err, result) => {
          if (err) reject(err);
          resolve(result);
        }
      );
    });
    if (result.affectedRows === 0) {
      await interaction.editReply({
        embeds: [new MessageEmbed().setTitle("Erreur").setColor("RED")],
      });
      return;
    }
    await interaction.editReply({
      embeds: [
        new MessageEmbed()
          .setTitle("Succès")
          .setColor("GREEN")
          .setDescription(
            "Le serveur a été correctement mis en avant.\nCliquer [ici](https://www.dsclist.ga/servers) pour voir votre serveur."
          ),
      ],
    });
    const resulta = await new Promise((resolve, reject) => {
      database.query(
        "SELECT * FROM bump_notifications WHERE `server_id`='" + guild.id + "'",
        (err, result) => {
          if (err) reject(err);
          resolve(result);
        }
      );
    });
    cooldown.set(guild.id, true);
    for (const id of resulta) {
      const user = await interaction.client.users
        .fetch(id.author_id)
        .catch((err) => {});
      await user
        .send({
          embeds: [
            new MessageEmbed()
              .setTitle("Bump")
              .setColor("GREEN")
              .setDescription(
                "Une personne a mis en avant le serveur (" + guild.name + ") !"
              ),
          ],
        })
        .catch((err) => {});
    }
    const timeout = setTimeout(async () => {
      cooldown.delete(guild.id);
      if (resulta.length && resulta.length > 0) {
        for (const id of resulta) {
          const user = await interaction.client.users
            .fetch(id.author_id)
            .catch((err) => {});
          await user
            .send({
              embeds: [
                new MessageEmbed()
                  .setTitle("Bump")
                  .setColor("GREEN")
                  .setDescription(
                    "Vous pouvez a nouveau mettre en avant le serveur (" +
                      guild.name +
                      ") !"
                  ),
              ],
            })
            .catch((err) => {});
        }
      }
    }, ms("1h"));
  },
};
