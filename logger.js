require("colors");
let devmode = false;

module.exports = {
  info: (message, prefix) => {
    if (prefix) {
      console.log(
        `[${new Date().toLocaleString()}/${prefix}${
          devmode ? "/DEVMODE" : ""
        }] ${message}`.blue
      );
    } else {
      console.log(
        `[${new Date().toLocaleString()}${
          devmode ? "/DEVMODE" : ""
        }] ${message}`.blue
      );
    }
  },
  success: (message, prefix) => {
    if (prefix) {
      console.log(
        `[${new Date().toLocaleString()}/${prefix}${
          devmode ? "/DEVMODE" : ""
        }] ${message}`.green
      );
    } else {
      console.log(
        `[${new Date().toLocaleString()}${
          devmode ? "/DEVMODE" : ""
        }] ${message}`.green
      );
    }
  },
  error: (message, prefix) => {
    if (prefix) {
      console.log(
        `[${new Date().toLocaleString()}/${prefix}${
          devmode ? "/DEVMODE" : ""
        }] ${message}`.red
      );
    } else {
      console.log(
        `[${new Date().toLocaleString()}${
          devmode ? "/DEVMODE" : ""
        }] ${message}`.red
      );
    }
  },
  warn: (message, prefix) => {
    if (prefix) {
      console.log(
        `[${new Date().toLocaleString()}/${prefix}${
          devmode ? "/DEVMODE" : ""
        }] ${message}`.yellow
      );
    } else {
      console.log(
        `[${new Date().toLocaleString()}${
          devmode ? "/DEVMODE" : ""
        }] ${message}`.yellow
      );
    }
  },
  debug: (message) => {
    if (devmode) {
      console.log(`[${new Date().toLocaleString()}/Debug] ${message}`.gray);
    }
  },
  setDevMode: (bool) => {
    if (bool) {
      devmode = true;
      require("./logger").info("Developpement mode enabled.", "Logger");
    }
  },
};
