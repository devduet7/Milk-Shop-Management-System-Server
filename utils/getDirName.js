// <== IMPORTS ==>
import path from "path";
import { fileURLToPath } from "url";

// <== NODE JS PATH HELPER FUNCTION ==>
export function getDirName(importMetaUrl) {
  // RETURNING THE DIRECTORY NAME
  return path.dirname(fileURLToPath(importMetaUrl));
}
