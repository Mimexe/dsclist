let start = Date.now();
const Discord = require("discord.js");
const client = new Discord.Client({ intents: 131071 });
const config = require("./config.json");
const fs = require("fs");
require("colors");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const logger = require("./logger.js");
const mysql = require("mysql");
const { table } = require("table");
const { clearTimeout } = require("timers");

let devmode = false;
const args = process.argv.slice(2);
if (args.includes("--dev")) {
  logger.warn("Starting in development mode.", "Dev");
  devmode = true;
  logger.setDevMode(true);
  if (!args.includes("--no-debug")) {
    client.on("debug", (msg) => {
      logger.debug(msg);
    });
  }
}
client.devmode = devmode;

client.commands = new Discord.Collection();
client.events = new Discord.Collection();

client.cemojis = {
  loading: "<a:loading:995268076914356284>",
  success: "<a:check:995268078843736095>",
  error: "<a:errror:995268075282771978>",
};

async function commands() {
  return await new Promise(async (resolve, reject) => {
    const commandFiles = fs
      .readdirSync("./commands")
      .filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
      const command = require(`./commands/${file}`);
      if (!command.data) return reject(new Error("Command not found."));
      client.commands.set(command.data.name, command);
    }

    const rest = new REST({ version: "9" }).setToken(config.token);

    let commands = [];

    for (const command of client.commands.values()) {
      commands.push(command.data.toJSON());
    }
    logger.info("Started refreshing application (/) commands.", "Commands");

    await rest
      .put(
        devmode
          ? Routes.applicationGuildCommands(
              "996358104864276531",
              "994618544882995340"
            )
          : Routes.applicationCommands("996358104864276531"),
        {
          body: commands,
        }
      )
      .catch((err) => {
        reject(new Error(err));
      });

    logger.success(
      "Successfully reloaded application (/) commands.",
      "Commands"
    );
    resolve();
  });
}

async function events() {
  return await new Promise(async (resolve, reject) => {
    const eventFiles = fs
      .readdirSync("./events")
      .filter((file) => file.endsWith(".js"));
    for (const file of eventFiles) {
      const event = require(`./events/${file}`);
      if (!event.name) return reject(new Error("Event not found."));
      client.on(event.name, async (...args) => {
        await event.execute(client, ...args);
      });
    }
    resolve();
  });
}

let attempt = 0;
let failed = false;

async function connectMySQL() {
  return await new Promise((resolve, reject) => {
    const db = mysql.createConnection({
      host: config.mysql.host,
      user: config.mysql.user,
      password: config.mysql.password,
      port: config.mysql.port,
      database: config.mysql.database,
    });
    db.connect(async function (err) {
      if (err) {
        failed = true;
        if (err.code == "ECONNREFUSED") {
          if (attempt > 2) {
            logger.warn("Aborting.", "MySQL");
            await client.summary.show();
          } else {
            setTimeout(() => {
              logger.warn("Attempting to reconnect to MySQL", "MySQL");
              connectMySQL();
            }, 2000);
            attempt++;
            return reject(
              new Error("MySQL connection refused. (" + attempt + " attempt)")
            );
          }
        }
        reject(new Error(err));
        return;
      }
      attempt = 0;
      logger.success("Connected to MySQL", "MySQL");
      resolve(db);
      client.database = db;
      if (failed) await client.summary.show();
    });
    db.on("error", async (err) => {
      if (err.code === "PROTOCOL_CONNECTION_LOST") {
        client.database = "failed";
        failed = true;
        logger.error("Lost connection to MySQL", "MySQL");
        await client.summary.show();
        setTimeout(() => {
          logger.warn("Attempting to reconnect to MySQL", "MySQL");
          connectMySQL();
        }, 2000);
      }
    });
  });
}

client.on("ready", async (client) => {
  let data = {
    mysql: "✅",
    commands: "✅",
    events: "✅",
    dashboard: "✅",
  };
  logger.info(`Loading...`, "Bot");
  client.user.setStatus("idle");
  client.user.setActivity("Loading...");
  await commands().catch((err) => {
    logger.error("Error loading commands: " + err.stack, "MySQL");
    data.commands = "❌";
  });
  await events().catch((err) => {
    logger.error("Error loading events: " + err.stack, "MySQL");
    data.events = "❌";
  });
  client.dashboard = require("./dashboard/index")(client);
  await connectMySQL().catch((err) => {
    logger.error("Error connecting to MySQL: " + err.stack, "MySQL");
    data.mysql = "❌";
    client.database = "failed";
  });

  logger.success(`${client.user.tag} is online!`, "Bot");
  client.user.setActivity(devmode ? "Developpement" : "dsclist.ga");
  client.user.setStatus(devmode ? "dnd" : "online");

  client.summary = {
    show: async (a) => {
      if (!a) logger.info("Update detected, showing summary.", "Summary");
      await require("util").promisify(setTimeout)(1000);
      let end = Date.now();
      if (client.database === "failed") data.mysql = "❌";
      else data.mysql = "✅";
      let finalData = [
        ["Name", "Status"],
        ["MySQL", data.mysql],
        ["Commands", data.commands],
        ["Events", data.events],
        ["Dashboard", data.dashboard],
        ["Started in", `${(end - start) / 1000}s`],
      ];
      if (
        data.mysql === "✅" &&
        data.commands === "✅" &&
        data.events === "✅" &&
        data.dashboard === "✅"
      ) {
        console.log(
          table(finalData, {
            header: {
              content: a ? "Summary" : "Summary Update",
              alignment: "center",
            },
          }).green.bold
        );
      } else {
        console.log(
          table(finalData, {
            header: {
              content: a ? "Summary" : "Summary Update",
              alignment: "center",
            },
          }).red.bold
        );
      }
    },
    data,
  };
  await client.summary.show(true);
  logger.info("All done !");
});

let started = false;

client.login(config.token);
process.on("SIGINT", async () => {
  try {
    if (started) return;
    started = true;
    if (!client.isReady()) {
      if (client === "failed") {
        logger.error("Client failed to start, Aborting.", "Bot");
        return;
      }
      logger.error("Waiting for the bot to be ready.");
      await new Promise((resolve) => {
        client.on("ready", () => {
          resolve();
        });
      });
      logger.info("Bot is ready, shutting down");
    }
    if (!client.dashboard) {
      logger.error("Waiting for the dashboard to be ready.");
      if (client.dashboard === "failed") {
        logger.error("Dashboard failed to start, Aborting.", "Bot");
        return;
      }
      await new Promise((resolve, r) => {
        const timeout = setTimeout(() => {
          r(new Error("Timeout"));
        }, 30000);
        setInterval(() => {
          if (client.dashboard) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      logger.info("Dashboard is ready, shutting down");
    }
    if (!client.database) {
      logger.error("Waiting for the database to be ready.");
      if (client.database === "failed") {
        logger.error("Database failed to start, Aborting.", "Bot");
        return;
      }
      await new Promise((resolve, r) => {
        const timeout = setTimeout(() => {
          r(new Error("Timeout"));
        }, 30000);
        setInterval(() => {
          if (client.database) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      logger.info("Database is ready, shutting down");
    }
    setTimeout(() => {
      logger.error(new Error("Timeout, force stopping").stack, "Bot");
      process.exit(1);
    }, 60000);
    let i = 58;
    logger.warn("Shutting down...", "Bot");
    const interval = setInterval(() => {
      if (i == 50) logger.warn("Shutting down... (" + i + " seconds)", "Bot");
      if (i == 40) logger.warn("Shutting down... (" + i + " seconds)", "Bot");
      if (i == 30) logger.warn("Shutting down... (" + i + " seconds)", "Bot");
      if (i == 20) logger.warn("Shutting down... (" + i + " seconds)", "Bot");
      if (i <= 10) logger.error("Shutting down... (" + i + " seconds)", "Bot");
      i--;
    }, 1000);

    client.user.setStatus("idle");
    client.user.setActivity("Shutting down...", {
      type: "PLAYING",
    });

    await new Promise((resolve, r) => {
      if (client.dashboard == "failed") {
        logger.error("Dashboard failed, aborting.");
        return r();
      }
      client.dashboard.closeAllConnections();
      client.dashboard.close(() => {
        logger.warn("Dashboard closed", "Dashboard");
        resolve();
      });
    }).catch(() => {});
    await new Promise((resolve, r) => {
      if (client.database == "failed") {
        logger.error("Database failed, aborting.");
        return r();
      }
      client.database.end(() => {
        logger.warn("MySQL closed.", "MySQL");
        resolve();
      });
    }).catch(() => {});

    await new Promise((resolve) => setTimeout(resolve, 350));
    await new Promise((resolve, r) => {
      if (client == "failed") {
        logger.error("Client failed, aborting.");
        return r();
      }
      client.on("shardDisconnect", (a, b) => {
        resolve();
      });
      client.destroy();
    }).catch((err) => {
      logger.error("Error while shutting down: " + err.stack, "Bot");
    });
    process.exit(0);
  } catch (err) {
    logger.error("Error while shutting down: " + err.stack, "Bot");
    process.exit(1);
  }
});

process.on("unhandledRejection", (err, promise) => {
  logger.error("Unhandled rejection: " + err.stack, "AntiCrash");
});

process.on("uncaughtException", (err, origin) => {
  logger.error("Uncaught Exception: " + err.stack, "AntiCrash");
});

client.on("error", (err) => {
  logger.error("Bot error: " + err.stack, "AntiCrash");
});

client.on("shardError", (err, shardId) => {
  logger.error(
    "Shard error on shard " + shardId + ": " + err.stack,
    "AntiCrash"
  );
});

process.on("exit", async (code) => {
  if (code > 0) {
    logger.error(`Exiting with code ${code}...`.bold);
  } else {
    logger.warn(`Exiting with code ${code}...`.bold);
  }
});
