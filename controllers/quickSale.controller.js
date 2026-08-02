// <== IMPORTS ==>
import mongoose from "mongoose";
import expressAsyncHandler from "express-async-handler";
import { QuickSale } from "../models/quickSale.model.js";
import { removeDocument } from "../services/trashService.js";
import { TRASH_ENTITY_TYPES } from "../models/trash.model.js";

// <== HELPER: GET CURRENT MONTH STRING ==>
const getCurrentMonthStr = () => {
  // GET CURRENT UTC DATE
  const now = new Date();
  // RETURNING FORMATTED YYYY-MM STRING
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

// <== HELPER: GET TODAY DATE STRING ==>
const getTodayDateStr = () => {
  // GET CURRENT UTC DATE
  const now = new Date();
  // RETURNING FORMATTED YYYY-MM-DD STRING
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
};

// <== HELPER: GET MONTH DATE RANGE ==>
const getMonthDateRange = (monthStr) => {
  // PARSING YEAR AND MONTH FROM YYYY-MM STRING
  const [year, month] = monthStr.split("-").map(Number);
  // BUILDING START DATE (FIRST DAY OF MONTH)
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  // CALCULATING LAST DAY OF MONTH
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // BUILDING END DATE (LAST DAY OF MONTH)
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  // RETURNING DATE RANGE
  return { startDate, endDate };
};

// <== HELPER: GET WEEK START DATE STRING ==>
const getWeekStartDateStr = () => {
  // GET CURRENT UTC DATE
  const now = new Date();
  // CALCULATE DATE 6 DAYS BEFORE TODAY (LAST 7 DAYS INCLUDING TODAY)
  const weekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6),
  );
  // RETURNING FORMATTED YYYY-MM-DD STRING
  return `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, "0")}-${String(weekStart.getUTCDate()).padStart(2, "0")}`;
};

// <== HELPER: GET DATE RANGE FOR FILTER ==>
const getDateRangeForFilter = (
  filterType,
  monthStr,
  specificDate,
  rangeStart,
  rangeEnd,
) => {
  // GET TODAY DATE STRING
  const today = getTodayDateStr();
  // SWITCH ON FILTER TYPE
  switch (filterType) {
    // TODAY FILTER: SINGLE DAY RANGE
    case "today":
      return { startDate: today, endDate: today };
    // WEEK FILTER: LAST 7 DAYS INCLUDING TODAY
    case "week":
      return { startDate: getWeekStartDateStr(), endDate: today };
    // MONTH FILTER: FULL CALENDAR MONTH
    case "month":
      return getMonthDateRange(monthStr);
    // DATE FILTER: SPECIFIC SINGLE DAY
    case "date":
      return {
        startDate: specificDate || today,
        endDate: specificDate || today,
      };
    // RANGE FILTER: EXPLICIT CUSTOM START AND END DATES
    case "range": {
      // RESOLVING BOTH ENDS WITH A TODAY FALLBACK, CONSISTENT WITH THE DATE FILTER'S LENIENCY
      const resolvedStart = rangeStart || today;
      // RESOLVING END DATE WITH FALLBACK
      const resolvedEnd = rangeEnd || today;
      // GUARDING AGAINST AN INVERTED RANGE BY SWAPPING RATHER THAN SILENTLY RETURNING NO RESULTS
      return resolvedStart <= resolvedEnd
        ? { startDate: resolvedStart, endDate: resolvedEnd }
        : { startDate: resolvedEnd, endDate: resolvedStart };
    }
    // DEFAULT: TODAY
    default:
      return { startDate: today, endDate: today };
  }
};

/**
 * GET QUICK SALES WITH STATS FOR THE SELECTED FILTER AND PRODUCT TYPE
 * STATS ARE ALWAYS COMPUTED ACROSS THE FULL FILTERED DATASET REGARDLESS OF PAGE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET QUICK SALES ==>
export const getQuickSales = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING FILTER TYPE (TODAY | WEEK | MONTH | DATE) — DEFAULTS TO TODAY
  const filterType = req.query.filterType || "today";
  // GETTING SPECIFIC DATE FOR DATE FILTER (YYYY-MM-DD)
  const specificDate = req.query.date || null;
  // GETTING MONTH STRING FOR MONTH FILTER — DEFAULTS TO CURRENT MONTH
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING RANGE START FOR THE RANGE FILTER (YYYY-MM-DD)
  const rangeStart = req.query.rangeStart || null;
  // GETTING RANGE END FOR THE RANGE FILTER (YYYY-MM-DD)
  const rangeEnd = req.query.rangeEnd || null;
  // GETTING PRODUCT TYPE FILTER (ALL | MILK | YOGHURT) — DEFAULTS TO ALL
  const productType = req.query.productType || "all";
  // PARSING PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING LIMIT
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  // CALCULATING SKIP
  const skip = (page - 1) * limit;
  // CONVERTING ACCOUNT ID TO OBJECT ID FOR AGGREGATION PIPELINE USE
  const accountObjectId = new mongoose.Types.ObjectId(accountId);
  // GETTING DATE RANGE FOR SELECTED FILTER
  const { startDate, endDate } = getDateRangeForFilter(
    filterType,
    monthStr,
    specificDate,
    rangeStart,
    rangeEnd,
  );
  // BUILDING BASE MATCH QUERY SCOPED TO THE WHOLE ACCOUNT
  const baseMatch = {
    accountId: accountObjectId,
    date: { $gte: startDate, $lte: endDate },
  };
  // APPLYING PRODUCT TYPE FILTER WHEN NOT ALL
  if (productType !== "all") baseMatch.type = productType;
  // RUNNING STATS AGGREGATION, COUNT, AND PAGINATED RECORDS IN PARALLEL
  const [statsAgg, totalCount, records] = await Promise.all([
    // STATS AGGREGATION ACROSS FULL MATCHING DATASET (NOT PAGINATED)
    QuickSale.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          totalMilkQty: {
            $sum: { $cond: [{ $eq: ["$type", "milk"] }, "$quantity", 0] },
          },
          totalYoghurtQty: {
            $sum: { $cond: [{ $eq: ["$type", "yoghurt"] }, "$quantity", 0] },
          },
          milkRevenue: {
            $sum: { $cond: [{ $eq: ["$type", "milk"] }, "$total", 0] },
          },
          yoghurtRevenue: {
            $sum: { $cond: [{ $eq: ["$type", "yoghurt"] }, "$total", 0] },
          },
          totalTransactions: { $sum: 1 },
        },
      },
    ]),
    // TOTAL COUNT FOR PAGINATION METADATA
    QuickSale.countDocuments(baseMatch),
    // PAGINATED RECORDS SORTED BY DATE DESC THEN CREATION TIME DESC
    QuickSale.find(baseMatch)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);
  // EXTRACTING RAW STATS WITH FALLBACK
  const raw = statsAgg[0] || {};
  // BUILDING STATS OBJECT WITH SAFE PRECISION
  const stats = {
    totalRevenue: parseFloat((raw.totalRevenue ?? 0).toFixed(2)),
    totalMilkQty: parseFloat((raw.totalMilkQty ?? 0).toFixed(3)),
    totalYoghurtQty: parseFloat((raw.totalYoghurtQty ?? 0).toFixed(3)),
    milkRevenue: parseFloat((raw.milkRevenue ?? 0).toFixed(2)),
    yoghurtRevenue: parseFloat((raw.yoghurtRevenue ?? 0).toFixed(2)),
    totalTransactions: raw.totalTransactions ?? 0,
  };
  // CALCULATING TOTAL PAGES
  const totalPages = Math.ceil(totalCount / limit);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Quick Sales Fetched Successfully!",
    success: true,
    data: {
      records,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats,
      appliedFilter: {
        filterType,
        startDate,
        endDate,
        month: filterType === "month" ? monthStr : null,
        date: filterType === "date" ? specificDate : null,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * ADD A QUICK SALE RECORD
 * total IS COMPUTED AS QUANTITY * RATE AND STORED DENORMALISED
 * date DEFAULTS TO TODAY IF NOT PROVIDED BY THE CLIENT
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD QUICK SALE ==>
export const addQuickSale = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING SALE DATA FROM REQUEST BODY
  const { type, quantity, rate, date, note } = req.body;
  // PARSING QUANTITY AS FLOAT
  const parsedQty = parseFloat(quantity);
  // PARSING RATE AS FLOAT
  const parsedRate = parseFloat(rate);
  // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES BEFORE MULTIPLYING
  if (
    !Number.isFinite(parsedQty) ||
    !Number.isFinite(parsedRate) ||
    parsedQty <= 0 ||
    parsedRate <= 0
  ) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Quantity and Rate must be Valid Positive Numbers!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // COMPUTING TOTAL — STORED DENORMALISED TO AVOID MULTIPLICATION AT QUERY TIME
  const total = parseFloat((parsedQty * parsedRate).toFixed(2));
  // RESOLVING DATE — DEFAULTS TO TODAY IF NOT PROVIDED
  const resolvedDate = date?.trim() || getTodayDateStr();
  // CREATING QUICK SALE RECORD IN DATABASE
  const quickSale = await QuickSale.create({
    accountId,
    performedBy,
    type,
    quantity: parsedQty,
    rate: parsedRate,
    total,
    date: resolvedDate,
    note: note?.trim() || null,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(201).json({
    message: `${type === "milk" ? "Milk" : "Yoghurt"} sale of ${parsedQty}${type === "milk" ? "L" : "kg"} recorded — ₨${total.toLocaleString()}!`,
    success: true,
    data: { quickSale },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE AN EXISTING QUICK SALE RECORD
 * TOTAL IS ALWAYS RECOMPUTED AS QUANTITY * RATE AFTER ANY FIELD UPDATE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE QUICK SALE ==>
export const updateQuickSale = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING QUICK SALE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING UPDATE DATA FROM REQUEST BODY
  const { type, quantity, rate, date, note } = req.body;
  // FINDING QUICK SALE AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const quickSale = await QuickSale.findOne({ _id: id, accountId }).exec();
  // IF QUICK SALE NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!quickSale) {
    // RETURNING NOT FOUND RESPONSE
    res
      .status(404)
      .json({ message: "Quick Sale Record Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // UPDATING THE TYPE OF SALE IF PROVIDED
  if (type !== undefined) quickSale.type = type;
  // UPDATING THE QUANTITY OF SALE IF PROVIDED
  if (quantity !== undefined) quickSale.quantity = parseFloat(quantity);
  // UPDATING THE RATE OF SALE IF PROVIDED
  if (rate !== undefined) quickSale.rate = parseFloat(rate);
  // UPDATING THE DATE OF SALE IF PROVIDED
  if (date !== undefined) quickSale.date = date.trim();
  // UPDATING THE NOTE OF SALE IF PROVIDED
  if (note !== undefined) quickSale.note = note?.trim() || null;
  // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES BEFORE RECOMPUTING TOTAL
  if (
    !Number.isFinite(quickSale.quantity) ||
    !Number.isFinite(quickSale.rate) ||
    quickSale.quantity <= 0 ||
    quickSale.rate <= 0
  ) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Quantity and Rate must be Valid Positive Numbers!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // ALWAYS RECOMPUTE TOTAL FROM FINAL QUANTITY AND RATE — CONSISTENT WITH addQuickSale
  quickSale.total = parseFloat(
    (quickSale.quantity * quickSale.rate).toFixed(2),
  );
  // SAVING UPDATED QUICK SALE
  await quickSale.save();
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Quick Sale Updated Successfully!",
    success: true,
    data: { quickSale },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE A QUICK SALE RECORD
 * RESPECTS THE ACCOUNT'S DELETION MODE PREFERENCE — MOVED TO TRASH OR HARD-DELETED
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE QUICK SALE ==>
export const deleteQuickSale = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING QUICK SALE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING QUICK SALE AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const quickSale = await QuickSale.findOne({ _id: id, accountId }).exec();
  // IF QUICK SALE NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!quickSale) {
    // RETURNING NOT FOUND RESPONSE
    res
      .status(404)
      .json({ message: "Quick Sale Record Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // REMOVING QUICK SALE (RESPECTS ACCOUNT DELETION MODE PREFERENCE)
  const { trashed } = await removeDocument({
    accountId,
    entityType: TRASH_ENTITY_TYPES.QUICK_SALE,
    document: quickSale,
    performedBy,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: trashed
      ? "Quick Sale Record Moved to Trash!"
      : "Quick Sale Record Deleted Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
