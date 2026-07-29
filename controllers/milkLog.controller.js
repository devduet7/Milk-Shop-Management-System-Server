// <== IMPORTS ==>
import mongoose from "mongoose";
import { MilkLog } from "../models/milkLog.model.js";
import expressAsyncHandler from "express-async-handler";
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
  // CALCULATING LAST DAY OF MONTH (DAY 0 OF NEXT MONTH = LAST DAY OF CURRENT MONTH)
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
  // CALCULATE DATE 6 DAYS BEFORE TODAY (7-DAY WINDOW INCLUDING TODAY)
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
      // RETURNING THE TODAY RANGE
      return { startDate: today, endDate: today };
    // WEEK FILTER: LAST 7 DAYS INCLUDING TODAY
    case "week":
      // RETURNING THE WEEK RANGE
      return { startDate: getWeekStartDateStr(), endDate: today };
    // MONTH FILTER: FULL CALENDAR MONTH
    case "month":
      // RETURNING THE MONTH RANGE
      return getMonthDateRange(monthStr);
    // DATE FILTER: SPECIFIC SINGLE DAY
    case "date":
      // RETURNING THE SPECIFIC DATE RANGE
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
      // RETURNING SINGLE DAY RANGE
      return { startDate: today, endDate: today };
  }
};

/**
 * GET MILK LOG ENTRIES WITH STATS FOR THE SELECTED FILTER AND TYPE
 * STATS ARE ALWAYS COMPUTED ACROSS THE FULL FILTERED DATASET REGARDLESS OF PAGE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET MILK LOGS ==>
export const getMilkLogs = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING FILTER TYPE (TODAY | WEEK | MONTH | DATE | RANGE) — DEFAULTS TO TODAY
  const filterType = req.query.filterType || "today";
  // GETTING SPECIFIC DATE FOR THE DATE FILTER (YYYY-MM-DD)
  const specificDate = req.query.date || null;
  // GETTING MONTH STRING FOR THE MONTH FILTER — DEFAULTS TO CURRENT MONTH
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING RANGE START FOR THE RANGE FILTER (YYYY-MM-DD)
  const rangeStart = req.query.rangeStart || null;
  // GETTING RANGE END FOR THE RANGE FILTER (YYYY-MM-DD)
  const rangeEnd = req.query.rangeEnd || null;
  // GETTING ENTRY TYPE FILTER (ALL | LEFTOVER | YOGHURT) — DEFAULTS TO ALL
  const entryType = req.query.type || "all";
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
  const matchQuery = {
    accountId: accountObjectId,
    date: { $gte: startDate, $lte: endDate },
  };
  // APPLYING ENTRY TYPE FILTER WHEN NOT ALL — STATS BELOW REFLECT THIS SAME FILTERED SET
  if (entryType !== "all") matchQuery.type = entryType;
  // RUNNING STATS AGGREGATION, COUNT, AND PAGINATED RECORDS FETCH IN PARALLEL
  const [statsAgg, totalCount, records] = await Promise.all([
    // STATS AGGREGATION ACROSS THE FULL MATCHING DATASET (NOT PAGINATED)
    MilkLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalLeftover: {
            $sum: { $cond: [{ $eq: ["$type", "leftover"] }, "$quantity", 0] },
          },
          totalYoghurt: {
            $sum: { $cond: [{ $eq: ["$type", "yoghurt"] }, "$quantity", 0] },
          },
          totalEntries: { $sum: 1 },
        },
      },
    ]),
    // TOTAL COUNT FOR PAGINATION METADATA
    MilkLog.countDocuments(matchQuery),
    // PAGINATED RECORDS SORTED BY DATE DESC THEN CREATION TIME DESC
    MilkLog.find(matchQuery)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);
  // EXTRACTING RAW STATS WITH FALLBACK
  const raw = statsAgg[0] || {};
  // EXTRACTING TOTAL LEFTOVER
  const totalLeftover = parseFloat((raw.totalLeftover ?? 0).toFixed(3));
  // EXTRACTING TOTAL YOGHURT
  const totalYoghurt = parseFloat((raw.totalYoghurt ?? 0).toFixed(3));
  // COMPUTING COMBINED LOGGED VOLUME FOR SHARE CALCULATION
  const combinedVolume = totalLeftover + totalYoghurt;
  // BUILDING STATS OBJECT WITH SAFE PRECISION
  const stats = {
    totalLeftover,
    totalYoghurt,
    totalEntries: raw.totalEntries ?? 0,
    // SHARE OF LOGGED VOLUME THAT WENT TO YOGHURT — AVOIDS DIVISION BY ZERO
    yoghurtSharePercent:
      combinedVolume > 0
        ? parseFloat(((totalYoghurt / combinedVolume) * 100).toFixed(1))
        : 0,
  };
  // CALCULATING TOTAL PAGES
  const totalPages = Math.ceil(totalCount / limit);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Milk Log Entries Fetched Successfully!",
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
 * ADD A NEW MILK LOG ENTRY
 * date DEFAULTS TO TODAY IF NOT PROVIDED BY THE CLIENT
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD MILK LOG ==>
export const addMilkLog = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING MILK LOG DATA FROM REQUEST BODY
  const { type, quantity, date, note } = req.body;
  // PARSING QUANTITY AS FLOAT
  const parsedQuantity = parseFloat(quantity);
  // GUARDING AGAINST NON-FINITE OR NEGATIVE VALUES — ZERO IS VALID
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Quantity must be a Valid Non-Negative Number!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // RESOLVING DATE (DEFAULT TO TODAY IF NOT PROVIDED)
  const resolvedDate = date?.trim() || getTodayDateStr();
  // CREATING NEW MILK LOG ENTRY IN DATABASE
  const milkLog = await MilkLog.create({
    accountId,
    performedBy,
    type,
    quantity: parsedQuantity,
    date: resolvedDate,
    note: note?.trim() || null,
  });
  // RETURNING SUCCESS RESPONSE WITH CREATED MILK LOG ENTRY
  res.status(201).json({
    message: "Milk Log Entry Added Successfully!",
    success: true,
    data: { milkLog },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE AN EXISTING MILK LOG ENTRY
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE MILK LOG ==>
export const updateMilkLog = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING MILK LOG ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING UPDATE DATA FROM REQUEST BODY
  const { type, quantity, date, note } = req.body;
  // FINDING MILK LOG ENTRY AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const milkLog = await MilkLog.findOne({ _id: id, accountId }).exec();
  // IF MILK LOG ENTRY NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!milkLog) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Milk Log Entry Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // UPDATING TYPE IF PROVIDED
  if (type !== undefined) milkLog.type = type;
  // RESOLVING THE QUANTITY VALUE THAT WILL BE SAVED
  if (quantity !== undefined) {
    // PARSING QUANTITY AS FLOAT
    const parsedQuantity = parseFloat(quantity);
    // GUARDING AGAINST NON-FINITE OR NEGATIVE VALUES — ZERO IS VALID
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      // RETURNING ERROR RESPONSE
      res.status(400).json({
        message: "Quantity must be a Valid Non-Negative Number!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // APPLYING THE PARSED QUANTITY
    milkLog.quantity = parsedQuantity;
  }
  // UPDATING DATE IF PROVIDED
  if (date !== undefined) milkLog.date = date.trim();
  // UPDATING NOTE IF PROVIDED (ALLOW CLEARING TO NULL)
  if (note !== undefined) milkLog.note = note?.trim() || null;
  // SAVING UPDATED MILK LOG ENTRY TO DATABASE
  await milkLog.save();
  // RETURNING SUCCESS RESPONSE WITH UPDATED MILK LOG ENTRY
  res.status(200).json({
    message: "Milk Log Entry Updated Successfully!",
    success: true,
    data: { milkLog },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE A MILK LOG ENTRY
 * RESPECTS THE ACCOUNT'S DELETION MODE PREFERENCE — MOVED TO TRASH OR HARD-DELETED
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE MILK LOG ==>
export const deleteMilkLog = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING MILK LOG ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING MILK LOG ENTRY AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const milkLog = await MilkLog.findOne({ _id: id, accountId }).exec();
  // IF MILK LOG ENTRY NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!milkLog) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Milk Log Entry Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // REMOVING MILK LOG ENTRY
  const { trashed } = await removeDocument({
    accountId,
    entityType: TRASH_ENTITY_TYPES.MILK_LOG,
    document: milkLog,
    performedBy,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: trashed
      ? "Milk Log Entry Moved to Trash!"
      : "Milk Log Entry Deleted Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
