const { SlashCommandBuilder } = require("@discordjs/builders");
const { CommandInteraction, MessageEmbed, Collection } = require("discord.js");
const logger = require("../logger");
const moment = require("moment");
const ms = require("ms");
const cooldown = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("notifications")
    .setDescription("Modifier votre paramètre de notification.")
    .setDMPermission(false)
    .addSubcommand((a) =>
      a
        .setName("enable")
        .setDescription("Activer les notifications.")
        .addBooleanOption((a) =>
          a
            .setName("accept")
            .setDescription("Vous acceptez d'avoir des messages privés.")
            .setRequired(true)
        )
    )
    .addSubcommand((a) =>
      a.setName("disable").setDescription("Désactiver les notifications.")
    ),
  /**
   *
   * @param {CommandInteraction} interaction
   */
  execute: async (interaction) => {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();
    /**
     * @type {import("mysql").Connection}
     */
    const database = interaction.client.database;
    if (subcommand === "enable") {
      const accept = interaction.options.getBoolean("accept");
      if (accept) {
        const isExist = await new Promise(async (resolve, reject) => {
          database.query(
            "SELECT * FROM `bump_notifications` WHERE server_id = " +
              guild.id +
              " AND author_id = " +
              interaction.user.id,
            async (err, result) => {
              if (err) {
                logger.error(err.stack, "Dashboard");
                reject(err);
              } else {
                if (result.length === 0) {
                  resolve(false);
                } else {
                  resolve(true);
                }
              }
            }
          );
        });
        if (isExist) {
          await interaction.editReply({
            embeds: [
              new MessageEmbed()
                .setTitle("Erreur")
                .setColor("RED")
                .setDescription("Vous avez déjà accepté les notifications."),
            ],
          });
          return;
        }
        const r = await interaction.user
          .send({
            embeds: [
              new MessageEmbed()
                .setTitle("Vérification")
                .setColor("GREEN")
                .setDescription(
                  "Si vous avez reçu ce message, les messages privés sont activés."
                ),
            ],
          })
          .catch(() => 0);
        if (r == 0) {
          await interaction.editReply({
            embeds: [
              new MessageEmbed()
                .setTitle("Erreur")
                .setColor("RED")
                .setDescription(
                  "Impossible de vous ajouter, vos messages privés ne sont pas activés sur ce serveur."
                )
                .setFooter({ text: "Notifications désactivés." }),
            ],
          });
          return;
        }
        const result = await new Promise((resolve, reject) => {
          database.query(
            "INSERT INTO `bump_notifications` (`id`, `server_id`, `author_id`) VALUES (NULL, '" +
              guild.id +
              "', '" +
              interaction.user.id +
              "')",
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
              .setDescription("Vous avez été enregistré.")
              .setFooter({ text: "Notifications activées." }),
          ],
        });
      } else {
        await interaction.editReply({
          embeds: [
            new MessageEmbed()
              .setTitle("Erreur")
              .setColor("RED")
              .setDescription("Vous avez refusé d'avoir des messages privés.")
              .setFooter({ text: "Abandonné" }),
          ],
        });
      }
    } else if (subcommand === "disable") {
      const result = await new Promise((resolve, reject) => {
        database.query(
          "DELETE FROM `bump_notifications` WHERE server_id = " +
            guild.id +
            " AND author_id = " +
            interaction.user.id,
          (err, result) => {
            if (err) reject(err);
            resolve(result);
          }
        );
      }).catch(() => 0);
      if (result.affectedRows === 0) {
        await interaction.editReply({
          embeds: [
            new MessageEmbed()
              .setTitle("Erreur")
              .setColor("RED")
              .setDescription("Vous n'êtes pas enregistré."),
          ],
        });
        return;
      }
      await interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setTitle("Succès")
            .setColor("GREEN")
            .setDescription("Vous avez été supprimé.")
            .setFooter({ text: "Notifications désactivées." }),
        ],
      });
    }
  },
};
