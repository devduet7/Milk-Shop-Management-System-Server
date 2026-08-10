// <== IMPORTS ==>
import mongoose from "mongoose";
import { Sale } from "../models/sale.model.js";
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
    // MONTH FILTER: FULL CALENDAR MONTH
    case "month":
    // DEFAULT: FULL CALENDAR MONTH
    default:
      // RETURNING DATE RANGE FOR THE SPECIFIED MONTH STRING (OR CURRENT MONTH IF NOT PROVIDED)
      return getMonthDateRange(monthStr);
  }
};

// <== HELPER: BUILD COMBINED STATS FROM AGGREGATION RESULT ==>
const buildStats = (facetResult) => {
  // EXTRACTING TOTALS FROM FACET RESULT
  const totalsData = facetResult?.totals?.[0] || null;
  // RETURNING FORMATTED STATS OBJECT
  return {
    totalRevenue: parseFloat((totalsData?.totalRevenue || 0).toFixed(2)),
    totalMilkSold: parseFloat((totalsData?.totalMilkSold || 0).toFixed(3)),
    totalYoghurtSold: parseFloat(
      (totalsData?.totalYoghurtSold || 0).toFixed(3),
    ),
    totalPending: parseFloat((totalsData?.totalPending || 0).toFixed(2)),
    totalDiscount: parseFloat((totalsData?.totalDiscount || 0).toFixed(2)),
    totalSales: totalsData?.totalSales || 0,
  };
};

/**
 * GET SALES WITH PAGINATION, FILTERS, AND COMBINED PERIOD STATS
 * STATS ALWAYS REFLECT ALL SALE TYPES FOR THE PERIOD — NOT SCOPED TO SINGLE SALE TYPE PARAM
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET SALES ==>
export const getSales = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING SALE TYPE FROM QUERY (CUSTOMER | SHOP) — REQUIRED FOR RECORD FETCHING
  const saleType = req.query.saleType;
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
  // GETTING SEARCH QUERY FROM REQUEST (CUSTOMER NAME SEARCH — CUSTOMER SALES ONLY)
  const search = req.query.search?.trim() || "";
  // GETTING PENDING ONLY FLAG (CUSTOMER SALES ONLY — FILTERS FOR PENDING AMOUNT > 0)
  const pendingOnly = req.query.pendingOnly === "true";
  // GETTING PRODUCT TYPE FILTER (SHOP SALES ONLY)
  const productType = req.query.productType?.trim() || "";
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
  // CONVERTING ACCOUNT ID TO OBJECT ID FOR AGGREGATION PIPELINE USE
  const accountObjectId = new mongoose.Types.ObjectId(accountId);
  // BUILDING STATS MATCH QUERY
  const statsMatchQuery = {
    accountId: accountObjectId,
    date: { $gte: startDate, $lte: endDate },
  };
  // BUILDING RECORD MATCH QUERY (FILTERED BY SALE TYPE + TYPE-SPECIFIC FILTERS)
  const recordMatchQuery = {
    accountId: accountObjectId,
    saleType,
    date: { $gte: startDate, $lte: endDate },
  };
  // APPLYING CUSTOMER-SPECIFIC FILTERS
  if (saleType === "customer") {
    // APPLYING SEARCH FILTER ON CUSTOMER NAME IF PROVIDED (CASE-INSENSITIVE)
    if (search)
      recordMatchQuery.customerName = { $regex: search, $options: "i" };
    // APPLYING PENDING ONLY FILTER IF REQUESTED
    if (pendingOnly) recordMatchQuery.pendingAmount = { $gt: 0 };
  }
  // APPLYING SHOP-SPECIFIC FILTERS
  if (saleType === "shop") {
    // APPLYING PRODUCT TYPE FILTER IF PROVIDED
    if (productType) recordMatchQuery.productType = productType;
  }
  // RUNNING STATS AGGREGATION, PAGINATED RECORDS, AND COUNT IN PARALLEL
  const [statsAggregation, records, totalCount] = await Promise.all([
    // AGGREGATION: COMBINED STATS FOR THE PERIOD (NOT PAGINATED — ALL SALE TYPES ACROSS THE WHOLE ACCOUNT)
    Sale.aggregate([
      // MATCHING DOCUMENTS AGAINST STATS QUERY (ALL SALE TYPES)
      { $match: statsMatchQuery },
      // FACET: RUN MULTIPLE AGGREGATION PIPELINES IN PARALLEL
      {
        $facet: {
          // PIPELINE 1: OVERALL COMBINED TOTALS
          totals: [
            {
              $group: {
                _id: null,
                // TOTAL REVENUE ACROSS ALL SALES
                totalRevenue: { $sum: "$totalAmount" },
                // TOTAL MILK SOLD IN LITERS (ALL SALE TYPES)
                totalMilkSold: {
                  $sum: {
                    $cond: [{ $eq: ["$productType", "milk"] }, "$quantity", 0],
                  },
                },
                // TOTAL YOGHURT SOLD IN KG (ALL SALE TYPES)
                totalYoghurtSold: {
                  $sum: {
                    $cond: [
                      { $eq: ["$productType", "yoghurt"] },
                      "$quantity",
                      0,
                    ],
                  },
                },
                // TOTAL PENDING BALANCE (CUSTOMER SALES ONLY — SHOP IS ALWAYS 0)
                totalPending: { $sum: "$pendingAmount" },
                // TOTAL DISCOUNT GIVEN ACROSS THE PERIOD — SO THE OWNER CAN SEE WHAT WAS GIVEN AWAY
                totalDiscount: { $sum: "$discount" },
                // TOTAL SALE COUNT
                totalSales: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
    // PAGINATED RECORDS: SORTED BY DATE DESC THEN CREATION TIME DESC
    Sale.find(recordMatchQuery)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    // TOTAL COUNT FOR PAGINATION META
    Sale.countDocuments(recordMatchQuery),
  ]);
  // BUILDING STATS OBJECT FROM AGGREGATION RESULT
  const stats = buildStats(statsAggregation[0]);
  // CALCULATING TOTAL PAGES FOR PAGINATION
  const totalPages = Math.ceil(totalCount / limit);
  // RETURNING SUCCESS RESPONSE WITH RECORDS, PAGINATION, STATS, AND FILTER INFO
  res.status(200).json({
    message: "Sales Fetched Successfully!",
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
 * ADD A NEW SALE RECORD
 * SHOP SALES ARE ALWAYS FULLY PAID (PAID AMOUNT = TOTAL AMOUNT, PENDING AMOUNT = 0)
 * CUSTOMER SALES SUPPORT PARTIAL PAYMENT (PENDING AMOUNT = TOTAL AMOUNT - PAID AMOUNT)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD SALE ==>
export const addSale = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING SALE DATA FROM REQUEST BODY
  const {
    saleType,
    customerName,
    productType,
    quantity,
    pricePerUnit,
    discount,
    paidAmount,
    date,
    note,
  } = req.body;
  // PARSING QUANTITY AS FLOAT
  const parsedQuantity = parseFloat(quantity);
  // PARSING PRICE PER UNIT AS FLOAT
  const parsedPricePerUnit = parseFloat(pricePerUnit);
  // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES BEFORE MULTIPLYING
  if (
    !Number.isFinite(parsedQuantity) ||
    !Number.isFinite(parsedPricePerUnit) ||
    parsedQuantity <= 0 ||
    parsedPricePerUnit <= 0
  ) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Quantity and Price per Unit must be Valid Positive Numbers!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // COMPUTING SUBTOTAL FROM QUANTITY AND PRICE PER UNIT — BEFORE DISCOUNT
  const subtotal = parseFloat((parsedQuantity * parsedPricePerUnit).toFixed(2));
  // PARSING DISCOUNT AS FLOAT — DEFAULTS TO 0 IF NOT PROVIDED
  const parsedDiscount = discount !== undefined ? parseFloat(discount) : 0;
  // GUARDING AGAINST A NON-FINITE OR NEGATIVE DISCOUNT
  if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Discount must be a Valid Non-Negative Number!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GUARDING AGAINST A DISCOUNT LARGER THAN THE SUBTOTAL
  if (parsedDiscount > subtotal) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: `Discount cannot Exceed the Subtotal of ₨${subtotal.toLocaleString()}!`,
      success: false,
      data: { subtotal },
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // COMPUTING TOTAL AMOUNT — THE NET, BILLABLE AMOUNT AFTER DISCOUNT
  const totalAmount = parseFloat((subtotal - parsedDiscount).toFixed(2));
  // RESOLVING DATE (DEFAULT TO TODAY IF NOT PROVIDED)
  const resolvedDate = date?.trim() || getTodayDateStr();
  // DECLARING RESOLVED PAID AMOUNT
  let resolvedPaidAmount;
  // DECLARING RESOLVED PENDING AMOUNT
  let resolvedPendingAmount;
  // SHOP SALES ARE ALWAYS FULLY PAID — OVERRIDE ANY PROVIDED PAID AMOUNT
  if (saleType === "shop") {
    // SET PAID TO TOTAL FOR SHOP SALES
    resolvedPaidAmount = totalAmount;
    // NO PENDING FOR SHOP SALES
    resolvedPendingAmount = 0;
  } else {
    // CUSTOMER SALES: PARSE PROVIDED PAID AMOUNT (DEFAULT 0 IF NOT PROVIDED)
    resolvedPaidAmount = paidAmount !== undefined ? parseFloat(paidAmount) : 0;
    // VALIDATE PAID AMOUNT DOES NOT EXCEED TOTAL AMOUNT
    if (resolvedPaidAmount > totalAmount) {
      // RETURNING VALIDATION ERROR
      res.status(400).json({
        message: `Paid Amount cannot Exceed the Total Amount of ₨${totalAmount.toLocaleString()}!`,
        success: false,
        data: { totalAmount },
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // COMPUTING PENDING AMOUNT (CANNOT BE NEGATIVE)
    resolvedPendingAmount = parseFloat(
      Math.max(0, totalAmount - resolvedPaidAmount).toFixed(2),
    );
  }
  // CREATING NEW SALE RECORD IN DATABASE
  const sale = await Sale.create({
    accountId,
    performedBy,
    saleType,
    customerName: saleType === "customer" ? customerName?.trim() : null,
    productType,
    quantity: parsedQuantity,
    pricePerUnit: parsedPricePerUnit,
    subtotal,
    discount: parsedDiscount,
    totalAmount,
    paidAmount: resolvedPaidAmount,
    pendingAmount: resolvedPendingAmount,
    date: resolvedDate,
    note: note?.trim() || null,
  });
  // RETURNING SUCCESS RESPONSE WITH CREATED SALE
  res.status(201).json({
    message: "Sale Added Successfully!",
    success: true,
    data: { sale },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE AN EXISTING SALE RECORD
 * RECOMPUTES TOTAL AMOUNT IF QUANTITY OR PRICE PER UNIT CHANGES
 * RECOMPUTES PENDING AMOUNT AFTER ANY FINANCIAL FIELD UPDATE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE SALE ==>
export const updateSale = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING SALE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING UPDATE DATA FROM REQUEST BODY
  const {
    customerName,
    productType,
    quantity,
    pricePerUnit,
    discount,
    paidAmount,
    date,
    note,
  } = req.body;
  // FINDING SALE AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const sale = await Sale.findOne({ _id: id, accountId }).exec();
  // IF SALE NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!sale) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Sale Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // UPDATING CUSTOMER NAME IF PROVIDED (CUSTOMER SALES ONLY)
  if (customerName !== undefined && sale.saleType === "customer") {
    // SAVING AND TRIMMING CUSTOMER NAME
    sale.customerName = customerName.trim();
  }
  // UPDATING PRODUCT TYPE IF PROVIDED
  if (productType !== undefined) sale.productType = productType;
  // UPDATING QUANTITY IF PROVIDED
  if (quantity !== undefined) sale.quantity = parseFloat(quantity);
  // UPDATING PRICE PER UNIT IF PROVIDED
  if (pricePerUnit !== undefined) sale.pricePerUnit = parseFloat(pricePerUnit);
  // UPDATING DISCOUNT IF PROVIDED (MONEY, NEVER A PERCENTAGE)
  if (discount !== undefined) sale.discount = parseFloat(discount);
  // RECOMPUTING SUBTOTAL AND TOTAL AMOUNT WHENEVER QUANTITY, PRICE, OR DISCOUNT CHANGES
  if (
    quantity !== undefined ||
    pricePerUnit !== undefined ||
    discount !== undefined
  ) {
    // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES BEFORE MULTIPLYING
    if (
      !Number.isFinite(sale.quantity) ||
      !Number.isFinite(sale.pricePerUnit) ||
      sale.quantity <= 0 ||
      sale.pricePerUnit <= 0
    ) {
      // RETURNING ERROR RESPONSE
      res.status(400).json({
        message: "Quantity and Price per Unit must be Valid Positive Numbers!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // GUARDING AGAINST A NON-FINITE OR NEGATIVE DISCOUNT
    if (!Number.isFinite(sale.discount) || sale.discount < 0) {
      // RETURNING ERROR RESPONSE
      res.status(400).json({
        message: "Discount must be a Valid Non-Negative Number!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // RECOMPUTE SUBTOTAL USING FINAL POST-UPDATE VALUES OF QUANTITY AND PRICE
    sale.subtotal = parseFloat((sale.quantity * sale.pricePerUnit).toFixed(2));
    // GUARDING AGAINST A DISCOUNT LARGER THAN THE RECOMPUTED SUBTOTAL
    if (sale.discount > sale.subtotal) {
      // RETURNING ERROR RESPONSE WITH CURRENT SUBTOTAL
      res.status(400).json({
        message: `Discount cannot Exceed the Subtotal of ₨${sale.subtotal.toLocaleString()}!`,
        success: false,
        data: { subtotal: sale.subtotal },
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // RECOMPUTE TOTAL AMOUNT — THE NET, BILLABLE AMOUNT AFTER DISCOUNT
    sale.totalAmount = parseFloat((sale.subtotal - sale.discount).toFixed(2));
  }
  // RECOMPUTING PAYMENT FIELDS BASED ON SALE TYPE
  if (sale.saleType === "shop") {
    // SHOP SALES ALWAYS FULLY PAID — KEEP IN SYNC WITH TOTAL
    sale.paidAmount = sale.totalAmount;
    // NO PENDING FOR SHOP SALES
    sale.pendingAmount = 0;
  } else {
    // CUSTOMER SALES: UPDATE PAID AMOUNT IF PROVIDED
    if (paidAmount !== undefined) {
      // PARSING NEW PAID AMOUNT
      const parsedPaid = parseFloat(paidAmount);
      // VALIDATING PAID AMOUNT DOES NOT EXCEED UPDATED TOTAL AMOUNT
      if (parsedPaid > sale.totalAmount) {
        // RETURNING VALIDATION ERROR WITH CURRENT TOTAL
        res.status(400).json({
          message: `Paid Amount cannot Exceed the Total Amount of ₨${sale.totalAmount.toLocaleString()}!`,
          success: false,
          data: { totalAmount: sale.totalAmount },
        });
        // RETURNING FROM FUNCTION
        return;
      }
      // APPLYING UPDATED PAID AMOUNT
      sale.paidAmount = parsedPaid;
    } else if (quantity !== undefined || pricePerUnit !== undefined) {
      // IF TOTAL DECREASED BELOW EXISTING PAID AMOUNT — CAP PAID TO NEW TOTAL
      if (sale.paidAmount > sale.totalAmount) {
        // APPLYING NEW TOTAL AS PAID AMOUNT CAP
        sale.paidAmount = sale.totalAmount;
      }
    }
    // RECOMPUTING PENDING AMOUNT (CANNOT BE NEGATIVE)
    sale.pendingAmount = parseFloat(
      Math.max(0, sale.totalAmount - sale.paidAmount).toFixed(2),
    );
  }
  // UPDATING DATE IF PROVIDED
  if (date !== undefined) sale.date = date.trim();
  // UPDATING NOTE IF PROVIDED (ALLOW CLEARING TO NULL)
  if (note !== undefined) sale.note = note?.trim() || null;
  // SAVING UPDATED SALE TO DATABASE
  await sale.save();
  // RETURNING SUCCESS RESPONSE WITH UPDATED SALE
  res.status(200).json({
    message: "Sale Updated Successfully!",
    success: true,
    data: { sale },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE A SALE RECORD
 * RESPECTS THE ACCOUNT'S DELETION MODE PREFERENCE — MOVED TO TRASH OR HARD-DELETED
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE SALE ==>
export const deleteSale = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING SALE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING SALE AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const sale = await Sale.findOne({ _id: id, accountId }).exec();
  // IF SALE NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!sale) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Sale Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // REMOVING SALE (RESPECTS ACCOUNT DELETION MODE PREFERENCE)
  const { trashed } = await removeDocument({
    accountId,
    entityType: TRASH_ENTITY_TYPES.SALE,
    document: sale,
    performedBy,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: trashed ? "Sale Moved to Trash!" : "Sale Deleted Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
