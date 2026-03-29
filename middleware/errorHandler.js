// <== IMPORTS ==>
import { logEvents } from "./logger.js";

// <== ERROR HANDLER ==>
export const errorHandler = (err, req, res, _next) => {
  // LOGGING THE ERROR IN THE LOG FILE
  logEvents(
    `${err.name} : ${err.message}\t${req.method}\t${req.url}\t${req.headers.origin}`,
    "errorLog.log",
  );
  // LOGGING THE ERROR IN THE CONSOLE
  console.log(err.stack);
  // GETTING THE STATUS CODE
  const status = res.statusCode ? res.statusCode : 500;
  // SETTING THE ERROR RESPONSE STATUS
  res.status(status);
  // SENDING THE ERROR RESPONSE
  res.json({ message: err.message, isError: true });
};
