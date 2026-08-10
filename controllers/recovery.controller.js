// <== IMPORTS ==>
import {
  computeMonthlyStats,
  allocatePaymentAcrossMonths,
} from "../services/paymentAllocationService.js";
import mongoose from "mongoose";
import { Sale } from "../models/sale.model.js";
import { Payment } from "../models/payment.model.js";
import { Discount } from "../models/discount.model.js";
import { Customer } from "../models/customer.model.js";
import expressAsyncHandler from "express-async-handler";
import { removeDocument } from "../services/trashService.js";
import { TRASH_ENTITY_TYPES } from "../models/trash.model.js";
import { DeliveryRecord } from "../models/deliveryRecord.model.js";

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
  // CALCULATE DATE 6 DAYS BEFORE TODAY
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
      // RETURNING FULL MONTH DATE RANGE FOR THE PROVIDED MONTH STRING OR CURRENT MONTH IF NOT PROVIDED
      return getMonthDateRange(monthStr);
  }
};

// <== HELPER: DERIVE BILLING MONTH STRING FROM DATE RANGE START ==>
const deriveBillingMonth = (startDate) => {
  // EXTRACT YYYY-MM FROM THE START DATE OF THE RANGE
  return startDate.substring(0, 7);
};

// <== HELPER: COMPUTE ALL-TIME OUTSTANDING STATS FOR A BATCH OF CUSTOMERS ==>
const computeAllTimeDeliveryStats = async (customerIds, customers) => {
  // BATCH FETCH ALL-TIME DELIVERED RECORDS, ALL-TIME PAYMENTS, AND ALL-TIME DISCOUNTS IN PARALLEL
  const [allTimeDeliveredRecords, allTimePaymentsAll, allTimeDiscountsAll] =
    await Promise.all([
      DeliveryRecord.find({
        customerId: { $in: customerIds },
        status: "delivered",
      })
        .lean()
        .exec(),
      Payment.find({ customerId: { $in: customerIds } })
        .lean()
        .exec(),
      Discount.find({ customerId: { $in: customerIds } })
        .lean()
        .exec(),
    ]);
  // GROUP DELIVERIES BY CUSTOMER ID
  const deliveryByCustomer = {};
  // LOOPING THROUGH ALL DELIVERY RECORDS
  allTimeDeliveredRecords.forEach((r) => {
    // GETTING STRING KEY FOR CUSTOMER ID
    const key = r.customerId.toString();
    // INITIALIZING ARRAY IF NOT EXISTS
    if (!deliveryByCustomer[key]) deliveryByCustomer[key] = [];
    // PUSHING RECORD TO CUSTOMER'S ARRAY
    deliveryByCustomer[key].push(r);
  });
  // GROUP PAYMENTS BY CUSTOMER ID
  const paymentsByCustomer = {};
  // LOOPING THROUGH ALL PAYMENTS
  allTimePaymentsAll.forEach((p) => {
    // GETTING STRING KEY FOR CUSTOMER ID
    const key = p.customerId.toString();
    // INITIALIZING ARRAY IF NOT EXISTS
    if (!paymentsByCustomer[key]) paymentsByCustomer[key] = [];
    // PUSHING PAYMENT TO CUSTOMER'S ARRAY
    paymentsByCustomer[key].push(p);
  });
  // GROUP DISCOUNTS BY CUSTOMER ID
  const discountsByCustomer = {};
  // LOOPING THROUGH ALL DISCOUNTS
  allTimeDiscountsAll.forEach((d) => {
    // GETTING STRING KEY FOR CUSTOMER ID
    const key = d.customerId.toString();
    // INITIALIZING ARRAY IF NOT EXISTS
    if (!discountsByCustomer[key]) discountsByCustomer[key] = [];
    // PUSHING DISCOUNT TO CUSTOMER'S ARRAY
    discountsByCustomer[key].push(d);
  });
  // COMPUTE PER-CUSTOMER ALL-TIME OUTSTANDING
  const customerOutstandingMap = {};
  // INITIALIZING TOTAL DELIVERY DUE
  let totalDeliveryDue = 0;
  // INITIALIZING TOTAL DELIVERY PAID
  let totalDeliveryPaid = 0;
  // LOOPING THROUGH ALL CUSTOMERS
  customers.forEach((customer) => {
    // GETTING CUSTOMER ID
    const custId = customer._id.toString();
    // GETTING CUSTOMER DELIVERIES
    const deliveries = deliveryByCustomer[custId] || [];
    // GETTING CUSTOMER PAYMENTS
    const payments = paymentsByCustomer[custId] || [];
    // CALCULATING ALL-TIME TOTAL MILK DELIVERED
    const allTimeMilk = deliveries.reduce((sum, d) => sum + d.milkQuantity, 0);
    // CALCULATING ALL-TIME TOTAL AMOUNT DUE
    const allTimeDue = parseFloat(
      (allTimeMilk * customer.pricePerLiter).toFixed(2),
    );
    // CALCULATING ALL-TIME TOTAL PAID
    const allTimePaid = parseFloat(
      payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
    );
    // CALCULATING ALL-TIME TOTAL DISCOUNT GIVEN
    const discounts = discountsByCustomer[custId] || [];
    // SUMMING ALL-TIME DISCOUNT
    const allTimeDiscount = parseFloat(
      discounts.reduce((sum, d) => sum + d.amount, 0).toFixed(2),
    );
    // CALCULATING ALL-TIME PENDING — AFTER DISCOUNT
    const allTimeOutstanding = parseFloat(
      Math.max(0, allTimeDue - allTimeDiscount - allTimePaid).toFixed(2),
    );
    // POPULATING CUSTOMER OUTSTANDING MAP
    customerOutstandingMap[custId] = {
      allTimeDue,
      allTimePaid,
      allTimeOutstanding,
    };
    // ACCUMULATING TOTAL DELIVERY DUE
    totalDeliveryDue += allTimeDue;
    // ACCUMULATING TOTAL DELIVERY PAID
    totalDeliveryPaid += allTimePaid;
  });
  // RETURNING MAP AND TOTALS
  return {
    customerOutstandingMap,
    totalDeliveryDue: parseFloat(totalDeliveryDue.toFixed(2)),
    totalDeliveryPaid: parseFloat(totalDeliveryPaid.toFixed(2)),
    totalDeliveryOutstanding: parseFloat(
      Math.max(0, totalDeliveryDue - totalDeliveryPaid).toFixed(2),
    ),
  };
};

/**
 * GET RECOVERY RECORDS WITH COMBINED STATS (DELIVERY OR SALE TAB)
 * STATS ARE ALWAYS ALL-TIME COMBINED ACROSS BOTH DELIVERIES AND SALES
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET RECOVERIES ==>
export const getRecoveries = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING TAB FROM QUERY (DELIVERIES | SALES)
  const tab = req.query.tab || "deliveries";
  // GETTING FILTER TYPE FROM QUERY (TODAY | WEEK | MONTH | DATE | RANGE)
  const filter = req.query.filter || "month";
  // GETTING MONTH STRING (DEFAULTS TO CURRENT MONTH)
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING SPECIFIC DATE FOR THE DATE FILTER (YYYY-MM-DD)
  const specificDate = req.query.date || null;
  // GETTING RANGE START FOR THE RANGE FILTER (YYYY-MM-DD)
  const rangeStart = req.query.rangeStart || null;
  // GETTING RANGE END FOR THE RANGE FILTER (YYYY-MM-DD)
  const rangeEnd = req.query.rangeEnd || null;
  // GETTING STATUS FILTER (ALL | PENDING | CLEARED)
  const status = req.query.status || "all";
  // GETTING SEARCH QUERY
  const search = req.query.search?.trim() || "";
  // PARSING PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING LIMIT
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  // CALCULATING SKIP
  const skip = (page - 1) * limit;
  // GETTING DATE RANGE FOR SELECTED FILTER
  const { startDate, endDate } = getDateRangeForFilter(
    filter,
    monthStr,
    specificDate,
    rangeStart,
    rangeEnd,
  );
  // DERIVING BILLING MONTH FROM DATE RANGE (USED FOR MONTHLY STATS COMPUTATION)
  const billingMonth = deriveBillingMonth(startDate);
  // GETTING BILLING MONTH DATE RANGE (FULL MONTH FOR MONTHLY STATS)
  const { startDate: monthStart, endDate: monthEnd } =
    getMonthDateRange(billingMonth);
  // CONVERTING ACCOUNT ID TO OBJECT ID FOR AGGREGATION PIPELINE USE
  const accountObjectId = new mongoose.Types.ObjectId(accountId);
  // BUILDING BASE CUSTOMER QUERY FOR THIS ACCOUNT
  const customerQuery = { accountId };
  // APPLYING SEARCH FILTER ON DELIVERY TAB — FILTERS BY CUSTOMER NAME OR PHONE
  if (search && tab === "deliveries") {
    // FILTERING BY CUSTOMER NAME OR PHONE USING CASE-INSENSITIVE REGEX
    customerQuery.$or = [
      // MATCHING CUSTOMER NAME THROUGH REGEX
      { name: { $regex: search, $options: "i" } },
      // MATCHING CUSTOMER PHONE THROUGH REGEX
      { phone: { $regex: search, $options: "i" } },
    ];
  }
  // FETCH ALL CUSTOMERS AND COMBINED SALES STATS IN PARALLEL
  const [allCustomers, salesStatsAgg] = await Promise.all([
    // ALL CUSTOMERS FOR THIS ACCOUNT (USED FOR BOTH DELIVERY RECORDS AND COMBINED STATS)
    Customer.find(customerQuery).sort({ createdAt: -1 }).lean().exec(),
    // ALL-TIME COMBINED SALES STATS FOR STATS CARDS
    Sale.aggregate([
      // MATCHING CUSTOMER SALES FOR THIS ACCOUNT
      { $match: { accountId: accountObjectId, saleType: "customer" } },
      // GROUPING TO COMPUTE ALL-TIME TOTALS
      {
        $group: {
          _id: null,
          salesOutstanding: { $sum: "$pendingAmount" },
          salesDue: { $sum: "$totalAmount" },
          salesPaid: { $sum: "$paidAmount" },
        },
      },
    ]),
  ]);
  // EXTRACTING CUSTOMER IDS FOR BATCH QUERIES
  const allCustomerIds = allCustomers.map((c) => c._id);
  // COMPUTE ALL-TIME DELIVERY OUTSTANDING FOR STATS CARDS
  const deliveryAllTimeStats = await computeAllTimeDeliveryStats(
    allCustomerIds,
    allCustomers,
  );
  // EXTRACTING SALES STATS WITH FALLBACK
  const salesStats = salesStatsAgg[0] || {
    salesOutstanding: 0,
    salesDue: 0,
    salesPaid: 0,
  };
  // COMPUTING TOTAL DUE FOR STATS CARDS VALUES
  const totalDue = parseFloat(
    (deliveryAllTimeStats.totalDeliveryDue + salesStats.salesDue).toFixed(2),
  );
  // COMPUTING TOTAL PAID FOR STATS CARDS VALUES
  const totalPaid = parseFloat(
    (deliveryAllTimeStats.totalDeliveryPaid + salesStats.salesPaid).toFixed(2),
  );
  // COMPUTING TOTAL OUTSTANDING FOR STATS CARDS
  const totalOutstanding = parseFloat(
    (
      deliveryAllTimeStats.totalDeliveryOutstanding +
      salesStats.salesOutstanding
    ).toFixed(2),
  );
  // CALCULATING RECOVERY RATE
  const recoveryRate =
    totalDue > 0 ? parseFloat(((totalPaid / totalDue) * 100).toFixed(1)) : 0;
  // BUILDING COMBINED STATS OBJECT
  const stats = {
    deliveryOutstanding: deliveryAllTimeStats.totalDeliveryOutstanding,
    salesOutstanding: parseFloat((salesStats.salesOutstanding || 0).toFixed(2)),
    totalOutstanding,
    totalDue,
    recoveryRate,
  };
  // DECLARING RECORDS FOR PAGINATION
  let records = [];
  // DECLARING TOTAL COUNT FOR PAGINATION
  let totalCount = 0;
  // IF DELIVERIES TAB
  if (tab === "deliveries") {
    // BATCH FETCH DELIVERY RECORDS AND PAYMENTS FOR BILLING MONTH IN PARALLEL
    const [
      billingMonthDeliveries,
      billingMonthPayments,
      billingMonthDiscounts,
    ] = await Promise.all([
      DeliveryRecord.find({
        customerId: { $in: allCustomerIds },
        date: { $gte: monthStart, $lte: monthEnd },
      })
        .lean()
        .exec(),
      Payment.find({
        customerId: { $in: allCustomerIds },
        billingMonth,
      })
        .lean()
        .exec(),
      Discount.find({
        customerId: { $in: allCustomerIds },
        billingMonth,
      })
        .lean()
        .exec(),
    ]);
    // EXTRACT UNIQUE CUSTOMER IDS WITH ACTIVITY IN THE FILTER PERIOD (TODAY / WEEK FILTERS ONLY)
    let activeCustomerIds = null;
    // IF NOT MONTH FILTER — NEED TO NARROW TO CUSTOMERS WITH PERIOD ACTIVITY
    if (filter !== "month") {
      // BATCH FETCH DELIVERY RECORDS FOR THE SELECTED FILTER PERIOD
      const periodDeliveries = await DeliveryRecord.find({
        customerId: { $in: allCustomerIds },
        date: { $gte: startDate, $lte: endDate },
      })
        .lean()
        .exec();
      // EXTRACT UNIQUE CUSTOMER IDS WITH ACTIVITY IN THE FILTER PERIOD
      activeCustomerIds = new Set(
        periodDeliveries.map((d) => d.customerId.toString()),
      );
    }
    // GROUP BILLING MONTH DELIVERIES BY CUSTOMER ID
    const deliveriesByCustomer = {};
    // LOOPING THROUGH ALL DELIVERY RECORDS
    billingMonthDeliveries.forEach((r) => {
      // GETTING STRING KEY FOR CUSTOMER ID
      const key = r.customerId.toString();
      // INITIALIZING ARRAY IF NOT EXISTS
      if (!deliveriesByCustomer[key]) deliveriesByCustomer[key] = [];
      // PUSHING RECORD TO CUSTOMER'S ARRAY
      deliveriesByCustomer[key].push(r);
    });
    // GROUP BILLING MONTH PAYMENTS BY CUSTOMER ID
    const paymentsByCustomer = {};
    // LOOPING THROUGH ALL PAYMENTS
    billingMonthPayments.forEach((p) => {
      // GETTING STRING KEY FOR CUSTOMER ID
      const key = p.customerId.toString();
      // INITIALIZING ARRAY IF NOT EXISTS
      if (!paymentsByCustomer[key]) paymentsByCustomer[key] = [];
      // PUSHING PAYMENT TO CUSTOMER'S ARRAY
      paymentsByCustomer[key].push(p);
    });
    // MAP BILLING MONTH DISCOUNTS BY CUSTOMER ID — UNIQUE INDEX GUARANTEES AT MOST ONE MATCH EACH
    const discountByCustomer = {};
    // LOOPING THROUGH ALL DISCOUNTS
    billingMonthDiscounts.forEach((d) => {
      // MAPPING CUSTOMER ID TO ITS DISCOUNT AMOUNT FOR THIS BILLING MONTH
      discountByCustomer[d.customerId.toString()] = d.amount;
    });
    // BUILD ENRICHED CUSTOMER OBJECTS WITH MONTHLY STATS AND ALL-TIME OUTSTANDING
    const enrichedCustomers = allCustomers
      .filter((customer) => {
        // APPLY PERIOD FILTER: IF NOT MONTH FILTER, ONLY INCLUDE CUSTOMERS WITH ACTIVITY
        if (activeCustomerIds !== null) {
          // CUSTOMER HAS ACTIVITY IN THE SELECTED PERIOD
          return activeCustomerIds.has(customer._id.toString());
        }
        // MONTH FILTER: INCLUDE ALL CUSTOMERS WITH ANY BILLING ACTIVITY
        const custId = customer._id.toString();
        // CHECK IF CUSTOMER HAS ANY DELIVERIES
        const hasDeliveries = (deliveriesByCustomer[custId] || []).length > 0;
        // CHECK IF CUSTOMER HAS ANY PAYMENTS
        const hasPayments = (paymentsByCustomer[custId] || []).length > 0;
        // RETURN CUSTOMER IF HAS ANY DELIVERIES OR PAYMENTS
        return hasDeliveries || hasPayments;
      })
      .map((customer) => {
        // GET CUSTOMER ID
        const custId = customer._id.toString();
        // GET DELIVERIES FOR THIS CUSTOMER
        const deliveries = deliveriesByCustomer[custId] || [];
        // GET PAYMENTS FOR THIS CUSTOMER
        const payments = paymentsByCustomer[custId] || [];
        // GET DISCOUNT FOR THIS CUSTOMER'S BILLING MONTH (DEFAULTS TO 0 IF NONE SET)
        const monthDiscount = discountByCustomer[custId] || 0;
        // COMPUTE MONTHLY STATS FOR THE BILLING MONTH
        const monthlyStats = computeMonthlyStats(
          billingMonth,
          deliveries,
          payments,
          customer.pricePerLiter,
          monthDiscount,
        );
        // GET ALL-TIME OUTSTANDING FROM PRE-COMPUTED MAP
        const allTimeData = deliveryAllTimeStats.customerOutstandingMap[
          custId
        ] || {
          allTimeDue: 0,
          allTimePaid: 0,
          allTimeOutstanding: 0,
        };
        // BUILD ENRICHED CUSTOMER OBJECT
        return {
          _id: customer._id,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          dailyMilk: customer.dailyMilk,
          pricePerLiter: customer.pricePerLiter,
          monthlyStats,
          allTimeDue: allTimeData.allTimeDue,
          allTimePaid: allTimeData.allTimePaid,
          allTimeOutstanding: allTimeData.allTimeOutstanding,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
        };
      });
    // APPLY STATUS FILTER BASED ON MONTHLY STATS PENDING
    const statusFiltered = enrichedCustomers.filter((c) => {
      // APPLY STATUS FILTER ON PENDING
      if (status === "pending") return c.monthlyStats.pending > 0;
      // APPLY STATUS FILTER ON CLEARED
      if (status === "cleared") return c.monthlyStats.pending === 0;
      // INCLUDE ALL IF NO STATUS FILTER
      return true;
    });
    // SORT BY MONTHLY PENDING DESCENDING (MOST OVERDUE FIRST)
    statusFiltered.sort(
      (a, b) => b.monthlyStats.pending - a.monthlyStats.pending,
    );
    // SET TOTAL COUNT
    totalCount = statusFiltered.length;
    // APPLY PAGINATION SLICE
    records = statusFiltered.slice(skip, skip + limit);
  }
  // IF TAB IS SALES
  if (tab === "sales") {
    // BUILD SALE MATCH QUERY SCOPED TO THIS ACCOUNT
    const saleMatchQuery = {
      accountId: accountObjectId,
      saleType: "customer",
      date: { $gte: startDate, $lte: endDate },
    };
    // APPLY SEARCH ON CUSTOMER NAME IF PROVIDED
    if (search) saleMatchQuery.customerName = { $regex: search, $options: "i" };
    // APPLY STATUS FILTER ON PENDING AMOUNT
    if (status === "pending") saleMatchQuery.pendingAmount = { $gt: 0 };
    // APPLY STATUS FILTER ON CLEARED AMOUNT
    if (status === "cleared") saleMatchQuery.pendingAmount = 0;
    // RUN TOTAL COUNT AND PAGINATED RECORDS IN PARALLEL
    const [saleCount, saleRecords] = await Promise.all([
      Sale.countDocuments(saleMatchQuery),
      Sale.find(saleMatchQuery)
        .sort({ pendingAmount: -1, date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);
    // SET TOTAL COUNT FOR PAGINATION
    totalCount = saleCount;
    // SET PAGINATED RECORDS
    records = saleRecords;
  }
  // CALCULATING TOTAL PAGES
  const totalPages = Math.ceil(totalCount / limit);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Recoveries Fetched Successfully!",
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
        billingMonth,
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
 * ADD A PAYMENT FOR A CUSTOMER'S BILLING MONTH (DELIVERY RECOVERY)
 * UPDATES THE CUSTOMER'S OUTSTANDING BALANCE — REFLECTED IN CUSTOMERS MODULE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD DELIVERY PAYMENT ==>
export const addDeliveryPayment = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING CUSTOMER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING PAYMENT DATA FROM REQUEST BODY
  const { amount, billingMonth, paymentDate, note } = req.body;
  // FINDING CUSTOMER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const customer = await Customer.findOne({ _id: id, accountId }).lean().exec();
  // IF CUSTOMER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!customer) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "Customer Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // PARSING PAYMENT AMOUNT
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
  // RESOLVING PAYMENT DATE
  const resolvedPaymentDate = paymentDate?.trim() || getTodayDateStr();
  // GETTING DATE RANGE FOR BILLING MONTH
  const { startDate, endDate } = getMonthDateRange(billingMonth);
  // FETCHING DELIVERY RECORDS, EXISTING PAYMENTS, AND THIS MONTH'S DISCOUNT IN PARALLEL
  const [monthDeliveries, existingPayments, discountDoc] = await Promise.all([
    DeliveryRecord.find({
      customerId: id,
      date: { $gte: startDate, $lte: endDate },
      status: "delivered",
    })
      .lean()
      .exec(),
    Payment.find({ customerId: id, billingMonth }).lean().exec(),
    Discount.findOne({ customerId: id, billingMonth }).lean().exec(),
  ]);
  // CALCULATING TOTAL MILK DELIVERED FOR THIS BILLING MONTH
  const totalMilkDelivered = monthDeliveries.reduce(
    (sum, d) => sum + d.milkQuantity,
    0,
  );
  // CALCULATING MONTHLY TOTAL DUE (GROSS — BEFORE DISCOUNT)
  const monthlyTotal = parseFloat(
    (totalMilkDelivered * customer.pricePerLiter).toFixed(2),
  );
  // GETTING THIS MONTH'S DISCOUNT (DEFAULTS TO 0 IF NONE SET)
  const monthDiscount = discountDoc?.amount || 0;
  // CALCULATING ALREADY PAID AMOUNT
  const alreadyPaid = parseFloat(
    existingPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
  );
  // CALCULATING PENDING AMOUNT — AFTER DISCOUNT
  const pendingAmount = parseFloat(
    Math.max(0, monthlyTotal - monthDiscount - alreadyPaid).toFixed(2),
  );
  // BLOCKING PAYMENT IF NO OUTSTANDING BALANCE
  if (pendingAmount === 0) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: `No Outstanding Balance for ${billingMonth}. Bill is Already Fully Paid!`,
      success: false,
      data: { billingMonth, monthlyTotal, totalPaid: alreadyPaid, pending: 0 },
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // BLOCKING PAYMENT IF AMOUNT EXCEEDS PENDING
  if (parsedAmount > pendingAmount) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: `Payment Amount Cannot Exceed the Pending Balance of ₨${pendingAmount.toLocaleString()} for ${billingMonth}!`,
      success: false,
      data: {
        billingMonth,
        monthlyTotal,
        totalPaid: alreadyPaid,
        pending: pendingAmount,
      },
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CREATING PAYMENT RECORD IN DATABASE WITH ACCOUNT AND ATTRIBUTION FIELDS
  const payment = await Payment.create({
    customerId: id,
    accountId,
    performedBy,
    amount: parsedAmount,
    billingMonth,
    paymentDate: resolvedPaymentDate,
    note: note?.trim() || null,
  });
  // CALCULATING NEW TOTALS AFTER PAYMENT
  const newTotalPaid = parseFloat((alreadyPaid + parsedAmount).toFixed(2));
  // CALCULATING NEW PENDING AMOUNT
  const newPending = parseFloat(
    Math.max(0, monthlyTotal - newTotalPaid).toFixed(2),
  );
  // RETURNING SUCCESS RESPONSE
  res.status(201).json({
    message: `Payment of ₨${parsedAmount.toLocaleString()} Recorded Successfully for ${billingMonth}!`,
    success: true,
    data: {
      payment,
      monthlyStats: {
        month: billingMonth,
        monthlyTotal,
        totalPaid: newTotalPaid,
        pending: newPending,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * ADD A BULK PAYMENT FOR A CUSTOMER'S OUTSTANDING BALANCE (DELIVERY RECOVERY)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD BULK DELIVERY PAYMENT ==>
export const addBulkDeliveryPayment = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING CUSTOMER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING PAYMENT DATA FROM REQUEST BODY
  const { amount, paymentDate, note } = req.body;
  // PARSING AMOUNT AS FLOAT
  const parsedAmount = parseFloat(amount);
  // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Payment Amount must be a Valid Positive Number!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FINDING CUSTOMER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const customer = await Customer.findOne({ _id: id, accountId }).lean().exec();
  // IF CUSTOMER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!customer) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "Customer Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // RESOLVING PAYMENT DATE (DEFAULT TO TODAY IF NOT PROVIDED)
  const resolvedPaymentDate = paymentDate?.trim() || getTodayDateStr();
  // RUNNING THE SHARED ALLOCATION LOGIC — OLDEST OUTSTANDING MONTH FIRST
  const result = await allocatePaymentAcrossMonths({
    accountId,
    customerId: id,
    performedBy,
    amount: parsedAmount,
    paymentDate: resolvedPaymentDate,
    note: note?.trim() || null,
    pricePerLiter: customer.pricePerLiter,
  });
  // IF ALLOCATION COULD NOT PROCEED (NO OUTSTANDING BALANCE OR AMOUNT TOO LARGE)
  if (result.error) {
    // RETURNING ERROR RESPONSE WITH THE SPECIFIC REASON
    res.status(400).json({ message: result.error, success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // BUILDING A HUMAN-READABLE MONTH COUNT FOR THE SUCCESS MESSAGE
  const monthsLabel =
    result.allocations.length === 1
      ? "1 Month"
      : `${result.allocations.length} Months`;
  // RETURNING SUCCESS RESPONSE WITH THE FULL ALLOCATION BREAKDOWN
  res.status(201).json({
    message: `Payment of ₨${parsedAmount.toLocaleString()} Recorded — Applied Across ${monthsLabel}!`,
    success: true,
    data: result,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE PAID AMOUNT ON A CUSTOMER SALE (SALE RECOVERY)
 * RECOMPUTES PENDING AMOUNT — REFLECTED IN SALES MODULE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE SALE PAYMENT ==>
export const updateSalePayment = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING SALE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING PAID AMOUNT AND OPTIONAL DISCOUNT FROM REQUEST BODY
  const { paidAmount, discount } = req.body;
  // FINDING SALE AND VERIFYING IT BELONGS TO THIS ACCOUNT (MUST BE CUSTOMER SALE)
  const sale = await Sale.findOne({
    _id: id,
    accountId,
    saleType: "customer",
  }).exec();
  // IF SALE NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!sale) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "Sale Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // IF A DISCOUNT UPDATE WAS PROVIDED, APPLY IT BEFORE VALIDATING PAID AMOUNT
  if (discount !== undefined) {
    // PARSING NEW DISCOUNT
    const parsedDiscount = parseFloat(discount);
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
    if (parsedDiscount > sale.subtotal) {
      // RETURNING ERROR RESPONSE
      res.status(400).json({
        message: `Discount cannot Exceed the Subtotal of ₨${sale.subtotal.toLocaleString()}!`,
        success: false,
        data: { subtotal: sale.subtotal },
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // UPDATING DISCOUNT
    sale.discount = parsedDiscount;
    // RECOMPUTING TOTAL AMOUNT — THE NET, BILLABLE AMOUNT AFTER DISCOUNT
    sale.totalAmount = parseFloat((sale.subtotal - parsedDiscount).toFixed(2));
  }
  // PARSING NEW PAID AMOUNT
  const parsedPaidAmount = parseFloat(paidAmount);
  // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES (DEFENSE IN DEPTH)
  if (!Number.isFinite(parsedPaidAmount) || parsedPaidAmount < 0) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Paid Amount must be a Valid Non-Negative Number!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // VALIDATING PAID AMOUNT DOES NOT EXCEED TOTAL
  if (parsedPaidAmount > sale.totalAmount) {
    // RETURNING VALIDATION ERROR
    res.status(400).json({
      message: `Paid Amount Cannot Exceed the Total Amount of ₨${sale.totalAmount.toLocaleString()}!`,
      success: false,
      data: { totalAmount: sale.totalAmount },
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // UPDATING PAID AMOUNT
  sale.paidAmount = parsedPaidAmount;
  // RECOMPUTING PENDING AMOUNT (CANNOT BE NEGATIVE)
  sale.pendingAmount = parseFloat(
    Math.max(0, sale.totalAmount - parsedPaidAmount).toFixed(2),
  );
  // SAVING UPDATED SALE
  await sale.save();
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Sale Payment Updated Successfully!",
    success: true,
    data: { sale },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * SET OR UPDATE A CUSTOMER'S MILK DELIVERY DISCOUNT FOR A GIVEN BILLING MONTH
 * UPSERTS — ONE DISCOUNT DOCUMENT PER CUSTOMER PER BILLING MONTH
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== SET MONTHLY DISCOUNT ==>
export const setMonthlyDiscount = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING CUSTOMER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING DISCOUNT DATA FROM REQUEST BODY
  const { amount, billingMonth, note } = req.body;
  // FINDING CUSTOMER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const customer = await Customer.findOne({ _id: id, accountId }).lean().exec();
  // IF CUSTOMER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!customer) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "Customer Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // PARSING DISCOUNT AMOUNT
  const parsedAmount = parseFloat(amount);
  // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Discount Amount must be a Valid Positive Number!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GETTING DATE RANGE FOR BILLING MONTH TO COMPUTE THE MONTHLY GROSS TOTAL
  const { startDate, endDate } = getMonthDateRange(billingMonth);
  // FETCHING THIS MONTH'S DELIVERED RECORDS TO VALIDATE THE DISCOUNT AGAINST THE ACTUAL BILL
  const monthDeliveries = await DeliveryRecord.find({
    customerId: id,
    date: { $gte: startDate, $lte: endDate },
    status: "delivered",
  })
    .lean()
    .exec();
  // CALCULATING TOTAL MILK DELIVERED FOR THIS BILLING MONTH
  const totalMilkDelivered = monthDeliveries.reduce(
    (sum, d) => sum + d.milkQuantity,
    0,
  );
  // CALCULATING MONTHLY GROSS TOTAL — THE CEILING A DISCOUNT CANNOT EXCEED
  const monthlyTotal = parseFloat(
    (totalMilkDelivered * customer.pricePerLiter).toFixed(2),
  );
  // GUARDING AGAINST A DISCOUNT LARGER THAN THE MONTHLY BILL
  if (parsedAmount > monthlyTotal) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: `Discount cannot Exceed the Monthly Bill of ₨${monthlyTotal.toLocaleString()} for ${billingMonth}!`,
      success: false,
      data: { monthlyTotal },
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // UPSERTING THE DISCOUNT DOCUMENT — ONE PER CUSTOMER PER BILLING MONTH
  const discountDoc = await Discount.findOneAndUpdate(
    { customerId: id, billingMonth },
    {
      customerId: id,
      accountId,
      performedBy,
      amount: parsedAmount,
      billingMonth,
      note: note?.trim() || null,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).exec();
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: `Discount of ₨${parsedAmount.toLocaleString()} Set for ${billingMonth}!`,
    success: true,
    data: { discount: discountDoc },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE A CUSTOMER SALE RECORD (SALE RECOVERY)
 * REMOVES THE SALE ENTIRELY — REFLECTED IN SALES MODULE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE SALE RECORD ==>
export const deleteSaleRecord = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING SALE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING SALE AND VERIFYING IT BELONGS TO THIS ACCOUNT (MUST BE CUSTOMER SALE)
  const sale = await Sale.findOne({
    _id: id,
    accountId,
    saleType: "customer",
  }).exec();
  // IF SALE NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!sale) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "Sale Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // REMOVING SALE
  const { trashed } = await removeDocument({
    accountId,
    entityType: TRASH_ENTITY_TYPES.SALE,
    document: sale,
    performedBy,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: trashed
      ? "Sale Record Moved to Trash!"
      : "Sale Record Deleted Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
