// <== IMPORTS ==>
import mongoose from "mongoose";

// <== USER SCHEMA ==>
const userSchema = new mongoose.Schema(
  {
    // FULL NAME FIELD
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // EMAIL FIELD
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please Provide a Valid email Address!"],
    },
    // PASSWORD FIELD
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    // PHONE NUMBER FIELD
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
      match: [
        /^\+[1-9]\d{1,14}$/,
        "Please Provide a Valid Phone Number with Country Code!",
      ],
    },
    // ADDRESS FIELD (OPTIONAL)
    address: {
      type: String,
      default: null,
      trim: true,
      maxlength: [300, "Address must not exceed 300 Characters!"],
    },
    // AVATAR FIELD (OPTIONAL — CLOUDINARY STORED)
    avatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    // MILK RATE FIELD (PRICE PER LITER IN RUPEES)
    milkRate: {
      type: Number,
      default: 120,
      min: [1, "Milk Rate must be at least ₨1!"],
    },
    // YOGHURT RATE FIELD (PRICE PER KG IN RUPEES)
    yoghurtRate: {
      type: Number,
      default: 180,
      min: [1, "Yoghurt Rate must be at least ₨1!"],
    },
    // DAILY REPORTS ENABLED FLAG
    dailyReportsEnabled: {
      type: Boolean,
      default: false,
    },
    // MONTHLY REPORTS ENABLED FLAG
    monthlyReportsEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// <== INDEXES ==>
/**
 * TEXT INDEX FOR SEARCH FUNCTIONALITY
 */
// <== TEXT INDEX FOR SEARCH FUNCTIONALITY ==>
userSchema.index({
  fullName: "text",
  email: "text",
});
/**
 * COMPOUND INDEX FOR EMAIL AND FULL NAME SEARCHES
 */
// <== COMPOUND INDEX FOR EMAIL AND FULL NAME SEARCHES ==>
userSchema.index({ email: 1, fullName: 1 });
/**
 * INDEX FOR PHONE NUMBER
 */
// <== INDEX FOR PHONE NUMBER ==>
userSchema.index({ phoneNumber: 1 }, { sparse: true });

// <== EXPORTING THE USER MODEL ==>
export const User = mongoose.model("User", userSchema);
