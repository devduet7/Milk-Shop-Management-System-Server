// <== IMPORTS ==>
import multer from "multer";

// <== MEMORY STORAGE — FILES STORED IN BUFFER, NOT WRITTEN TO DISK ==>
const storage = multer.memoryStorage();

// <== ALLOWED IMAGE MIME TYPES FOR AVATAR UPLOAD ==>
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// <== AVATAR FILE FILTER — ACCEPTS IMAGES ONLY ==>
const imageFilter = (_req, file, cb) => {
  // CHECKING IF FILE MIME TYPE IS ALLOWED
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    // ACCEPTING THE FILE
    cb(null, true);
  } else {
    // REJECTING WITH DESCRIPTIVE ERROR
    cb(new Error("Only JPEG, PNG, and WebP images are allowed!"), false);
  }
};

// <== HANDLING SINGLE FILE UPLOAD (GENERAL PURPOSE) ==>
export const singleUpload = multer({ storage }).single("file");

// <== HANDLING MULTIPLE FILE UPLOAD ==>
export const multipleUpload = multer({ storage });

// <== AVATAR UPLOAD — IMAGE ONLY, MAX 5MB ==>
export const avatarUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    // MAX FILE SIZE: 5MB
    fileSize: 5 * 1024 * 1024,
  },
}).single("file");
