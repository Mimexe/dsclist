const express = require("express");
const path = require("path");
const logger = require("../logger");
const passport = require("passport");
const session = require("express-session");
const { Server } = require("http");
const DiscordStrategy = require("passport-discord").Strategy;
const bodyParser = require("body-parser");
const { PermissionFlagsBits } = require("discord-api-types/v9");
const { table } = require("table");
/**
 *
 * @param {import('discord.js').Client} client
 * @returns {Server}
 */
module.exports = (client) => {
  const app = express();
  const port = 3000;

  var scopes = ["identify", "guilds"];
  app.use(express.static(path.join(__dirname, "public")));

  app.use(bodyParser.json()); // to support JSON-encoded bodies
  app.use(
    bodyParser.urlencoded({
      // to support URL-encoded bodies
      extended: true,
    })
  );
  app.use(
    session({
      secret: require("../config.json").sessionSecret,
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  passport.use(
    new DiscordStrategy(
      {
        clientID: "996358104864276531",
        clientSecret: require("../config.json").clientSecret,
        callbackURL: "http://localhost:3000/callback",
        scope: scopes,
      },
      function (accessToken, refreshToken, profile, cb) {
        logger.info(
          `${profile.username}#${profile.discriminator} logged in.`,
          "Dashboard"
        );
        process.nextTick(() => cb(null, profile));
      }
    )
  );

  function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      req.user.admin = req.user.id == "754038841001640099";
      return next();
    }
    res.redirect(
      `/?ealert=${encodeURIComponent("Vous devez être connecté !")}`
    );
  }

  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "ejs");

  /**
   *
   * @param {import("express").Response} res
   * @param {import("express").Request} req
   * @param {String} page
   * @param {Object} data
   */
  function render(res, req, page, data) {
    let baseData = {
      bot: client,
      user: req.isAuthenticated() ? req.user : null,
      salert: null,
      ealert: null,
    };
    const salert = req.query.salert;
    const ealert = req.query.ealert;
    if (salert) {
      baseData.salert = salert;
    }
    if (ealert) {
      baseData.ealert = ealert;
    }
    res.render(`pages/${page}`, Object.assign(baseData, data));
  }

  app.get("/login", passport.authenticate("discord"));

  app.get(
    "/callback",
    passport.authenticate("discord", {
      failureRedirect: `/?ealert=${encodeURIComponent(
        "Une erreur est survenue lors de la connexion !"
      )}`,
      successRedirect: `/?salert=${encodeURIComponent(
        "Connecté avec succès !"
      )}`,
    })
  );

  app.get("/", (req, res) => {
    render(res, req, "index");
  });

  app.get("/logout", isAuthenticated, (req, res) => {
    logger.info(
      `${req.user.username}#${req.user.discriminator} logged out.`,
      "Dashboard"
    );
    req.logout((err) => {
      if (err) {
        logger.error(err.stack, "Dashboard");
        res.redirect(
          `/?ealert=${encodeURIComponent(
            "Une erreur est survenue lors de la déconnexion"
          )}`
        );
      } else {
        req.session.destroy((err) => {
          if (err) {
            logger.error(err.stack, "Dashboard");
            res.redirect(
              `/?ealert=${encodeURIComponent(
                "Une erreur est survenue lors de la déconnexion"
              )}`
            );
          } else {
            res.redirect(
              `/?salert=${encodeURIComponent("Déconnecté avec succès !")}`
            );
          }
        });
      }
    });
  });

  app.post("/like/:server", isAuthenticated, async (req, res) => {
    const server = req.params.server;
    const user = req.user;
    const isLiked = await new Promise(async (resolve, reject) => {
      client.database.query(
        "SELECT * FROM likes WHERE author_id = " +
          user.id +
          " AND server_id = " +
          server,
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
    if (isLiked) {
      client.database.query(
        "DELETE FROM likes WHERE author_id = " +
          user.id +
          " AND server_id = " +
          server,
        (err) => {
          if (err) {
            logger.error(err.stack, "Dashboard");
            res.redirect(
              `/servers?ealert=${encodeURIComponent(
                "Une erreur est survenue lors de la suppression du like"
              )}`
            );
          } else {
            res.redirect(
              `/servers?salert=${encodeURIComponent("Like supprimé !")}`
            );
            logger.info(
              "Like from " +
                user.username +
                "#" +
                user.discriminator +
                " deleted from the server " +
                client.guilds.cache.get(server).name +
                ".",
              "Dashboard"
            );
          }
        }
      );
    } else {
      await new Promise(async (resolve, reject) => {
        client.database.query(
          "INSERT INTO `likes`(`server_id`, `author_id`) VALUES ('" +
            server +
            "','" +
            user.id +
            "')",
          async (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      })
        .then(() => {
          res.redirect(
            `/servers?salert=${encodeURIComponent(
              "Le like sur le serveur a été ajouté !"
            )}`
          );
          logger.info(
            "Like from " +
              user.username +
              "#" +
              user.discriminator +
              " added on the server " +
              client.guilds.cache.get(server).name +
              ".",
            "Dashboard"
          );
        })
        .catch((err) => {
          logger.error(err.stack, "Dashboard");
          res.redirect(
            `/servers?ealert=${encodeURIComponent("Une erreur est survenue !")}`
          );
        });
    }
  });

  app.get("/servers", async (req, res) => {
    let servers = [];
    let bumped = [];

    await new Promise((resolve, reject) => {
      client.database.query("SELECT * FROM servers", async (err, result) => {
        if (err) {
          reject();
          logger.error(err.stack, "Dashboard");
          res.redirect(
            "/?ealert=" +
              encodeURIComponent(
                "Une erreur est survenue lors de la récupération des serveurs"
              )
          );
        } else {
          for (const server of result) {
            let serverData = {
              id: server.id,
              name: server.name,
              description: server.description,
              code: server.code,
              bump_date: server.bump_date,
              likes: 0,
              views: 0,
            };
            if (server.bump_date != null) {
              bumped.push(serverData);
            }
            const r = await client.guilds.fetch(serverData.id).catch((err) => {
              client.database.query(
                "DELETE FROM servers WHERE id = " + serverData.id,
                (merr) => {
                  if (merr) {
                    reject();
                    logger.error(merr.stack, "Dashboard");
                    res.redirect(
                      "/?ealert=" +
                        encodeURIComponent("Erreur lors de la suppression")
                    );
                    return;
                  }
                  logger.warn(err.stack, "Dashboard");
                }
              );
              return 0;
            });
            if (r == 0) {
              continue;
            }
            servers.push(serverData);
          }
          resolve();
        }
      });
    });

    await new Promise((resolve, reject) => {
      client.database.query("SELECT * FROM likes", async (err, result) => {
        if (err) {
          reject();
          logger.error(err.stack, "Dashboard");
          res.redirect(
            "/?ealert=" +
              encodeURIComponent(
                "Une erreur est survenue lors de la récupération des likes"
              )
          );
        } else {
          for (const like of result) {
            let server = servers.find((server) => server.id == like.server_id);
            if (server) {
              server.likes++;
            }
          }
          resolve();
        }
      });
    });

    await new Promise((resolve, reject) => {
      client.database.query("SELECT * FROM views", async (err, result) => {
        if (err) {
          reject();
          logger.error(err.stack, "Dashboard");
          res.redirect(
            "/?ealert=" +
              encodeURIComponent(
                "Une erreur est survenue lors de la récupération des likes"
              )
          );
        } else {
          for (const view of result) {
            let server = servers.find((server) => server.id == view.server_id);
            if (server) {
              server.views++;
            }
          }
          resolve();
        }
      });
    });

    render(res, req, "servers", {
      servers: servers,
      bumped: bumped,
    });
  });

  app.get("/server", (req, res) => {
    res.redirect("/servers");
  });

  app.get("/server/:code", isAuthenticated, async (req, res) => {
    let server = {};
    client.database.query(
      `SELECT * FROM servers WHERE code = '${req.params.code}'`,
      async (err, result) => {
        if (err) {
          logger.error(err.stack, "Dashboard");
          res.redirect(
            `/?ealert=${encodeURIComponent(
              "Une erreur est survenue lors de la récupération du serveur"
            )}`
          );
        } else {
          if (result.length === 0) {
            res.redirect(
              `/?ealert=${encodeURIComponent("Ce serveur n'existe pas !")}`
            );
          } else {
            server = result[0];
            render(res, req, "server", {
              server: server,
            });
            const isExist = await new Promise((resolve, reject) => {
              client.database.query(
                "SELECT * FROM views WHERE server_id = " +
                  server.id +
                  " AND author_id = " +
                  req.user.id,
                (err, result) => {
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
            if (!isExist) {
              await new Promise((resolve, reject) => {
                client.database.query(
                  "INSERT INTO `views` (`id`, `server_id`, `author_id`) VALUES (NULL, '" +
                    server.id +
                    "', '" +
                    req.user.id +
                    "')",
                  (err, result) => {
                    if (err) reject(err);
                    resolve(result);
                  }
                );
              });
            }
          }
        }
      }
    );
  });

  app.get("/servers/add", isAuthenticated, (req, res) => {
    render(res, req, "server/add");
  });

  app.post("/servers/add", isAuthenticated, async (req, res) => {
    let server = req.body.server;
    let name = req.body.name;
    let description = req.body.description;
    let code = req.body.code;
    let like = req.body.like;
    const isExist = await new Promise(async (resolve, reject) => {
      client.database.query(
        "SELECT * FROM servers WHERE id = " + server,
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
      res.redirect(
        `/servers?ealert=${encodeURIComponent("Ce serveur existe déjà !")}`
      );
      return;
    } else {
      if (description == "") {
        res.redirect(
          `/server/add?ealert=${encodeURIComponent(
            "Tu dois remplir la description du serveur !"
          )}`
        );
        return;
      }
      if (description.length > 255) {
        res.redirect(
          `/server/add?ealert=${encodeURIComponent(
            "La description est trop longue !"
          )}`
        );
        return;
      }

      if (!like) {
        like = false;
      } else {
        like = true;
      }
      if (code == "") {
        const code_ = await client.guilds.cache
          .get(server)
          .channels.cache.filter(
            (r) =>
              r.type == "GUILD_TEXT" &&
              r.guild.me.permissionsIn(r).has(PermissionFlagsBits.SendMessages)
          )
          .first()
          .createInvite({
            maxAge: 0,
            maxUses: 0,
            reason: "Ajouter le serveur sur le site",
          });
        code = code_.code;
      }
      if (name == "") {
        name = client.guilds.cache.get(server).name;
      }
      client.database.query(
        "INSERT INTO `servers` (`id`, `name`, `description`, `code`) VALUES ('" +
          server +
          "','" +
          name +
          "','" +
          description +
          "','" +
          code +
          "')",
        (err, result) => {
          if (err) {
            logger.error(err.stack, "Dashboard");
            res.redirect(
              `/servers/add?ealert=${encodeURIComponent(
                "Une erreur est survenue lors de l'ajout du serveur"
              )}`
            );
          }
          if (result.affectedRows > 0) {
            if (like) {
              res.redirect(307, `/like/${server}`);
              logger.success(
                "Succesfully added server " +
                  client.guilds.cache.get(server).name,
                "Dashboard"
              );
            } else {
              res.redirect(
                "/servers/add?salert=" +
                  encodeURIComponent("Serveur ajouté avec succès !")
              );
              logger.success(
                "Succesfully added server " +
                  client.guilds.cache.get(server).name,
                "Dashboard"
              );
            }
          } else {
            res.redirect(
              "/servers/add?ealert=" +
                encodeURIComponent("Aucun serveur ajouté")
            );
          }
        }
      );
    }
  });

  app.get("/account", isAuthenticated, (req, res) => {
    render(res, req, "account");
  });

  app.get("*", async (req, res) => {
    render(res, req, "404");
  });

  const server = app.listen(port, () => {
    logger.success(`Listening on port ${port}`, "Dashboard");
  });
  server.on("error", (err) => {
    logger.error("Error on the dashboard: " + err.stack, "Dashboard");
  });
  server.on("clientError", (err, socket) => {
    logger.error("Client Error on the dashboard: " + err.stack, "Dashboard");
  });
  return server || new Error("Server error");
};
