// <== IMPORTS ==>
import mongoose from "mongoose";
import { Purchase } from "../models/purchase.model.js";
import expressAsyncHandler from "express-async-handler";

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
const getDateRangeForFilter = (filter, monthStr) => {
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
    // MONTH FILTER: FULL CALENDAR MONTH (USES monthStr PARAM)
    case "month":
    // DEFAULT: FULL CALENDAR MONTH
    default:
      return getMonthDateRange(monthStr);
  }
};

// <== HELPER: BUILD PURCHASE MATCH QUERY ==>
const buildMatchQuery = (userId, startDate, endDate, search) => {
  // BASE QUERY WITH USER ID AND DATE RANGE
  const matchQuery = {
    // CONVERTING USER ID TO OBJECT ID
    userId: new mongoose.Types.ObjectId(userId),
    // APPLYING DATE RANGE
    date: { $gte: startDate, $lte: endDate },
  };
  // APPLYING SUPPLIER SEARCH FILTER IF PROVIDED (CASE-INSENSITIVE)
  if (search) matchQuery.supplier = { $regex: search, $options: "i" };
  // RETURNING BUILT MATCH QUERY
  return matchQuery;
};

// <== HELPER: BUILD STATS FROM AGGREGATION RESULT ==>
const buildStats = (facetResult) => {
  // EXTRACTING TOTALS FROM FACET RESULT
  const totalsData = facetResult?.totals?.[0] || null;
  // EXTRACTING SUPPLIER BREAKDOWN FROM FACET RESULT
  const bySupplierArr = facetResult?.bySupplier || [];
  // BUILDING SUPPLIER BREAKDOWN OBJECT FROM ARRAY
  const supplierBreakdown = {};
  // LOOPING THROUGH SUPPLIER ARRAY TO BUILD OBJECT
  bySupplierArr.forEach(({ _id, totalCost, totalMilk, count }) => {
    // POPULATING SUPPLIER BREAKDOWN ENTRY
    supplierBreakdown[_id] = {
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalMilk: parseFloat(totalMilk.toFixed(3)),
      count,
    };
  });
  // EXTRACTING TOTAL SPENT FROM AGGREGATION
  const totalSpent = parseFloat((totalsData?.totalSpent || 0).toFixed(2));
  // EXTRACTING TOTAL MILK FROM AGGREGATION
  const totalMilk = parseFloat((totalsData?.totalMilk || 0).toFixed(3));
  // EXTRACTING TOTAL PURCHASES COUNT FROM AGGREGATION
  const totalPurchases = totalsData?.totalPurchases || 0;
  // COMPUTING AVG COST PER LITER (TOTAL SPENT / TOTAL MILK — AVOIDS DIVISION BY ZERO)
  const avgCostPerLiter =
    totalMilk > 0 ? parseFloat((totalSpent / totalMilk).toFixed(2)) : 0;
  // RETURNING FORMATTED STATS OBJECT
  return {
    totalSpent,
    totalMilk,
    totalPurchases,
    avgCostPerLiter,
    supplierBreakdown,
  };
};

/**
 * GET PURCHASES WITH PAGINATION, FILTERS, AND PERIOD STATS
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET PURCHASES ==>
export const getPurchases = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING FILTER TYPE FROM QUERY (today | week | month) — DEFAULTS TO MONTH
  const filter = req.query.filter || "month";
  // GETTING MONTH STRING FOR MONTH FILTER (DEFAULTS TO CURRENT MONTH)
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING SEARCH QUERY FROM REQUEST (SEARCHES BY SUPPLIER NAME)
  const search = req.query.search?.trim() || "";
  // PARSING PAGE NUMBER FROM QUERY (DEFAULTS TO 1)
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING LIMIT FROM QUERY (DEFAULTS TO 10, MAX 100)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  // CALCULATING SKIP VALUE FOR PAGINATION
  const skip = (page - 1) * limit;
  // GETTING DATE RANGE FOR SELECTED FILTER
  const { startDate, endDate } = getDateRangeForFilter(filter, monthStr);
  // BUILDING BASE MATCH QUERY
  const matchQuery = buildMatchQuery(userId, startDate, endDate, search);
  // RUNNING STATS AGGREGATION AND PAGINATED RECORDS FETCH IN PARALLEL
  const [statsAggregation, records, totalCount] = await Promise.all([
    // AGGREGATION: STATS FOR THE SELECTED PERIOD (NOT PAGINATED — ALWAYS FULL TOTALS)
    Purchase.aggregate([
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
                totalSpent: { $sum: "$totalCost" },
                totalMilk: { $sum: "$milkQuantity" },
                totalPurchases: { $sum: 1 },
              },
            },
          ],
          // PIPELINE 2: BREAKDOWN BY SUPPLIER
          bySupplier: [
            {
              $group: {
                _id: "$supplier",
                totalCost: { $sum: "$totalCost" },
                totalMilk: { $sum: "$milkQuantity" },
                count: { $sum: 1 },
              },
            },
            // SORTING BY TOTAL COST DESCENDING
            { $sort: { totalCost: -1 } },
          ],
        },
      },
    ]),
    // PAGINATED RECORDS: SORTED BY DATE DESC THEN CREATION TIME DESC
    Purchase.find(matchQuery)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    // TOTAL COUNT FOR PAGINATION META
    Purchase.countDocuments(matchQuery),
  ]);
  // BUILDING STATS OBJECT FROM AGGREGATION RESULT
  const stats = buildStats(statsAggregation[0]);
  // CALCULATING TOTAL PAGES FOR PAGINATION
  const totalPages = Math.ceil(totalCount / limit);
  // RETURNING SUCCESS RESPONSE WITH RECORDS, PAGINATION, STATS, AND FILTER INFO
  res.status(200).json({
    message: "Purchases Fetched Successfully!",
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
        startDate,
        endDate,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * ADD A NEW PURCHASE RECORD
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD PURCHASE ==>
export const addPurchase = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING PURCHASE DATA FROM REQUEST BODY
  const { supplier, milkQuantity, totalCost, date, note } = req.body;
  // PARSING MILK QUANTITY AS FLOAT
  const parsedMilk = parseFloat(milkQuantity);
  // PARSING TOTAL COST AS FLOAT
  const parsedCost = parseFloat(totalCost);
  // COMPUTING PRICE PER LITER FROM COST AND QUANTITY
  const pricePerLiter = parseFloat((parsedCost / parsedMilk).toFixed(4));
  // RESOLVING DATE (DEFAULT TO TODAY IF NOT PROVIDED)
  const resolvedDate = date?.trim() || getTodayDateStr();
  // CREATING NEW PURCHASE RECORD IN DATABASE
  const purchase = await Purchase.create({
    userId,
    supplier: supplier.trim(),
    milkQuantity: parsedMilk,
    totalCost: parsedCost,
    pricePerLiter,
    date: resolvedDate,
    note: note?.trim() || null,
  });
  // RETURNING SUCCESS RESPONSE WITH CREATED PURCHASE
  res.status(201).json({
    message: "Purchase Added Successfully!",
    success: true,
    data: { purchase },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE AN EXISTING PURCHASE RECORD
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE PURCHASE ==>
export const updatePurchase = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING PURCHASE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING UPDATE DATA FROM REQUEST BODY
  const { supplier, milkQuantity, totalCost, date, note } = req.body;
  // FINDING PURCHASE AND VERIFYING OWNERSHIP
  const purchase = await Purchase.findOne({ _id: id, userId }).exec();
  // IF PURCHASE NOT FOUND OR DOES NOT BELONG TO THIS USER
  if (!purchase) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Purchase Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // UPDATING SUPPLIER IF PROVIDED
  if (supplier !== undefined) purchase.supplier = supplier.trim();
  // UPDATING MILK QUANTITY IF PROVIDED
  if (milkQuantity !== undefined)
    purchase.milkQuantity = parseFloat(milkQuantity);
  // UPDATING TOTAL COST IF PROVIDED
  if (totalCost !== undefined) purchase.totalCost = parseFloat(totalCost);
  // RECOMPUTING PRICE PER LITER WHENEVER COST OR QUANTITY CHANGES
  if (milkQuantity !== undefined || totalCost !== undefined) {
    // RECOMPUTE USING FINAL VALUES AFTER UPDATES ABOVE
    purchase.pricePerLiter = parseFloat(
      (purchase.totalCost / purchase.milkQuantity).toFixed(4),
    );
  }
  // UPDATING DATE IF PROVIDED
  if (date !== undefined) purchase.date = date.trim();
  // UPDATING NOTE IF PROVIDED (ALLOW CLEARING TO NULL)
  if (note !== undefined) purchase.note = note?.trim() || null;
  // SAVING UPDATED PURCHASE TO DATABASE
  await purchase.save();
  // RETURNING SUCCESS RESPONSE WITH UPDATED PURCHASE
  res.status(200).json({
    message: "Purchase Updated Successfully!",
    success: true,
    data: { purchase },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE A PURCHASE RECORD
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE PURCHASE ==>
export const deletePurchase = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING PURCHASE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING PURCHASE AND VERIFYING OWNERSHIP BEFORE DELETION
  const purchase = await Purchase.findOne({ _id: id, userId }).lean().exec();
  // IF PURCHASE NOT FOUND OR DOES NOT BELONG TO THIS USER
  if (!purchase) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Purchase Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETING PURCHASE RECORD FROM DATABASE
  await Purchase.deleteOne({ _id: id });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Purchase Deleted Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
