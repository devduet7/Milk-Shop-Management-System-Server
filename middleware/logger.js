// <== IMPORTS ==>
import fs from "fs";
import path from "path";
import { format } from "date-fns";
import { v4 as uuid } from "uuid";
import fsPromises from "fs/promises";
import { getDirName } from "../utils/getDirName.js";

// <== DIRNAME ==>
const __dirname = getDirName(import.meta.url);

// <== MAIN LOGGER FUNCTION ==>
export const logEvents = async (message, logFileName) => {
  // CREATING THE DATE & TIME FORMAT FOR LOG ITEMS
  const dateTime = format(new Date(), "yyyyMMdd\tHH:mm:ss");
  // CREATING THE LOG ITEM
  const logItem = `${dateTime}\t${uuid()}\t${message}\n`;
  // TRYING TO APPEND THE LOG ITEM
  try {
    // CHECKING IF THE LOGS DIRECTORY EXISTS
    if (!fs.existsSync(path.join(__dirname, "..", "logs"))) {
      // CREATING THE LOGS DIRECTORY
      await fsPromises.mkdir(path.join(__dirname, "..", "logs"));
    }
    // APPENDING THE LOG ITEM TO THE LOG FILE
    await fsPromises.appendFile(
      path.join(__dirname, "..", "logs", logFileName),
      logItem,
    );
  } catch (err) {
    // CATCHING ERROR
    console.log(err);
  }
};

// <== LOGGER MIDDLEWARE FUNCTION ==>
export const logger = (req, _res, next) => {
  // LOGGING THE REQUEST IN THE LOG FILE
  logEvents(`${req.method}\t${req.url}\t${req.headers.origin}`, "reqLog.log");
  // LOGGING THE REQUEST IN THE CONSOLE
  console.log(`${req.method} ${req.path}`);
  // MOVING TO THE NEXT MIDDLEWARE
  next();
};
