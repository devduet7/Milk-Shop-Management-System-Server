// <== IMPORTS ==>
import path from "path";
import express from "express";
import { getDirName } from "../utils/getDirName.js";

// <== DIRNAME ==>
const __dirname = getDirName(import.meta.url);
// <== ROUTER ==>
const router = express.Router();
// <== ROUTE ==>
const rootRoute = router.get("^/$|/index(.html)?", (_req, res) => {
  // SENDING INDEX.HTML
  res.sendFile(path.join(__dirname, "..", "views", "index.html"));
});

// <== EXPORTING ROOT ROUTE ==>
export default rootRoute;
