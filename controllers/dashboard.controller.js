// <== IMPORTS ==>
import mongoose from "mongoose";
import { Sale } from "../models/sale.model.js";
import { Payment } from "../models/payment.model.js";
import { Purchase } from "../models/purchase.model.js";
import { Customer } from "../models/customer.model.js";
import expressAsyncHandler from "express-async-handler";
import { QuickSale } from "../models/quickSale.model.js";
import { Expenditure } from "../models/expenditure.model.js";
import { StaffMember } from "../models/staffMember.model.js";
import { DeliveryRecord } from "../models/deliveryRecord.model.js";
import { StaffMonthRecord } from "../models/staffMonthRecord.model.js";

// <== HELPER: GET CURRENT MONTH STRING ==>
const getCurrentMonthStr = () => {
  // GET CURRENT UTC DATE
  const now = new Date();
  // RETURNING FORMATTED YYYY-MM STRING
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
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

// <== HELPER: SAFE FLOAT — ROUNDS VALUE TO DECIMAL PLACES WITH NULL FALLBACK ==>
const sf = (n, d = 2) => parseFloat((n ?? 0).toFixed(d));

/**
 * GET COMPREHENSIVE DASHBOARD SUMMARY FOR THE SELECTED MONTH
 * RUNS ALL MODULE AGGREGATIONS IN PARALLEL FOR MAXIMUM PERFORMANCE
 * RECOVERY STATS ARE ALL-TIME; ALL OTHER STATS ARE MONTH-SCOPED
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET DASHBOARD SUMMARY ==>
export const getDashboardSummary = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING MONTH STRING (DEFAULTS TO CURRENT MONTH)
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING DATE RANGE FOR SELECTED MONTH
  const { startDate, endDate } = getMonthDateRange(monthStr);
  // CONVERTING ACCOUNT ID TO OBJECT ID FOR AGGREGATION PIPELINE USE
  const accountObjectId = new mongoose.Types.ObjectId(accountId);
  // RUNNING ALL 13 AGGREGATIONS IN PARALLEL — NO SEQUENTIAL ROUND TRIPS
  const [
    salesAgg,
    quickSalesAgg,
    purchasesAgg,
    expendituresAgg,
    deliveryStatusAgg,
    deliveryBillingAgg,
    monthPaymentsAgg,
    staffCountAgg,
    staffMonthAgg,
    customerCount,
    salesOutstandingAgg,
    allTimeDeliveryBillingAgg,
    allTimePaymentsAgg,
  ] = await Promise.all([
    // 1. SALES BY SALETYPE × PRODUCTTYPE FOR THE MONTH
    Sale.aggregate([
      {
        $match: {
          accountId: accountObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { saleType: "$saleType", productType: "$productType" },
          totalAmount: { $sum: "$totalAmount" },
          paidAmount: { $sum: "$paidAmount" },
          pendingAmount: { $sum: "$pendingAmount" },
          totalQty: { $sum: "$quantity" },
          count: { $sum: 1 },
        },
      },
    ]),
    // 2. QUICK SALES BY TYPE FOR THE MONTH
    QuickSale.aggregate([
      {
        $match: {
          accountId: accountObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$type",
          totalRevenue: { $sum: "$total" },
          totalQty: { $sum: "$quantity" },
          count: { $sum: 1 },
        },
      },
    ]),
    // 3. PURCHASES TOTALS FOR THE MONTH
    Purchase.aggregate([
      {
        $match: {
          accountId: accountObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$totalCost" },
          totalMilkQty: { $sum: "$milkQuantity" },
          count: { $sum: 1 },
        },
      },
    ]),
    // 4. EXPENDITURES BY CATEGORY FOR THE MONTH
    Expenditure.aggregate([
      {
        $match: {
          accountId: accountObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    // 5. DELIVERY RECORDS BY STATUS FOR THE MONTH
    DeliveryRecord.aggregate([
      {
        $match: {
          accountId: accountObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalMilk: { $sum: "$milkQuantity" },
        },
      },
    ]),
    // 6. MONTHLY DELIVERY BILLING DUE — JOINS DELIVERY RECORDS WITH CUSTOMERS FOR THIS BILLING MONTH
    DeliveryRecord.aggregate([
      {
        $match: {
          accountId: accountObjectId,
          date: { $gte: startDate, $lte: endDate },
          status: "delivered",
        },
      },
      { $group: { _id: "$customerId", totalMilk: { $sum: "$milkQuantity" } } },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customerData",
        },
      },
      {
        $unwind: { path: "$customerData", preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: null,
          monthlyBillingDue: {
            $sum: {
              $multiply: [
                "$totalMilk",
                { $ifNull: ["$customerData.pricePerLiter", 0] },
              ],
            },
          },
        },
      },
    ]),
    // 7. PAYMENTS RECEIVED FOR THIS BILLING MONTH
    Payment.aggregate([
      { $match: { accountId: accountObjectId, billingMonth: monthStr } },
      { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
    ]),
    // 8. ALL STAFF COUNT AND TOTAL SALARY BILL
    StaffMember.aggregate([
      { $match: { accountId: accountObjectId } },
      {
        $group: {
          _id: null,
          totalStaff: { $sum: 1 },
          totalSalaryBill: { $sum: "$monthlySalary" },
        },
      },
    ]),
    // 9. STAFF MONTH PAYMENT STATUS FOR THE SELECTED MONTH
    StaffMonthRecord.aggregate([
      { $match: { accountId: accountObjectId, month: monthStr } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$paidAmount" },
          totalExtraAllocated: { $sum: "$totalExtraAllocated" },
          clearedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "cleared"] }, 1, 0],
            },
          },
        },
      },
    ]),
    // 10. TOTAL CUSTOMER COUNT
    Customer.countDocuments({ accountId }),
    // 11. ALL-TIME CUSTOMER SALES OUTSTANDING
    Sale.aggregate([
      { $match: { accountId: accountObjectId, saleType: "customer" } },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: "$pendingAmount" },
          totalDue: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$paidAmount" },
        },
      },
    ]),
    // 12. ALL-TIME DELIVERY BILLING DUE (JOINS DELIVERY RECORDS WITH CUSTOMERS)
    DeliveryRecord.aggregate([
      { $match: { accountId: accountObjectId, status: "delivered" } },
      { $group: { _id: "$customerId", totalMilk: { $sum: "$milkQuantity" } } },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customerData",
        },
      },
      {
        $unwind: { path: "$customerData", preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: null,
          allTimeDue: {
            $sum: {
              $multiply: [
                "$totalMilk",
                { $ifNull: ["$customerData.pricePerLiter", 0] },
              ],
            },
          },
        },
      },
    ]),
    // 13. ALL-TIME DELIVERY PAYMENTS RECEIVED
    Payment.aggregate([
      { $match: { accountId: accountObjectId } },
      { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
    ]),
  ]);
  // INITIALIZING SALES MAP
  const salesMap = {};
  // LOOPING THROUGH SALES AGGREGATE
  salesAgg.forEach(
    ({ _id, totalAmount, paidAmount, pendingAmount, totalQty, count }) => {
      // ADDING SALE TO SALES MAP
      salesMap[`${_id.saleType}_${_id.productType}`] = {
        totalAmount,
        paidAmount,
        pendingAmount,
        qty: totalQty,
        count,
      };
    },
  );
  // EXTRACTING THE CUSTOMER MILK SALE TYPE FROM SALES MAP
  const cm = salesMap["customer_milk"] || {};
  // EXTRACTING THE CUSTOMER YOGHURT SALE TYPE FROM SALES MAP
  const cy = salesMap["customer_yoghurt"] || {};
  // EXTRACTING THE SHOP MILK SALE TYPE FROM SALES MAP
  const sm = salesMap["shop_milk"] || {};
  // EXTRACTING THE SHOP YOGHURT SALE TYPE FROM SALES MAP
  const sy = salesMap["shop_yoghurt"] || {};
  // BUILDING CUSTOMER SALES AGGREGATE
  const customerSales = {
    totalAmount: sf((cm.totalAmount || 0) + (cy.totalAmount || 0)),
    paidAmount: sf((cm.paidAmount || 0) + (cy.paidAmount || 0)),
    pendingAmount: sf((cm.pendingAmount || 0) + (cy.pendingAmount || 0)),
    milkQty: sf(cm.qty || 0, 3),
    yoghurtQty: sf(cy.qty || 0, 3),
    count: (cm.count || 0) + (cy.count || 0),
  };
  // BUILDING SHOP SALES AGGREGATE
  const shopSales = {
    totalAmount: sf((sm.totalAmount || 0) + (sy.totalAmount || 0)),
    milkQty: sf(sm.qty || 0, 3),
    yoghurtQty: sf(sy.qty || 0, 3),
    count: (sm.count || 0) + (sy.count || 0),
  };
  // INITIALIZING QUICK SALES MAP
  const qsMap = {};
  // LOOPING THROUGH QUICK SALES AGGREGATE
  quickSalesAgg.forEach(({ _id, totalRevenue, totalQty, count }) => {
    // ADDING QUICK SALE TO QUICK SALES MAP
    qsMap[_id] = { totalRevenue, qty: totalQty, count };
  });
  // EXTRACTING THE MILK QUICK SALES FROM QUICK SALES MAP
  const qsMilk = qsMap["milk"] || {};
  // EXTRACTING THE YOGHURT QUICK SALES FROM QUICK SALES MAP
  const qsYoghurt = qsMap["yoghurt"] || {};
  // BUILDING QUICK SALES AGGREGATE
  const quickSales = {
    totalRevenue: sf(
      (qsMilk.totalRevenue || 0) + (qsYoghurt.totalRevenue || 0),
    ),
    milkRevenue: sf(qsMilk.totalRevenue || 0),
    yoghurtRevenue: sf(qsYoghurt.totalRevenue || 0),
    milkQty: sf(qsMilk.qty || 0, 3),
    yoghurtQty: sf(qsYoghurt.qty || 0, 3),
    count: (qsMilk.count || 0) + (qsYoghurt.count || 0),
  };
  // COMPUTING PURCHASES AGGREGATE
  const purchRaw = purchasesAgg[0] || {};
  // BUILDING PURCHASES AGGREGATE
  const purchases = {
    totalSpent: sf(purchRaw.totalSpent),
    totalMilkQty: sf(purchRaw.totalMilkQty, 3),
    avgCostPerLiter:
      purchRaw.totalMilkQty > 0
        ? sf(purchRaw.totalSpent / purchRaw.totalMilkQty)
        : 0,
    count: purchRaw.count || 0,
  };
  // INITIALIZING EXPENDITURES MAP
  const expMap = {};
  // INITIALIZING EXPENDITURES TOTAL
  let expTotal = 0;
  // INITIALIZING EXPENDITURES COUNT
  let expCount = 0;
  // LOOPING THROUGH EXPENDITURES AGGREGATE
  expendituresAgg.forEach(({ _id, total, count }) => {
    // ADDING EXPENDITURE TO EXPENDITURES MAP
    expMap[_id] = sf(total);
    // UPDATING EXPENDITURES TOTAL
    expTotal += total;
    // UPDATING EXPENDITURES COUNT
    expCount += count;
  });
  // BUILDING EXPENDITURES AGGREGATE
  const expenditures = {
    totalAmount: sf(expTotal),
    byCategory: {
      supplies: expMap["supplies"] || 0,
      meals: expMap["meals"] || 0,
      transport: expMap["transport"] || 0,
      misc: expMap["misc"] || 0,
    },
    count: expCount,
  };
  // INITIALIZING DELIVERY STATUS MAP
  const delivStatusMap = {};
  // LOOPING THROUGH DELIVERY STATUS AGGREGATE
  deliveryStatusAgg.forEach(({ _id, count, totalMilk }) => {
    // ADDING DELIVERY STATUS TO DELIVERY STATUS MAP
    delivStatusMap[_id] = { count, totalMilk };
  });
  // COMPUTING THE DELIVERED DELIVERY STATS
  const deliveredStats = delivStatusMap["delivered"] || {
    count: 0,
    totalMilk: 0,
  };
  // COMPUTING THE MISSED DELIVERY STATS
  const missedStats = delivStatusMap["missed"] || { count: 0, totalMilk: 0 };
  // COMPUTING THE MONTHLY BILLING DUE
  const monthlyBillingDue = sf(deliveryBillingAgg[0]?.monthlyBillingDue || 0);
  // COMPUTING THE MONTHLY BILLING PAID
  const monthlyBillingPaid = sf(monthPaymentsAgg[0]?.totalPaid || 0);
  // COMPUTING THE MONTHLY BILLING PENDING
  const monthlyBillingPending = sf(
    Math.max(0, monthlyBillingDue - monthlyBillingPaid),
  );
  // COMPUTING TOTAL DELIVERY DAYS FOR RATE CALCULATION
  const totalDeliveryDays = deliveredStats.count + missedStats.count;
  // COMPUTING THE DELIVERY RATE
  const deliveryRate =
    totalDeliveryDays > 0
      ? sf((deliveredStats.count / totalDeliveryDays) * 100, 1)
      : 0;
  // BUILDING DELIVERIES AGGREGATE
  const deliveries = {
    totalCustomers: customerCount,
    deliveredDays: deliveredStats.count,
    missedDays: missedStats.count,
    totalMilkDelivered: sf(deliveredStats.totalMilk, 3),
    monthlyBillingDue,
    monthlyBillingPaid,
    monthlyBillingPending,
    deliveryRate,
  };
  // COMPUTING THE STAFF COUNT
  const staffCountRaw = staffCountAgg[0] || {};
  // COMPUTING THE STAFF MONTH
  const staffMonthRaw = staffMonthAgg[0] || {};
  // COMPUTING THE TOTAL STAFF
  const totalStaff = staffCountRaw.totalStaff || 0;
  // COMPUTING THE TOTAL SALARY BILL
  const totalSalaryBill = sf(staffCountRaw.totalSalaryBill);
  // COMPUTING THE STAFF PAID
  const staffPaid = sf(staffMonthRaw.totalPaid);
  // COMPUTING THE TOTAL EXTRA ALLOCATED
  const totalExtraAllocated = sf(staffMonthRaw.totalExtraAllocated);
  // COMPUTING THE CLEARED COUNT
  const clearedCount = staffMonthRaw.clearedCount || 0;
  // COMPUTING THE TOTAL MONTHLY OUTGO
  const totalMonthlyOutgo = sf(totalSalaryBill + totalExtraAllocated);
  // BUILDING STAFF AGGREGATE
  const staff = {
    totalStaff,
    totalSalaryBill,
    totalMonthlyOutgo,
    totalPaid: staffPaid,
    totalPending: sf(Math.max(0, totalSalaryBill - staffPaid)),
    totalExtraAllocated,
    clearedCount,
    pendingCount: totalStaff - clearedCount,
  };
  // COMPUTING THE TOTAL SALES OUTSTANDING
  const salesOutRaw = salesOutstandingAgg[0] || {};
  // COMPUTING THE SALES OUTSTANDING
  const salesOutstanding = sf(salesOutRaw.totalOutstanding);
  // COMPUTING THE ALL-TIME DELIVERY BILLING DUE
  const allTimeDeliveryDue = sf(allTimeDeliveryBillingAgg[0]?.allTimeDue || 0);
  // COMPUTING THE ALL-TIME PAYMENTS PAID
  const allTimePaymentsPaid = sf(allTimePaymentsAgg[0]?.totalPaid || 0);
  // COMPUTING THE DELIVERY OUTSTANDING
  const deliveryOutstanding = sf(
    Math.max(0, allTimeDeliveryDue - allTimePaymentsPaid),
  );
  // COMPUTING THE TOTAL OUTSTANDING
  const totalOutstanding = sf(salesOutstanding + deliveryOutstanding);
  // COMPUTING THE ALL-TIME DUE
  const totalAllTimeDue = sf((salesOutRaw.totalDue || 0) + allTimeDeliveryDue);
  // COMPUTING THE ALL-TIME PAID
  const totalAllTimePaid = sf(
    (salesOutRaw.totalPaid || 0) + allTimePaymentsPaid,
  );
  // COMPUTING THE RECOVERY RATE
  const recoveryRate =
    totalAllTimeDue > 0 ? sf((totalAllTimePaid / totalAllTimeDue) * 100, 1) : 0;
  // BUILDING RECOVERY AGGREGATE
  const recovery = {
    deliveryOutstanding,
    salesOutstanding,
    totalOutstanding,
    totalAllTimeDue,
    totalAllTimePaid,
    recoveryRate,
  };
  // COMPUTING THE TOTAL REVENUE
  const totalRevenue = sf(
    customerSales.totalAmount + shopSales.totalAmount + quickSales.totalRevenue,
  );
  // COMPUTING THE TOTAL EXPENSES
  const totalExpenses = sf(
    purchases.totalSpent + expenditures.totalAmount + staff.totalMonthlyOutgo,
  );
  // COMPUTING THE NET POSITION
  const netPosition = sf(totalRevenue - totalExpenses);
  // COMPUTING THE GROSS PROFIT
  const grossProfit = sf(totalRevenue - purchases.totalSpent);
  // BUILDING OVERVIEW
  const overview = { totalRevenue, totalExpenses, netPosition, grossProfit };
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Dashboard Summary Fetched Successfully!",
    success: true,
    data: {
      overview,
      sales: { customerSales, shopSales },
      quickSales,
      purchases,
      expenditures,
      deliveries,
      staff,
      recovery,
      appliedFilter: { month: monthStr, startDate, endDate },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * GET PAGINATED SALES RECORDS FOR THE SELECTED MONTH
 * SUPPORTS SALE TYPE FILTER (ALL | CUSTOMER | SHOP)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET DASHBOARD SALES ==>
export const getDashboardSales = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING MONTH STRING
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING DATE RANGE FOR SELECTED MONTH
  const { startDate, endDate } = getMonthDateRange(monthStr);
  // GETTING SALE TYPE FILTER
  const saleType = req.query.saleType || "all";
  // PARSING THE PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING THE LIMIT NUMBER
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
  // CALCULATING SKIP
  const skip = (page - 1) * limit;
  // BUILDING MATCH QUERY SCOPED TO THIS ACCOUNT
  const matchQuery = {
    accountId: new mongoose.Types.ObjectId(accountId),
    date: { $gte: startDate, $lte: endDate },
  };
  // APPLYING SALE TYPE FILTER IF NOT ALL
  if (saleType !== "all") matchQuery.saleType = saleType;
  // RUNNING COUNT AND PAGINATED FETCH IN PARALLEL
  const [total, records] = await Promise.all([
    Sale.countDocuments(matchQuery),
    Sale.find(matchQuery)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Dashboard Sales Fetched Successfully!",
    success: true,
    data: {
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * GET PAGINATED QUICK SALE RECORDS FOR THE SELECTED MONTH
 * SUPPORTS PRODUCT TYPE FILTER (ALL | MILK | YOGHURT)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET DASHBOARD QUICK SALES ==>
export const getDashboardQuickSales = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING MONTH STRING
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING DATE RANGE
  const { startDate, endDate } = getMonthDateRange(monthStr);
  // GETTING PRODUCT TYPE FILTER
  const productType = req.query.productType || "all";
  // PARSING THE PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING THE LIMIT NUMBER
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
  // CALCULATING SKIP NUMBER
  const skip = (page - 1) * limit;
  // BUILDING MATCH QUERY SCOPED TO THIS ACCOUNT
  const matchQuery = {
    accountId: new mongoose.Types.ObjectId(accountId),
    date: { $gte: startDate, $lte: endDate },
  };
  // APPLYING PRODUCT TYPE FILTER IF NOT ALL
  if (productType !== "all") matchQuery.type = productType;
  // RUNNING COUNT AND PAGINATED FETCH IN PARALLEL
  const [total, records] = await Promise.all([
    QuickSale.countDocuments(matchQuery),
    QuickSale.find(matchQuery)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Dashboard Quick Sales Fetched Successfully!",
    success: true,
    data: {
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * GET PAGINATED PURCHASE RECORDS FOR THE SELECTED MONTH
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET DASHBOARD PURCHASES ==>
export const getDashboardPurchases = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING MONTH STRING
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING DATE RANGE
  const { startDate, endDate } = getMonthDateRange(monthStr);
  // PARSING THE PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING THE LIMIT NUMBER
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
  // CALCULATING SKIP NUMBER
  const skip = (page - 1) * limit;
  // BUILDING MATCH QUERY SCOPED TO THIS ACCOUNT
  const matchQuery = {
    accountId: new mongoose.Types.ObjectId(accountId),
    date: { $gte: startDate, $lte: endDate },
  };
  // RUNNING COUNT AND PAGINATED FETCH IN PARALLEL
  const [total, records] = await Promise.all([
    Purchase.countDocuments(matchQuery),
    Purchase.find(matchQuery)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Dashboard Purchases Fetched Successfully!",
    success: true,
    data: {
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * GET PAGINATED EXPENDITURE RECORDS FOR THE SELECTED MONTH
 * SUPPORTS CATEGORY FILTER (ALL | SUPPLIES | MEALS | TRANSPORT | MISC)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET DASHBOARD EXPENDITURES ==>
export const getDashboardExpenditures = expressAsyncHandler(
  async (req, res) => {
    // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
    const accountId = req.accountId;
    // GETTING MONTH STRING
    const monthStr = req.query.month || getCurrentMonthStr();
    // GETTING DATE RANGE
    const { startDate, endDate } = getMonthDateRange(monthStr);
    // GETTING CATEGORY FILTER
    const category = req.query.category || "all";
    // PARSING THE PAGE NUMBER
    const page = Math.max(1, parseInt(req.query.page) || 1);
    // PARSING THE LIMIT NUMBER
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
    // CALCULATING SKIP NUMBER
    const skip = (page - 1) * limit;
    // BUILDING MATCH QUERY SCOPED TO THIS ACCOUNT
    const matchQuery = {
      accountId: new mongoose.Types.ObjectId(accountId),
      date: { $gte: startDate, $lte: endDate },
    };
    // APPLYING CATEGORY FILTER IF NOT ALL
    if (category !== "all") matchQuery.category = category;
    // RUNNING COUNT AND PAGINATED FETCH IN PARALLEL
    const [total, records] = await Promise.all([
      Expenditure.countDocuments(matchQuery),
      Expenditure.find(matchQuery)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);
    // RETURNING SUCCESS RESPONSE
    res.status(200).json({
      message: "Dashboard Expenditures Fetched Successfully!",
      success: true,
      data: {
        records,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
    });
    // RETURNING FROM FUNCTION
    return;
  },
);

/**
 * GET PAGINATED STAFF MEMBERS WITH THEIR MONTH SALARY STATUS
 * GATED TO ADMIN-AND-ABOVE AT THE ROUTE LEVEL — PAYROLL DATA IS ALWAYS RESTRICTED
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET DASHBOARD STAFF ==>
export const getDashboardStaff = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING MONTH STRING
  const monthStr = req.query.month || getCurrentMonthStr();
  // PARSING THE PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING THE LIMIT NUMBER
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
  // CALCULATING SKIP NUMBER
  const skip = (page - 1) * limit;
  // RUNNING COUNT AND PAGINATED STAFF FETCH IN PARALLEL
  const [total, staffMembers] = await Promise.all([
    StaffMember.countDocuments({ accountId }),
    StaffMember.find({ accountId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);
  // FETCHING MONTH RECORDS FOR THIS PAGE'S STAFF MEMBERS
  const staffIds = staffMembers.map((s) => s._id);
  // FETCHING MONTH RECORDS
  const monthRecords = await StaffMonthRecord.find({
    staffId: { $in: staffIds },
    month: monthStr,
  })
    .lean()
    .exec();
  // BUILDING MONTH RECORD MAP FOR O(1) LOOKUP
  const monthRecordMap = {};
  // LOOPING THROUGH MONTH RECORDS
  monthRecords.forEach((r) => {
    // MAPPING STAFF ID TO MONTH RECORD
    monthRecordMap[r.staffId.toString()] = r;
  });
  // ENRICHING STAFF MEMBERS WITH THEIR MONTH RECORD AND COMPUTED SALARY DUE
  const records = staffMembers.map((s) => {
    // GETTING MONTH RECORD FOR THIS STAFF MEMBER
    const mr = monthRecordMap[s._id.toString()] || null;
    // COMPUTING REMAINING SALARY DUE
    const salaryDue = parseFloat(
      Math.max(0, s.monthlySalary - (mr?.paidAmount ?? 0)).toFixed(2),
    );
    // RETURNING ENRICHED STAFF RECORD
    return { ...s, monthRecord: mr, salaryDue };
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Dashboard Staff Fetched Successfully!",
    success: true,
    data: {
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * GET PAGINATED CUSTOMERS WITH THEIR DELIVERY AND BILLING STATS FOR THE SELECTED MONTH
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET DASHBOARD CUSTOMERS ==>
export const getDashboardCustomers = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING MONTH STRING
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING DATE RANGE
  const { startDate, endDate } = getMonthDateRange(monthStr);
  // PARSING THE PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING THE LIMIT NUMBER
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
  // CALCULATING SKIP NUMBER
  const skip = (page - 1) * limit;
  // RUNNING COUNT AND PAGINATED CUSTOMER FETCH IN PARALLEL
  const [total, customers] = await Promise.all([
    Customer.countDocuments({ accountId }),
    Customer.find({ accountId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);
  // EXTRACTING CUSTOMER IDS FOR BATCH QUERIES
  const customerIds = customers.map((c) => c._id);
  // BATCH FETCHING DELIVERY RECORDS AND PAYMENTS FOR THIS PAGE'S CUSTOMERS IN PARALLEL
  const [deliveryRecords, payments] = await Promise.all([
    DeliveryRecord.find({
      customerId: { $in: customerIds },
      date: { $gte: startDate, $lte: endDate },
    })
      .lean()
      .exec(),
    Payment.find({
      customerId: { $in: customerIds },
      billingMonth: monthStr,
    })
      .lean()
      .exec(),
  ]);
  // BUILDING DELIVERY STATS MAP PER CUSTOMER
  const deliveryMap = {};
  // LOOPING THROUGH ALL DELIVERY RECORDS
  deliveryRecords.forEach((r) => {
    // GETTING STRING KEY FOR CUSTOMER ID
    const key = r.customerId.toString();
    // IF KEY DOES NOT EXIST IN DELIVERY MAP
    if (!deliveryMap[key])
      // INITIALIZING DELIVERY STATS
      deliveryMap[key] = { deliveredDays: 0, missedDays: 0, totalMilk: 0 };
    // IF DELIVERY RECORD WAS DELIVERED
    if (r.status === "delivered") {
      // UPDATING DELIVERY STATS
      deliveryMap[key].deliveredDays++;
      // UPDATING TOTAL MILK
      deliveryMap[key].totalMilk += r.milkQuantity;
    } else if (r.status === "missed") {
      // UPDATING MISSED DAYS
      deliveryMap[key].missedDays++;
    }
  });
  // BUILDING PAYMENT TOTALS MAP PER CUSTOMER
  const paymentMap = {};
  // LOOPING THROUGH ALL PAYMENTS
  payments.forEach((p) => {
    // GETTING STRING KEY FOR CUSTOMER ID
    const key = p.customerId.toString();
    // INITIALIZING PAYMENT TOTAL IF NOT EXISTS
    paymentMap[key] = (paymentMap[key] || 0) + p.amount;
  });
  // ENRICHING CUSTOMERS WITH THEIR MONTHLY DELIVERY AND BILLING STATS
  const records = customers.map((c) => {
    // GETTING CUSTOMER ID
    const custId = c._id.toString();
    // GETTING DELIVERY STATS
    const delivStats = deliveryMap[custId] || {
      deliveredDays: 0,
      missedDays: 0,
      totalMilk: 0,
    };
    // COMPUTING THE DUE BILLING AMOUNT
    const billingDue = parseFloat(
      (delivStats.totalMilk * c.pricePerLiter).toFixed(2),
    );
    // COMPUTING THE PAID BILLING AMOUNT
    const billingPaid = parseFloat((paymentMap[custId] || 0).toFixed(2));
    // COMPUTING THE PENDING BILLING AMOUNT
    const billingPending = parseFloat(
      Math.max(0, billingDue - billingPaid).toFixed(2),
    );
    // RETURNING ENRICHED CUSTOMER RECORD
    return {
      ...c,
      monthStats: {
        deliveredDays: delivStats.deliveredDays,
        missedDays: delivStats.missedDays,
        totalMilkDelivered: parseFloat(delivStats.totalMilk.toFixed(3)),
        billingDue,
        billingPaid,
        billingPending,
      },
    };
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Dashboard Customers Fetched Successfully!",
    success: true,
    data: {
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});
