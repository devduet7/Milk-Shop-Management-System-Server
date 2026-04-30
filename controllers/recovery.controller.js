// <== IMPORTS ==>
import mongoose from "mongoose";
import { Sale } from "../models/sale.model.js";
import { Payment } from "../models/payment.model.js";
import { Customer } from "../models/customer.model.js";
import expressAsyncHandler from "express-async-handler";
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
    // MONTH FILTER: FULL CALENDAR MONTH
    case "month":
    // DEFAULT: FULL CALENDAR MONTH
    default:
      return getMonthDateRange(monthStr);
  }
};

// <== HELPER: DERIVE BILLING MONTH STRING FROM DATE RANGE START ==>
const deriveBillingMonth = (startDate) => {
  // EXTRACT YYYY-MM FROM THE START DATE OF THE RANGE
  return startDate.substring(0, 7);
};

// <== HELPER: COMPUTE MONTHLY STATS FOR A CUSTOMER ==>
const computeMonthlyStats = (
  monthStr,
  deliveryRecords,
  payments,
  pricePerLiter,
) => {
  // FILTER DELIVERED RECORDS ONLY
  const deliveredRecords = deliveryRecords.filter(
    (d) => d.status === "delivered",
  );
  // FILTER MISSED RECORDS ONLY
  const missedRecords = deliveryRecords.filter((d) => d.status === "missed");
  // CALCULATE TOTAL MILK DELIVERED
  const totalMilkDelivered = deliveredRecords.reduce(
    (sum, d) => sum + d.milkQuantity,
    0,
  );
  // CALCULATE MONTHLY TOTAL DUE
  const monthlyTotal = parseFloat(
    (totalMilkDelivered * pricePerLiter).toFixed(2),
  );
  // CALCULATE TOTAL PAID
  const totalPaid = parseFloat(
    payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
  );
  // CALCULATE PENDING
  const pending = parseFloat(Math.max(0, monthlyTotal - totalPaid).toFixed(2));
  // RETURNING COMPUTED STATS
  return {
    month: monthStr,
    deliveredDays: deliveredRecords.length,
    missedDays: missedRecords.length,
    totalMilkDelivered: parseFloat(totalMilkDelivered.toFixed(3)),
    monthlyTotal,
    totalPaid,
    pending,
  };
};

// <== HELPER: COMPUTE ALL-TIME OUTSTANDING STATS FOR A BATCH OF CUSTOMERS ==>
const computeAllTimeDeliveryStats = async (customerIds, customers) => {
  // BATCH FETCH ALL-TIME DELIVERED RECORDS FOR ALL CUSTOMERS
  const allTimeDeliveredRecords = await DeliveryRecord.find({
    customerId: { $in: customerIds },
    status: "delivered",
  })
    .lean()
    .exec();
  // BATCH FETCH ALL-TIME PAYMENTS FOR ALL CUSTOMERS
  const allTimePaymentsAll = await Payment.find({
    customerId: { $in: customerIds },
  })
    .lean()
    .exec();
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
    // CALCULATING ALL-TIME PENDING
    const allTimeOutstanding = parseFloat(
      Math.max(0, allTimeDue - allTimePaid).toFixed(2),
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
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING TAB FROM QUERY (DELIVERIES | SALES)
  const tab = req.query.tab || "deliveries";
  // GETTING FILTER TYPE FROM QUERY (TODAY | WEEK | MONTH)
  const filter = req.query.filter || "month";
  // GETTING MONTH STRING (DEFAULTS TO CURRENT MONTH)
  const monthStr = req.query.month || getCurrentMonthStr();
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
  const { startDate, endDate } = getDateRangeForFilter(filter, monthStr);
  // DERIVING BILLING MONTH FROM DATE RANGE (USED FOR MONTHLY STATS COMPUTATION)
  const billingMonth = deriveBillingMonth(startDate);
  // GETTING BILLING MONTH DATE RANGE (FULL MONTH FOR MONTHLY STATS)
  const { startDate: monthStart, endDate: monthEnd } =
    getMonthDateRange(billingMonth);
  // USER OBJECT ID FOR AGGREGATION QUERIES
  const userObjectId = new mongoose.Types.ObjectId(userId);
  // BUILDING CUSTOMER QUERY FOR DELIVERY TAB
  const customerQuery = { userId };
  // BUILDING CUSTOMER QUERY FOR SALE TAB
  if (search && tab === "deliveries") {
    // BUILDING CUSTOMER QUERY FOR DELIVERY TAB
    customerQuery.$or = [
      // MATCHING CUSTOMER NAME THROUGH REGEX
      { name: { $regex: search, $options: "i" } },
      // MATCHING CUSTOMER PHONE THROUGH REGEX
      { phone: { $regex: search, $options: "i" } },
    ];
  }
  // FETCH ALL CUSTOMERS AND COMBINED SALES STATS IN PARALLEL
  const [allCustomers, salesStatsAgg] = await Promise.all([
    // ALL CUSTOMERS FOR THIS USER (USED FOR BOTH DELIVERY RECORDS AND COMBINED STATS)
    Customer.find(customerQuery).sort({ createdAt: -1 }).lean().exec(),
    // ALL-TIME COMBINED SALES STATS FOR STATS CARDS
    Sale.aggregate([
      // MATCHING SALES FOR THIS USER
      { $match: { userId: userObjectId, saleType: "customer" } },
      // MATCHING SALES FOR SELECTED DATE RANGE
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
    // BATCH FETCH DELIVERY RECORDS FOR BILLING MONTH (ALL CUSTOMERS)
    const [billingMonthDeliveries, billingMonthPayments] = await Promise.all([
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
    ]);
    // EXTRACT UNIQUE CUSTOMER IDS WITH ACTIVITY IN THE FILTER PERIOD
    let activeCustomerIds = null;
    // IF NOT MONTH FILTER
    if (filter !== "month") {
      // BATCH FETCH DELIVERY RECORDS FOR FILTER PERIOD
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
    // BUILD ENRICHED CUSTOMER OBJECTS WITH MONTHLY STATS AND ALL-TIME OUTSTANDING
    const enrichedCustomers = allCustomers
      .filter((customer) => {
        // APPLY PERIOD FILTER: IF NOT MONTH FILTER, ONLY INCLUDE CUSTOMERS WITH ACTIVITY
        if (activeCustomerIds !== null) {
          // CUSTOMER HAS ACTIVITY
          return activeCustomerIds.has(customer._id.toString());
        }
        // MONTH FILTER: INCLUDE ALL CUSTOMERS WITH ANY BILLING ACTIVITY
        const custId = customer._id.toString();
        // CHECK IF CUSTOMER HAS ANY DELIVERIES OR PAYMENTS
        const hasDeliveries = (deliveriesByCustomer[custId] || []).length > 0;
        // CHECK IF CUSTOMER HAS ANY PAYMENTS
        const hasPayments = (paymentsByCustomer[custId] || []).length > 0;
        // RETURN CUSTOMER IF HAS ANY DELIVERIES OR PAYMENTS
        return hasDeliveries || hasPayments;
      })
      .map((customer) => {
        // GET CUSTOMER ID
        const custId = customer._id.toString();
        // GET DELIVERIES AND PAYMENTS FOR CUSTOMER
        const deliveries = deliveriesByCustomer[custId] || [];
        // GET PAYMENTS FOR CUSTOMER
        const payments = paymentsByCustomer[custId] || [];
        // COMPUTE MONTHLY STATS FOR THE BILLING MONTH
        const monthlyStats = computeMonthlyStats(
          billingMonth,
          deliveries,
          payments,
          customer.pricePerLiter,
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
      // APPLY STATUS FILTER ON ALL
      return true;
    });
    // SORT BY MONTHLY PENDING DESCENDING (MOST OVERDUE FIRST)
    statusFiltered.sort(
      (a, b) => b.monthlyStats.pending - a.monthlyStats.pending,
    );
    // SET TOTAL COUNT AND PAGINATE
    totalCount = statusFiltered.length;
    // APPLY PAGINATION LOGIC
    records = statusFiltered.slice(skip, skip + limit);
  }
  // IF TAB IS SALES
  if (tab === "sales") {
    // BUILD SALE MATCH QUERY
    const saleMatchQuery = {
      userId: userObjectId,
      saleType: "customer",
      date: { $gte: startDate, $lte: endDate },
    };
    // APPLY SEARCH ON CUSTOMER NAME
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
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING CUSTOMER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING PAYMENT DATA FROM REQUEST BODY
  const { amount, billingMonth, paymentDate, note } = req.body;
  // FINDING CUSTOMER AND VERIFYING OWNERSHIP
  const customer = await Customer.findOne({ _id: id, userId }).lean().exec();
  // IF CUSTOMER NOT FOUND
  if (!customer) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "Customer Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // PARSING PAYMENT AMOUNT
  const parsedAmount = parseFloat(amount);
  // RESOLVING PAYMENT DATE
  const resolvedPaymentDate = paymentDate?.trim() || getTodayDateStr();
  // GETTING DATE RANGE FOR BILLING MONTH
  const { startDate, endDate } = getMonthDateRange(billingMonth);
  // FETCHING DELIVERY RECORDS FOR THE BILLING MONTH
  const monthDeliveries = await DeliveryRecord.find({
    customerId: id,
    date: { $gte: startDate, $lte: endDate },
    status: "delivered",
  })
    .lean()
    .exec();
  // CALCULATING MONTHLY TOTAL DUE
  const totalMilkDelivered = monthDeliveries.reduce(
    (sum, d) => sum + d.milkQuantity,
    0,
  );
  // CALCULATING MONTHLY TOTAL
  const monthlyTotal = parseFloat(
    (totalMilkDelivered * customer.pricePerLiter).toFixed(2),
  );
  // FETCHING EXISTING PAYMENTS FOR THIS BILLING MONTH
  const existingPayments = await Payment.find({ customerId: id, billingMonth })
    .lean()
    .exec();
  // CALCULATING ALREADY PAID AMOUNT
  const alreadyPaid = parseFloat(
    existingPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
  );
  // CALCULATING PENDING AMOUNT
  const pendingAmount = parseFloat(
    Math.max(0, monthlyTotal - alreadyPaid).toFixed(2),
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
  // CREATING PAYMENT RECORD IN DATABASE
  const payment = await Payment.create({
    customerId: id,
    userId,
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
 * UPDATE PAID AMOUNT ON A CUSTOMER SALE (SALE RECOVERY)
 * RECOMPUTES PENDING AMOUNT — REFLECTED IN SALES MODULE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE SALE PAYMENT ==>
export const updateSalePayment = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING SALE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING PAID AMOUNT FROM REQUEST BODY
  const { paidAmount } = req.body;
  // FINDING SALE AND VERIFYING OWNERSHIP (MUST BE CUSTOMER SALE)
  const sale = await Sale.findOne({
    _id: id,
    userId,
    saleType: "customer",
  }).exec();
  // IF SALE NOT FOUND
  if (!sale) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "Sale Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // PARSING NEW PAID AMOUNT
  const parsedPaidAmount = parseFloat(paidAmount);
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
 * DELETE A CUSTOMER SALE RECORD (SALE RECOVERY)
 * REMOVES THE SALE ENTIRELY — REFLECTED IN SALES MODULE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE SALE RECORD ==>
export const deleteSaleRecord = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING SALE ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING SALE AND VERIFYING OWNERSHIP
  const sale = await Sale.findOne({ _id: id, userId, saleType: "customer" })
    .lean()
    .exec();
  // IF SALE NOT FOUND
  if (!sale) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({ message: "Sale Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETING SALE RECORD
  await Sale.deleteOne({ _id: id });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Sale Record Deleted Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});
