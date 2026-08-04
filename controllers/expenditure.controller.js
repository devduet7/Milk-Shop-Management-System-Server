// <== IMPORTS ==>
import mongoose from "mongoose";
import expressAsyncHandler from "express-async-handler";
import { Expenditure } from "../models/expenditure.model.js";
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

// <== HELPER: GET WEEK START DATE STRING (LAST 7 DAYS INCLUDING TODAY) ==>
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
  filter,
  monthStr,
  specificDate,
  rangeStart,
  rangeEnd,
) => {
  // GET TODAY DATE STRING
  const today = getTodayDateStr();
  // SWITCH ON FILTER TYPE
  switch (filter) {
    // TODAY FILTER: SINGLE DAY RANGE
    case "today":
      return { startDate: today, endDate: today };
    // WEEK FILTER: LAST 7 DAYS INCLUDING TODAY
    case "week":
      return { startDate: getWeekStartDateStr(), endDate: today };
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
    // MONTH FILTER: FULL CALENDAR MONTH (USES monthStr PARAM)
    case "month":
    // DEFAULT: FULL CALENDAR MONTH
    default:
      // GUARDING AGAINST INVALID MONTH STRING FORMAT (YYYY-MM) AND FALLING BACK TO CURRENT MONTH
      return getMonthDateRange(monthStr);
  }
};

// <== HELPER: BUILD EXPENDITURE MATCH QUERY ==>
const buildMatchQuery = (accountId, startDate, endDate, category, search) => {
  // BASE QUERY WITH ACCOUNT ID AND DATE RANGE
  const matchQuery = {
    // CONVERTING ACCOUNT ID TO OBJECT ID
    accountId: new mongoose.Types.ObjectId(accountId),
    // APPLYING DATE RANGE
    date: { $gte: startDate, $lte: endDate },
  };
  // APPLYING CATEGORY FILTER IF PROVIDED
  if (category) matchQuery.category = category;
  // APPLYING SEARCH FILTER IF PROVIDED (CASE-INSENSITIVE ON TITLE)
  if (search) matchQuery.title = { $regex: search, $options: "i" };
  // RETURNING BUILT MATCH QUERY
  return matchQuery;
};

// <== HELPER: BUILD STATS FROM AGGREGATION RESULT ==>
const buildStats = (facetResult) => {
  // EXTRACTING TOTALS FROM FACET RESULT
  const totalsData = facetResult?.totals?.[0] || null;
  // EXTRACTING CATEGORY BREAKDOWN FROM FACET RESULT
  const byCategoryArr = facetResult?.byCategory || [];
  // BUILDING CATEGORY BREAKDOWN OBJECT FROM ARRAY
  const categoryBreakdown = {};
  // LOOPING THROUGH CATEGORY ARRAY TO BUILD OBJECT
  byCategoryArr.forEach(({ _id, amount, count }) => {
    // POPULATING CATEGORY BREAKDOWN ENTRY
    categoryBreakdown[_id] = {
      amount: parseFloat(amount.toFixed(2)),
      count,
    };
  });
  // RETURNING FORMATTED STATS OBJECT
  return {
    totalAmount: parseFloat((totalsData?.totalAmount || 0).toFixed(2)),
    totalCount: totalsData?.totalCount || 0,
    avgAmount: parseFloat((totalsData?.avgAmount || 0).toFixed(2)),
    highestAmount: parseFloat((totalsData?.highestAmount || 0).toFixed(2)),
    categoryBreakdown,
  };
};

/**
 * GET EXPENDITURES WITH PAGINATION, FILTERS, AND PERIOD STATS
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET EXPENDITURES ==>
export const getExpenditures = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING FILTER TYPE FROM QUERY (TODAY | WEEK | MONTH | DATE | RANGE) — DEFAULTS TO MONTH
  const filter = req.query.filter || "month";
  // GETTING MONTH STRING FOR MONTH FILTER (DEFAULTS TO CURRENT MONTH)
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING SPECIFIC DATE FOR THE DATE FILTER (YYYY-MM-DD)
  const specificDate = req.query.date || null;
  // GETTING RANGE START FOR THE RANGE FILTER (YYYY-MM-DD)
  const rangeStart = req.query.rangeStart || null;
  // GETTING RANGE END FOR THE RANGE FILTER (YYYY-MM-DD)
  const rangeEnd = req.query.rangeEnd || null;
  // GETTING CATEGORY FILTER FROM QUERY
  const category = req.query.category?.trim() || "";
  // GETTING SEARCH QUERY FROM REQUEST
  const search = req.query.search?.trim() || "";
  // PARSING PAGE NUMBER FROM QUERY (DEFAULTS TO 1)
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING LIMIT FROM QUERY (DEFAULTS TO 10, MAX 100)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  // CALCULATING SKIP VALUE FOR PAGINATION
  const skip = (page - 1) * limit;
  // GETTING DATE RANGE FOR SELECTED FILTER
  const { startDate, endDate } = getDateRangeForFilter(
    filter,
    monthStr,
    specificDate,
    rangeStart,
    rangeEnd,
  );
  // BUILDING BASE MATCH QUERY
  const matchQuery = buildMatchQuery(
    accountId,
    startDate,
    endDate,
    category,
    search,
  );
  // RUNNING STATS AGGREGATION AND PAGINATED RECORDS FETCH IN PARALLEL
  const [statsAggregation, records, totalCount] = await Promise.all([
    // AGGREGATION: STATS FOR THE SELECTED PERIOD (NOT PAGINATED — ALWAYS FULL TOTALS)
    Expenditure.aggregate([
      // MATCHING DOCUMENTS AGAINST BUILT QUERY
      { $match: matchQuery },
      // FACET: RUN MULTIPLE AGGREGATION PIPELINES IN PARALLEL
      {
        $facet: {
          // PIPELINE 1: OVERALL TOTALS
          totals: [
            {
              $group: {
                _id: null,
                totalAmount: { $sum: "$amount" },
                totalCount: { $sum: 1 },
                avgAmount: { $avg: "$amount" },
                highestAmount: { $max: "$amount" },
              },
            },
          ],
          // PIPELINE 2: BREAKDOWN BY CATEGORY
          byCategory: [
            {
              $group: {
                _id: "$category",
                amount: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
            // SORTING BY AMOUNT DESCENDING
            { $sort: { amount: -1 } },
          ],
        },
      },
    ]),
    // PAGINATED RECORDS: SORTED BY DATE DESC THEN CREATION TIME DESC
    Expenditure.find(matchQuery)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    // TOTAL COUNT FOR PAGINATION META
    Expenditure.countDocuments(matchQuery),
  ]);
  // BUILDING STATS OBJECT FROM AGGREGATION RESULT
  const stats = buildStats(statsAggregation[0]);
  // CALCULATING TOTAL PAGES FOR PAGINATION
  const totalPages = Math.ceil(totalCount / limit);
  // RETURNING SUCCESS RESPONSE WITH RECORDS, PAGINATION, STATS, AND FILTER INFO
  res.status(200).json({
    message: "Expenditures Fetched Successfully!",
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
        type: filter,
        month: filter === "month" ? monthStr : null,
        date: filter === "date" ? specificDate : null,
        startDate,
        endDate,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * ADD A NEW EXPENDITURE RECORD
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD EXPENDITURE ==>
export const addExpenditure = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING EXPENDITURE DATA FROM REQUEST BODY
  const { title, category, amount, date, note } = req.body;
  // PARSING AMOUNT AS FLOAT
  const parsedAmount = parseFloat(amount);
  // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES BEFORE STORING
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Amount must be a Valid Positive Number!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // RESOLVING DATE (DEFAULT TO TODAY IF NOT PROVIDED)
  const resolvedDate = date?.trim() || getTodayDateStr();
  // CREATING NEW EXPENDITURE RECORD IN DATABASE
  const expenditure = await Expenditure.create({
    accountId,
    performedBy,
    title: title.trim(),
    category,
    amount: parsedAmount,
    date: resolvedDate,
    note: note?.trim() || null,
  });
  // RETURNING SUCCESS RESPONSE WITH CREATED EXPENDITURE
  res.status(201).json({
    message: "Expenditure Added Successfully!",
    success: true,
    data: { expenditure },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE AN EXISTING EXPENDITURE RECORD
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE EXPENDITURE ==>
export const updateExpenditure = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING EXPENDITURE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING UPDATE DATA FROM REQUEST BODY
  const { title, category, amount, date, note } = req.body;
  // FINDING EXPENDITURE AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const expenditure = await Expenditure.findOne({ _id: id, accountId }).exec();
  // IF EXPENDITURE NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!expenditure) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Expenditure Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // UPDATING TITLE IF PROVIDED
  if (title !== undefined) expenditure.title = title.trim();
  // UPDATING CATEGORY IF PROVIDED
  if (category !== undefined) expenditure.category = category;
  // UPDATING AMOUNT IF PROVIDED
  if (amount !== undefined) {
    // PARSING AMOUNT AS FLOAT
    const parsedAmount = parseFloat(amount);
    // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      // RETURNING ERROR RESPONSE
      res.status(400).json({
        message: "Amount must be a Valid Positive Number!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // APPLYING PARSED AMOUNT
    expenditure.amount = parsedAmount;
  }
  // UPDATING DATE IF PROVIDED
  if (date !== undefined) expenditure.date = date.trim();
  // UPDATING NOTE IF PROVIDED (ALLOW CLEARING TO NULL)
  if (note !== undefined) expenditure.note = note?.trim() || null;
  // SAVING UPDATED EXPENDITURE TO DATABASE
  await expenditure.save();
  // RETURNING SUCCESS RESPONSE WITH UPDATED EXPENDITURE
  res.status(200).json({
    message: "Expenditure Updated Successfully!",
    success: true,
    data: { expenditure },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE AN EXPENDITURE RECORD
 * RESPECTS THE ACCOUNT'S DELETION MODE PREFERENCE — MOVED TO TRASH OR HARD-DELETED
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE EXPENDITURE ==>
export const deleteExpenditure = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING EXPENDITURE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING EXPENDITURE AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const expenditure = await Expenditure.findOne({ _id: id, accountId }).exec();
  // IF EXPENDITURE NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!expenditure) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Expenditure Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // REMOVING EXPENDITURE (RESPECTS ACCOUNT DELETION MODE PREFERENCE)
  const { trashed } = await removeDocument({
    accountId,
    entityType: TRASH_ENTITY_TYPES.EXPENDITURE,
    document: expenditure,
    performedBy,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: trashed
      ? "Expenditure Moved to Trash!"
      : "Expenditure Deleted Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
