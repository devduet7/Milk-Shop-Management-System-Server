// <== IMPORTS ==>
import mongoose from "mongoose";
import { Sale } from "../models/sale.model.js";
import { Payment } from "../models/payment.model.js";
import { Purchase } from "../models/purchase.model.js";
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
  return { startDate, endDate, totalDays: lastDay };
};

// <== HELPER: GET ALL DAYS IN MONTH AS YYYY-MM-DD STRINGS ==>
const getAllDaysInMonth = (monthStr) => {
  // PARSING YEAR AND MONTH FROM YYYY-MM STRING
  const [year, month] = monthStr.split("-").map(Number);
  // CALCULATING LAST DAY OF MONTH
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // BUILDING ARRAY OF YYYY-MM-DD STRINGS
  const days = [];
  // FILLING ARRAY
  for (let d = 1; d <= daysInMonth; d++) {
    // PUSHING YYYY-MM-DD STRING
    days.push(
      `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  // RETURNING ARRAY
  return days;
};

// <== HELPER: SAFE FLOAT ROUNDING ==>
const sf = (n, d = 2) => parseFloat((n ?? 0).toFixed(d));

// <== EXPENDITURE CATEGORY LABELS ==>
const CATEGORY_LABELS = {
  // SUPPLIES CATEGORY
  supplies: "Supplies",
  // MEALS CATEGORY
  meals: "Meals",
  // TRANSPORT CATEGORY
  transport: "Transport",
  // MISCELLANEOUS CATEGORY
  misc: "Misc",
};

// <== ALL EXPENDITURE CATEGORIES — ENSURES ALL CATEGORIES PRESENT EVEN WITH ZERO AMOUNTS ==>
const ALL_CATEGORIES = ["supplies", "meals", "transport", "misc"];

/**
 * GET COMPREHENSIVE ANALYTICS DATA FOR THE SELECTED MONTH
 * ALL 13 AGGREGATIONS RUN IN PARALLEL VIA PROMISE.ALL
 * DAILY ARRAYS ARE FILLED FOR ALL DAYS IN THE MONTH — MISSING DAYS DEFAULT TO ZERO
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET ANALYTICS DATA ==>
export const getAnalyticsData = expressAsyncHandler(async (req, res) => {
  // GETTING USER ID FROM AUTHENTICATED REQUEST
  const userId = req.id;
  // GETTING MONTH STRING — DEFAULTS TO CURRENT MONTH
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING DATE RANGE AND TOTAL DAYS FOR SELECTED MONTH
  const { startDate, endDate, totalDays } = getMonthDateRange(monthStr);
  // USER OBJECT ID FOR AGGREGATION QUERIES
  const userObjectId = new mongoose.Types.ObjectId(userId);
  // GENERATING ALL DAYS FOR THE MONTH — USED TO FILL MISSING DAYS WITH ZEROS
  const allDays = getAllDaysInMonth(monthStr);
  // RUNNING ALL 13 AGGREGATIONS IN PARALLEL
  const [
    dailySalesAgg,
    dailyQSAgg,
    dailyPurchasesAgg,
    dailyExpendituresAgg,
    dailyDeliveriesAgg,
    salesBreakdownAgg,
    qsBreakdownAgg,
    expByCategoryAgg,
    staffMembersRaw,
    staffMonthRecordsRaw,
    salesOutstandingAgg,
    allTimeDelivBillingAgg,
    allTimePaymentsAgg,
  ] = await Promise.all([
    // 1. DAILY SALES REVENUE — GROUP BY DATE, SUM TOTAL AMOUNT ACROSS ALL SALE TYPES
    Sale.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: "$date", revenue: { $sum: "$totalAmount" } } },
    ]),
    // 2. DAILY QUICK SALES REVENUE — GROUP BY { DATE, TYPE } FOR PER-PRODUCT BREAKDOWN
    QuickSale.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { date: "$date", type: "$type" },
          revenue: { $sum: "$total" },
          qty: { $sum: "$quantity" },
        },
      },
    ]),
    // 3. DAILY PURCHASES — GROUP BY DATE, SUM TOTAL COST AND MILK QUANTITY
    Purchase.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$date",
          cost: { $sum: "$totalCost" },
          qty: { $sum: "$milkQuantity" },
        },
      },
    ]),
    // 4. DAILY EXPENDITURES — GROUP BY DATE, SUM AMOUNT
    Expenditure.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: "$date", amount: { $sum: "$amount" } } },
    ]),
    // 5. DAILY DELIVERIES — GROUP BY DATE WITH CONDITIONAL SUMS FOR STATUS COUNTS
    DeliveryRecord.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$date",
          delivered: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          missed: {
            $sum: { $cond: [{ $eq: ["$status", "missed"] }, 1, 0] },
          },
          milkQty: {
            $sum: {
              $cond: [{ $eq: ["$status", "delivered"] }, "$milkQuantity", 0],
            },
          },
        },
      },
    ]),
    // 6. SALES BREAKDOWN BY SALE TYPE × PRODUCT TYPE FOR CATEGORY CHART
    Sale.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { saleType: "$saleType", productType: "$productType" },
          total: { $sum: "$totalAmount" },
          qty: { $sum: "$quantity" },
          count: { $sum: 1 },
        },
      },
    ]),
    // 7. QUICK SALES BREAKDOWN BY TYPE
    QuickSale.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$total" },
          qty: { $sum: "$quantity" },
          count: { $sum: 1 },
        },
      },
    ]),
    // 8. EXPENDITURES BY CATEGORY
    Expenditure.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    // 9. ALL STAFF MEMBERS — NO LIMIT, ANALYTICS NEEDS FULL PAYROLL PICTURE
    StaffMember.find({ userId }).sort({ name: 1 }).lean().exec(),
    // 10. STAFF MONTH RECORDS FOR THE SELECTED MONTH
    StaffMonthRecord.find({ userId, month: monthStr }).lean().exec(),
    // 11. ALL-TIME CUSTOMER SALES OUTSTANDING
    Sale.aggregate([
      { $match: { userId: userObjectId, saleType: "customer" } },
      {
        $group: {
          _id: null,
          outstanding: { $sum: "$pendingAmount" },
          due: { $sum: "$totalAmount" },
          paid: { $sum: "$paidAmount" },
        },
      },
    ]),
    // 12. ALL-TIME DELIVERY BILLING DUE — JOINS DELIVERY RECORDS WITH CUSTOMERS
    DeliveryRecord.aggregate([
      { $match: { userId: userObjectId, status: "delivered" } },
      { $group: { _id: "$customerId", totalMilk: { $sum: "$milkQuantity" } } },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "cd",
        },
      },
      {
        $unwind: { path: "$cd", preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: null,
          allTimeDue: {
            $sum: {
              $multiply: ["$totalMilk", { $ifNull: ["$cd.pricePerLiter", 0] }],
            },
          },
        },
      },
    ]),
    // 13. ALL-TIME DELIVERY PAYMENTS RECEIVED
    Payment.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
    ]),
  ]);
  // SALES DAILY MAP
  const salesDailyMap = {};
  // LOOP THROUGH SALES AND POPULATE DAILY MAP
  dailySalesAgg.forEach(({ _id, revenue }) => {
    // IF DAILY MAP DOES NOT EXIST, CREATE IT
    salesDailyMap[_id] = revenue;
  });

  // QUICK SALES DAILY MAP
  const qsDailyMap = {};
  // QUICK SALES TOTAL DAILY MAP
  const qsDailyTotalMap = {};
  // LOOP THROUGH QUICK SALES AND POPULATE DAILY MAP
  dailyQSAgg.forEach(({ _id, revenue, qty }) => {
    // IF DAILY MAP DOES NOT EXIST, CREATE IT
    if (!qsDailyMap[_id.date])
      // INITIALIZE DAILY MAP
      qsDailyMap[_id.date] = {
        // MILK REVENUE
        milkRevenue: 0,
        // YOGHURT REVENUE
        yoghurtRevenue: 0,
        // MILK QTY
        milkQty: 0,
        // YOGHURT QTY
        yoghurtQty: 0,
      };
    // POPULATE DAILY MAP
    qsDailyTotalMap[_id.date] = (qsDailyTotalMap[_id.date] || 0) + revenue;
    // IF TYPE IS MILK
    if (_id.type === "milk") {
      // POPULATE DAILY MAP REVENUE
      qsDailyMap[_id.date].milkRevenue = sf(revenue);
      // POPULATE DAILY MAP QTY
      qsDailyMap[_id.date].milkQty = sf(qty, 3);
    } else {
      // POPULATE DAILY MAP REVENUE
      qsDailyMap[_id.date].yoghurtRevenue = sf(revenue);
      // POPULATE DAILY MAP QTY
      qsDailyMap[_id.date].yoghurtQty = sf(qty, 3);
    }
  });
  // PURCHASES DAILY MAP
  const purchaseDailyMap = {};
  // LOOP THROUGH PURCHASES AND POPULATE DAILY MAP
  dailyPurchasesAgg.forEach(({ _id, cost, qty }) => {
    // IF DAILY MAP DOES NOT EXIST, CREATE IT
    purchaseDailyMap[_id] = {
      // COST OF PURCHASE
      cost: sf(cost),
      // QUANTITY OF PURCHASE
      qty: sf(qty, 3),
      // AVERAGE RATE
      avgRate: qty > 0 ? sf(cost / qty) : 0,
    };
  });
  // EXPENDITURES DAILY MAP
  const expDailyMap = {};
  // LOOP THROUGH EXPENDITURES AND POPULATE DAILY MAP
  dailyExpendituresAgg.forEach(({ _id, amount }) => {
    // IF DAILY MAP DOES NOT EXIST, CREATE IT
    expDailyMap[_id] = amount;
  });
  // DELIVERIES DAILY MAP
  const delivDailyMap = {};
  // LOOP THROUGH DELIVERIES AND POPULATE DAILY MAP
  dailyDeliveriesAgg.forEach(({ _id, delivered, missed, milkQty }) => {
    // IF DAILY MAP DOES NOT EXIST, CREATE IT
    delivDailyMap[_id] = { delivered, missed, milkQty: sf(milkQty, 3) };
  });
  // DAILY FINANCIALS — COMBINED REVENUE AND EXPENSES PER DAY
  const dailyFinancials = allDays.map((date) => ({
    // DAY OF MONTH
    day: date.split("-")[2],
    // COMBINED REVENUE
    revenue: sf((salesDailyMap[date] || 0) + (qsDailyTotalMap[date] || 0)),
    // COMBINED PURCHASES
    purchases: sf(purchaseDailyMap[date]?.cost || 0),
    // COMBINED EXPENDITURES
    expenditures: sf(expDailyMap[date] || 0),
  }));
  // DAILY QUICK SALES — PER-PRODUCT BREAKDOWN PER DAY
  const dailyQuickSales = allDays.map((date) => ({
    // DAY OF MONTH
    day: date.split("-")[2],
    // DATE OF QUICK SALE
    ...(qsDailyMap[date] || {
      // MILK REVENUE
      milkRevenue: 0,
      // YOGHURT REVENUE
      yoghurtRevenue: 0,
      // MILK QTY
      milkQty: 0,
      // YOGHURT QTY
      yoghurtQty: 0,
    }),
  }));
  // DAILY PURCHASES — COST, QUANTITY, AND AVERAGE RATE PER DAY
  const dailyPurchases = allDays.map((date) => ({
    // DAY OF MONTH
    day: date.split("-")[2],
    // DATE OF PURCHASE
    ...(purchaseDailyMap[date] || { cost: 0, qty: 0, avgRate: 0 }),
  }));
  // DAILY DELIVERIES — DELIVERED AND MISSED COUNTS + MILK QTY PER DAY
  const dailyDeliveries = allDays.map((date) => ({
    // DAY OF MONTH
    day: date.split("-")[2],
    // DATE OF DELIVERY
    ...(delivDailyMap[date] || { delivered: 0, missed: 0, milkQty: 0 }),
  }));
  // SALES BREAKDOWN MAP
  const sbMap = {};
  // LOOP THROUGH SALES BREAKDOWN AND POPULATE MAP
  salesBreakdownAgg.forEach(({ _id, total, qty, count }) => {
    // POPULATE SALES BREAKDOWN MAP
    sbMap[`${_id.saleType}_${_id.productType}`] = {
      // SALES BREAKDOWN
      total: sf(total),
      // QUANTITY
      qty: sf(qty, 3),
      // COUNT
      count,
    };
  });
  // SALES BREAKDOWN
  const salesBreakdown = {
    // CUSTOMER MILK
    customerMilk: sbMap["customer_milk"] || { total: 0, qty: 0, count: 0 },
    // CUSTOMER YOGHURT
    customerYoghurt: sbMap["customer_yoghurt"] || {
      // SALES BREAKDOWN
      total: 0,
      // QUANTITY
      qty: 0,
      // COUNT
      count: 0,
    },
    // SHOP MILK
    shopMilk: sbMap["shop_milk"] || { total: 0, qty: 0, count: 0 },
    // SHOP YOGHURT
    shopYoghurt: sbMap["shop_yoghurt"] || { total: 0, qty: 0, count: 0 },
  };
  // QUICK SALES BREAKDOWN MAP
  const qsbMap = {};
  // LOOP THROUGH QUICK SALES BREAKDOWN AND POPULATE MAP
  qsBreakdownAgg.forEach(({ _id, total, qty, count }) => {
    // POPULATE QUICK SALES BREAKDOWN MAP
    qsbMap[_id] = { total: sf(total), qty: sf(qty, 3), count };
  });
  // QUICK SALES BREAKDOWN
  const quickSalesBreakdown = {
    // MILK QUICK SALES
    milk: qsbMap["milk"] || { total: 0, qty: 0, count: 0 },
    // YOGHURT QUICK SALES
    yoghurt: qsbMap["yoghurt"] || { total: 0, qty: 0, count: 0 },
  };
  // EXPENDITURES BY CATEGORY — ALL FOUR CATEGORIES ALWAYS PRESENT
  const expCatMap = {};
  // LOOP THROUGH EXPENDITURES BY CATEGORY AND POPULATE MAP
  expByCategoryAgg.forEach(({ _id, amount, count }) => {
    // POPULATE EXPENDITURES BY CATEGORY
    expCatMap[_id] = { amount: sf(amount), count };
  });
  // EXPENDITURES BY CATEGORY
  const expCatTotal = expByCategoryAgg.reduce(
    (sum, e) => sum + (e.amount || 0),
    0,
  );
  // EXPENDITURES BY CATEGORY
  const expendituresByCategory = ALL_CATEGORIES.map((cat) => ({
    // CATEGORY
    category: cat,
    // CATEGORY LABEL
    label: CATEGORY_LABELS[cat],
    // AMOUNT
    amount: expCatMap[cat]?.amount || 0,
    // COUNT
    count: expCatMap[cat]?.count || 0,
    // PERCENTAGE
    percentage:
      expCatTotal > 0
        ? sf(((expCatMap[cat]?.amount || 0) / expCatTotal) * 100, 1)
        : 0,
  }));
  // STAFF PAYROLL — MERGE STAFF MEMBERS WITH THEIR MONTH RECORDS
  const mrMap = {};
  // LOOP THROUGH STAFF MEMBERS
  staffMonthRecordsRaw.forEach((r) => {
    // POPULATE MONTH RECORD MAP
    mrMap[r.staffId.toString()] = r;
  });
  // STAFF PAYROLL
  const staffPayroll = staffMembersRaw.map((s) => {
    // GETTING MONTH RECORD
    const mr = mrMap[s._id.toString()] || null;
    // COMPUTING REMAINING SALARY DUE
    const paid = mr?.paidAmount ?? 0;
    // COMPUTING EXTRA ALLOCATED
    const extra = mr?.totalExtraAllocated ?? 0;
    // RETURNING ENRICHED STAFF RECORD
    return {
      name: s.name,
      salary: s.monthlySalary,
      paid: sf(paid),
      extra: sf(extra),
      due: sf(Math.max(0, s.monthlySalary - paid)),
      isCleared: mr?.status === "cleared",
    };
  });
  // TOTAL SALES REVENUE
  const totalSalesRevenue = sf(
    salesBreakdown.customerMilk.total +
      salesBreakdown.customerYoghurt.total +
      salesBreakdown.shopMilk.total +
      salesBreakdown.shopYoghurt.total,
  );
  // TOTAL QUICK SALES REVENUE
  const totalQuickSalesRevenue = sf(
    quickSalesBreakdown.milk.total + quickSalesBreakdown.yoghurt.total,
  );
  // TOTAL REVENUE
  const totalRevenue = sf(totalSalesRevenue + totalQuickSalesRevenue);
  // TOTAL PURCHASE COST
  const totalPurchaseCost = sf(
    dailyPurchasesAgg.reduce((sum, d) => sum + (d.cost || 0), 0),
  );
  // TOTAL EXPENSES AMOUNT
  const totalExpenditureAmount = sf(
    expByCategoryAgg.reduce((sum, e) => sum + (e.amount || 0), 0),
  );
  // TOTAL STAFF OUTGO
  const totalStaffBill = sf(
    staffMembersRaw.reduce((sum, s) => sum + s.monthlySalary, 0),
  );
  // TOTAL STAFF EXTRA
  const totalStaffExtra = sf(
    staffMonthRecordsRaw.reduce(
      (sum, r) => sum + (r.totalExtraAllocated || 0),
      0,
    ),
  );
  // TOTAL STAFF OUTGO
  const totalStaffOutgo = sf(totalStaffBill + totalStaffExtra);
  // TOTAL EXPENSES
  const totalExpenses = sf(
    totalPurchaseCost + totalExpenditureAmount + totalStaffOutgo,
  );
  // NET POSITION
  const netPosition = sf(totalRevenue - totalExpenses);
  // GROSS PROFIT
  const grossProfit = sf(totalRevenue - totalPurchaseCost);
  // SALES OUTSTANDING RAW
  const salesOutstandingRaw = salesOutstandingAgg[0] || {};
  // COMPUTING SALES OUTSTANDING
  const salesOutstanding = sf(salesOutstandingRaw.outstanding || 0);
  // COMPUTING DELIVERY OUTSTANDING
  const allTimeDelivDue = sf(allTimeDelivBillingAgg[0]?.allTimeDue || 0);
  // COMPUTING PAYMENTS PAID
  const allTimePaymentsPaid = sf(allTimePaymentsAgg[0]?.totalPaid || 0);
  // COMPUTING DELIVERY OUTSTANDING
  const deliveryOutstanding = sf(
    Math.max(0, allTimeDelivDue - allTimePaymentsPaid),
  );
  // COMPUTING TOTAL OUTSTANDING
  const totalOutstanding = sf(salesOutstanding + deliveryOutstanding);
  // COMPUTING TOTAL ALL TIME DUE
  const totalAllTimeDue = sf((salesOutstandingRaw.due || 0) + allTimeDelivDue);
  // COMPUTING TOTAL ALL TIME PAID
  const totalAllTimePaid = sf(
    (salesOutstandingRaw.paid || 0) + allTimePaymentsPaid,
  );
  // COMPUTING RECOVERY RATE
  const recoveryRate =
    totalAllTimeDue > 0 ? sf((totalAllTimePaid / totalAllTimeDue) * 100, 1) : 0;
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Analytics Data Fetched Successfully!",
    success: true,
    data: {
      dailyFinancials,
      dailyQuickSales,
      dailyPurchases,
      dailyDeliveries,
      salesBreakdown,
      quickSalesBreakdown,
      expendituresByCategory,
      staffPayroll,
      financialSummary: {
        totalRevenue,
        totalSalesRevenue,
        totalQuickSalesRevenue,
        totalExpenses,
        totalPurchaseCost,
        totalExpenditureAmount,
        totalStaffOutgo,
        netPosition,
        grossProfit,
      },
      recovery: {
        deliveryOutstanding,
        salesOutstanding,
        totalOutstanding,
        totalAllTimeDue,
        totalAllTimePaid,
        recoveryRate,
      },
      appliedFilter: { month: monthStr, startDate, endDate, totalDays },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});
