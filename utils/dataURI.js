// <== IMPORTS ==>
import path from "path";
import DataURIParser from "datauri/parser.js";

// <== DATA URI FUNCTION ==>
const getDataURI = (file) => {
  // RETURNING THE DATA URI
  const parser = new DataURIParser();
  // GETTING THE FILE EXTENSION
  const extName = path.extname(file.originalname).toString();
  // RETURNING THE DATA URI
  return parser.format(extName, file.buffer);
};

// <== EXPORTING THE FUNCTION ==>
export default getDataURI;
