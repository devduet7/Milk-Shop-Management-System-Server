// <== IMPORTS ==>
import mongoose from "mongoose";
import { Sale } from "../models/sale.model.js";
import { Payment } from "../models/payment.model.js";
import { Purchase } from "../models/purchase.model.js";
import { QuickSale } from "../models/quickSale.model.js";
import { StaffMember } from "../models/staffMember.model.js";
import { Expenditure } from "../models/expenditure.model.js";
import { DeliveryRecord } from "../models/deliveryRecord.model.js";
import { StaffMonthRecord } from "../models/staffMonthRecord.model.js";

// <== HELPER: GET YESTERDAY DATE STRING (YYYY-MM-DD) ==>
export const getYesterdayDateStr = () => {
  // GET CURRENT UTC DATE
  const now = new Date();
  // BUILD YESTERDAY DATE USING UTC TO AVOID TIMEZONE DRIFT
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  // RETURN FORMATTED YYYY-MM-DD STRING
  return `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;
};

// <== HELPER: GET LAST MONTH STRING (YYYY-MM) ==>
export const getLastMonthStr = () => {
  // GET CURRENT UTC DATE
  const now = new Date();
  // BUILD LAST MONTH DATE USING UTC TO AVOID TIMEZONE DRIFT
  const lastMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  // RETURN FORMATTED YYYY-MM STRING
  return `${lastMonth.getUTCFullYear()}-${String(lastMonth.getUTCMonth() + 1).padStart(2, "0")}`;
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

// <== HELPER: SAFE FLOAT ROUNDING ==>
const sf = (n, d = 2) => parseFloat((n ?? 0).toFixed(d));

/**
 * FETCH AGGREGATED DATA FOR THE DAILY REPORT
 * COVERS SALES, QUICK SALES, PURCHASES, EXPENDITURES, AND DELIVERIES FOR A SINGLE DATE
 * ALL FIVE AGGREGATIONS RUN IN PARALLEL VIA PROMISE.ALL
 * @param {string | Object} userId - USER ID (STRING OR OBJECTID)
 * @param {string} dateStr - REPORT DATE IN YYYY-MM-DD FORMAT (YESTERDAY)
 * @returns {Promise<Object>} STRUCTURED DAILY REPORT DATA
 */
// <== FETCH DAILY REPORT DATA ==>
export const fetchDailyReportData = async (userId, dateStr) => {
  // CONVERTING USER ID TO OBJECTID FOR AGGREGATION QUERIES
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  // RUNNING ALL FIVE AGGREGATIONS IN PARALLEL
  const [salesAgg, quickSalesAgg, purchasesAgg, expendituresAgg, deliveryAgg] =
    await Promise.all([
      // 1. SALES FOR THE DATE — GROUPED BY SALE TYPE FOR CUSTOMER/SHOP SPLIT
      Sale.aggregate([
        { $match: { userId: userObjectId, date: dateStr } },
        {
          $group: {
            _id: "$saleType",
            totalAmount: { $sum: "$totalAmount" },
            pendingAmount: { $sum: "$pendingAmount" },
            count: { $sum: 1 },
          },
        },
      ]),
      // 2. QUICK SALES FOR THE DATE — GROUPED BY TYPE FOR MILK/YOGHURT SPLIT
      QuickSale.aggregate([
        { $match: { userId: userObjectId, date: dateStr } },
        {
          $group: {
            _id: "$type",
            totalRevenue: { $sum: "$total" },
            qty: { $sum: "$quantity" },
            count: { $sum: 1 },
          },
        },
      ]),
      // 3. PURCHASES FOR THE DATE
      Purchase.aggregate([
        { $match: { userId: userObjectId, date: dateStr } },
        {
          $group: {
            _id: null,
            totalCost: { $sum: "$totalCost" },
            totalMilk: { $sum: "$milkQuantity" },
            count: { $sum: 1 },
          },
        },
      ]),
      // 4. EXPENDITURES FOR THE DATE
      Expenditure.aggregate([
        { $match: { userId: userObjectId, date: dateStr } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      // 5. DELIVERY RECORDS FOR THE DATE — GROUPED BY STATUS FOR DELIVERED/MISSED SPLIT
      DeliveryRecord.aggregate([
        { $match: { userId: userObjectId, date: dateStr } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalMilk: { $sum: "$milkQuantity" },
          },
        },
      ]),
    ]);
  // INITIALIZING THE SALES MAP
  const salesMap = {};
  salesAgg.forEach(({ _id, totalAmount, pendingAmount, count }) => {
    // ADDING SALE TO SALES MAP
    salesMap[_id] = {
      // TOTAL AMOUNT OF SALES
      totalAmount: sf(totalAmount),
      // PENDING AMOUNT OF SALES
      pendingAmount: sf(pendingAmount),
      // COUNT OF SALES
      count,
    };
  });
  // CALCULATING CUSTOMERS SALES TOTAL
  const customerSalesTotal = salesMap["customer"]?.totalAmount ?? 0;
  // CALCULATING SHOP SALES TOTAL
  const shopSalesTotal = salesMap["shop"]?.totalAmount ?? 0;
  // CALCULATING CUSTOMERS SALES PENDING
  const customerSalesPending = salesMap["customer"]?.pendingAmount ?? 0;
  // CALCULATING TOTAL SALES PENDING
  const totalSalesRevenue = sf(customerSalesTotal + shopSalesTotal);
  // INITIALIZING THE QUICK SALES MAP
  const qsMap = {};
  // PROCESSING QUICK SALES
  quickSalesAgg.forEach(({ _id, totalRevenue, qty, count }) => {
    // ADDING QUICK SALE TO QUICK SALES MAP
    qsMap[_id] = {
      // TOTAL REVENUE OF QUICK SALES
      totalRevenue: sf(totalRevenue),
      // QUANTITY OF QUICK SALES
      qty: sf(qty, 3),
      // COUNT OF QUICK SALES
      count,
    };
  });
  // CALCULATING MILK QUICK SALES REVENUE
  const milkQsRevenue = qsMap["milk"]?.totalRevenue ?? 0;
  // CALCULATING YOGHURT QUICK SALES REVENUE
  const yoghurtQsRevenue = qsMap["yoghurt"]?.totalRevenue ?? 0;
  // CALCULATING TOTAL QUICK SALES REVENUE
  const totalQsRevenue = sf(milkQsRevenue + yoghurtQsRevenue);
  // CALCULATING THE RAW PURCHASE DATA
  const purchRaw = purchasesAgg[0] ?? {};
  // TOTAL PURCHASE COST
  const totalPurchaseCost = sf(purchRaw.totalCost ?? 0);
  // TOTAL MILK PURCHASED
  const totalMilkPurchased = sf(purchRaw.totalMilk ?? 0, 3);
  // PURCHASE COUNT
  const purchaseCount = purchRaw.count ?? 0;
  // CALCULATING THE RAW EXPENDITURE DATA
  const expRaw = expendituresAgg[0] ?? {};
  // TOTAL EXPENDITURE AMOUNT
  const totalExpAmount = sf(expRaw.totalAmount ?? 0);
  // EXPENDITURE COUNT
  const expCount = expRaw.count ?? 0;
  // INITIALIZING THE DELIVERY MAP
  const delivMap = {};
  // PROCESSING DELIVERIES
  deliveryAgg.forEach(({ _id, count, totalMilk }) => {
    delivMap[_id] = {
      // COUNT OF DELIVERIES
      count,
      totalMilk:
        // TOTAL MILK DELIVERED
        sf(totalMilk, 3),
    };
  });
  // CALCULATING DELIVERY COUNT
  const deliveredCount = delivMap["delivered"]?.count ?? 0;
  // CALCULATING MISSED DELIVERY COUNT
  const missedCount = delivMap["missed"]?.count ?? 0;
  // CALCULATING TOTAL MILK DELIVERED
  const totalMilkDelivered = delivMap["delivered"]?.totalMilk ?? 0;
  // CALCULATING DELIVERY RATE
  const totalDeliveries = deliveredCount + missedCount;
  // CALCULATING DELIVERY RATE
  const deliveryRate =
    totalDeliveries > 0 ? sf((deliveredCount / totalDeliveries) * 100, 1) : 0;
  // CALCULATING THE TOTAL REVENUE
  const totalRevenue = sf(totalSalesRevenue + totalQsRevenue);
  // CALCULATING THE TOTAL EXPENSES
  const totalExpenses = sf(totalPurchaseCost + totalExpAmount);
  // RETURNING STRUCTURED DAILY REPORT DATA
  return {
    date: dateStr,
    totalRevenue,
    totalExpenses,
    sales: {
      customerSales: customerSalesTotal,
      customerSalesPending,
      shopSales: shopSalesTotal,
      totalRevenue: totalSalesRevenue,
    },
    quickSales: {
      milkRevenue: milkQsRevenue,
      milkQty: qsMap["milk"]?.qty ?? 0,
      yoghurtRevenue: yoghurtQsRevenue,
      yoghurtQty: qsMap["yoghurt"]?.qty ?? 0,
      totalRevenue: totalQsRevenue,
    },
    purchases: {
      totalCost: totalPurchaseCost,
      totalMilk: totalMilkPurchased,
      count: purchaseCount,
    },
    expenditures: {
      totalAmount: totalExpAmount,
      count: expCount,
    },
    deliveries: {
      delivered: deliveredCount,
      missed: missedCount,
      totalMilkDelivered,
      deliveryRate,
    },
  };
};

/**
 * FETCH COMPREHENSIVE AGGREGATED DATA FOR THE MONTHLY REPORT
 * COVERS ALL MODULES — SALES, QUICK SALES, PURCHASES, EXPENDITURES,
 * DELIVERIES, STAFF, AND ALL-TIME RECOVERY
 * ALL 12 AGGREGATIONS RUN IN PARALLEL VIA PROMISE.ALL
 * @param {string | Object} userId - USER ID (STRING OR OBJECTID)
 * @param {string} monthStr - REPORT MONTH IN YYYY-MM FORMAT (LAST MONTH)
 * @returns {Promise<Object>} STRUCTURED MONTHLY REPORT DATA
 */
// <== FETCH MONTHLY REPORT DATA ==>
export const fetchMonthlyReportData = async (userId, monthStr) => {
  // CONVERTING USER ID TO OBJECTID FOR AGGREGATION QUERIES
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  // GETTING DATE RANGE FOR THE REPORT MONTH
  const { startDate, endDate } = getMonthDateRange(monthStr);
  // RUNNING ALL 12 AGGREGATIONS IN PARALLEL — NO SEQUENTIAL ROUND TRIPS
  const [
    salesBreakdownAgg,
    quickSalesAgg,
    purchasesAgg,
    expendituresAgg,
    deliveryStatusAgg,
    deliveryBillingAgg,
    monthPaymentsAgg,
    staffCountAgg,
    staffMonthAgg,
    salesOutstandingAgg,
    allTimeDelivBillingAgg,
    allTimePaymentsAgg,
  ] = await Promise.all([
    // 1. SALES BREAKDOWN BY SALETYPE AND PRODUCTTYPE
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
    // 2. QUICK SALES BY TYPE
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
    // 3. PURCHASES FOR THE MONTH
    Purchase.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalCost: { $sum: "$totalCost" },
          totalMilk: { $sum: "$milkQuantity" },
          count: { $sum: 1 },
        },
      },
    ]),
    // 4. EXPENDITURES BY CATEGORY FOR THE MONTH
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
    // 5. DELIVERY RECORDS BY STATUS FOR THE MONTH
    DeliveryRecord.aggregate([
      {
        $match: {
          userId: userObjectId,
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
    // 6. MONTHLY DELIVERY BILLING DUE — JOINS WITH CUSTOMERS FOR pricePerLiter
    DeliveryRecord.aggregate([
      {
        $match: {
          userId: userObjectId,
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
          as: "cd",
        },
      },
      { $unwind: { path: "$cd", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          monthlyBillingDue: {
            $sum: {
              $multiply: ["$totalMilk", { $ifNull: ["$cd.pricePerLiter", 0] }],
            },
          },
        },
      },
    ]),
    // 7. PAYMENTS RECEIVED FOR THIS BILLING MONTH
    Payment.aggregate([
      { $match: { userId: userObjectId, billingMonth: monthStr } },
      { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
    ]),
    // 8. ALL STAFF COUNT AND TOTAL SALARY BILL
    StaffMember.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalStaff: { $sum: 1 },
          totalSalaryBill: { $sum: "$monthlySalary" },
        },
      },
    ]),
    // 9. STAFF MONTH PAYMENT STATUS FOR THE REPORT MONTH
    StaffMonthRecord.aggregate([
      { $match: { userId: userObjectId, month: monthStr } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$paidAmount" },
          totalExtraAllocated: { $sum: "$totalExtraAllocated" },
          clearedCount: {
            $sum: { $cond: [{ $eq: ["$status", "cleared"] }, 1, 0] },
          },
        },
      },
    ]),
    // 10. ALL-TIME CUSTOMER SALES OUTSTANDING
    Sale.aggregate([
      { $match: { userId: userObjectId, saleType: "customer" } },
      {
        $group: {
          _id: null,
          outstanding: { $sum: "$pendingAmount" },
          totalDue: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$paidAmount" },
        },
      },
    ]),
    // 11. ALL-TIME DELIVERY BILLING DUE — JOINS WITH CUSTOMERS
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
      { $unwind: { path: "$cd", preserveNullAndEmptyArrays: true } },
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
    // 12. ALL-TIME DELIVERY PAYMENTS RECEIVED
    Payment.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
    ]),
  ]);

  // INITIALIZING SALES BREAKDOWN MAP
  const sbMap = {};
  // LOOP THROUGH SALES BREAKDOWN AND POPULATE MAP
  salesBreakdownAgg.forEach(({ _id, total, qty, count }) => {
    // POPULATE SALES BREAKDOWN MAP
    sbMap[`${_id.saleType}_${_id.productType}`] = {
      // TOTAL SALES
      total: sf(total),
      // QUANTITY OF SALES
      qty: sf(qty, 3),
      // COUNT OF SALES
      count,
    };
  });
  // CUSTOMER MILK SALE BREAKDOWN
  const customerMilk = sbMap["customer_milk"] || { total: 0, qty: 0, count: 0 };
  // CUSTOMER YOGHURT SALE BREAKDOWN
  const customerYoghurt = sbMap["customer_yoghurt"] || {
    total: 0,
    qty: 0,
    count: 0,
  };
  // SHOP MILK SALE BREAKDOWN
  const shopMilk = sbMap["shop_milk"] || { total: 0, qty: 0, count: 0 };
  // SHOP YOGHURT SALE BREAKDOWN
  const shopYoghurt = sbMap["shop_yoghurt"] || { total: 0, qty: 0, count: 0 };
  // TOTAL CUSTOMER SALES
  const totalCustomerSales = sf(customerMilk.total + customerYoghurt.total);
  // TOTAL SHOP SALES
  const totalShopSales = sf(shopMilk.total + shopYoghurt.total);
  // TOTAL SALES REVENUE
  const totalSalesRevenue = sf(totalCustomerSales + totalShopSales);
  // INITIALIZING QUICK SALES BREAKDOWN MAP
  const qsMap = {};
  quickSalesAgg.forEach(({ _id, total, qty, count }) => {
    // POPULATE QUICK SALES BREAKDOWN MAP
    qsMap[_id] = {
      // TOTAL SALES
      total: sf(total),
      // QUANTITY OF SALES
      qty: sf(qty, 3),
      // COUNT OF SALES
      count,
    };
  });
  // EXTRACTING THE MILK QUICK SALES
  const qsMilk = qsMap["milk"] || { total: 0, qty: 0, count: 0 };
  // EXTRACTING THE YOGHURT QUICK SALES
  const qsYoghurt = qsMap["yoghurt"] || { total: 0, qty: 0, count: 0 };
  // TOTAL QUICK SALES REVENUE
  const totalQsRevenue = sf(qsMilk.total + qsYoghurt.total);
  // INITIALIZING PURCHASES AGGREGATE
  const purchRaw = purchasesAgg[0] || {};
  // CALCULATING TOTAL PURCHASE COST
  const totalPurchaseCost = sf(purchRaw.totalCost ?? 0);
  // CALCULATING TOTAL MILK PURCHASED
  const totalMilkPurchased = sf(purchRaw.totalMilk ?? 0, 3);
  // CALCULATING AVERAGE COST PER LITER
  const avgCostPerLiter =
    (purchRaw.totalMilk ?? 0) > 0
      ? sf(purchRaw.totalCost / purchRaw.totalMilk)
      : 0;
  // INITIALIZING EXPENDITURES AGGREGATE
  const expMap = {};
  // INITIALIZING EXPENDITURES TOTAL
  let totalExpAmount = 0;
  // LOOP THROUGH EXPENDITURES AND POPULATE MAP
  expendituresAgg.forEach(({ _id, amount }) => {
    // POPULATE EXPENDITURES MAP
    expMap[_id] = sf(amount);
    // UPDATE EXPENDITURES TOTAL
    totalExpAmount += amount;
  });
  // CALCULATING TOTAL EXPENDITURES
  totalExpAmount = sf(totalExpAmount);
  // INITIALIZING DELIVERY STATUS AGGREGATE
  const delivMap = {};
  // LOOP THROUGH DELIVERY STATUS AND POPULATE MAP
  deliveryStatusAgg.forEach(({ _id, count, totalMilk }) => {
    // POPULATE DELIVERY STATUS MAP
    delivMap[_id] = {
      // COUNT OF DELIVERIES
      count,
      // TOTAL MILK
      totalMilk:
        // QUANTITY OF MILK
        sf(totalMilk, 3),
    };
  });
  // CALCULATING TOTAL DELIVERIES
  const deliveredStats = delivMap["delivered"] || { count: 0, totalMilk: 0 };
  // CALCULATING TOTAL MISSED DELIVERIES
  const missedStats = delivMap["missed"] || { count: 0, totalMilk: 0 };
  // CALCULATING MONTHLY BILLING DUE
  const monthlyBillingDue = sf(deliveryBillingAgg[0]?.monthlyBillingDue ?? 0);
  // CALCULATING MONTHLY BILLING PAID
  const monthlyBillingPaid = sf(monthPaymentsAgg[0]?.totalPaid ?? 0);
  // CALCULATING MONTHLY BILLING PENDING
  const monthlyBillingPending = sf(
    Math.max(0, monthlyBillingDue - monthlyBillingPaid),
  );
  // CALCULATING TOTAL DELIVERY DAYS
  const totalDeliveries = deliveredStats.count + missedStats.count;
  // CALCULATING DELIVERY RATE
  const deliveryRate =
    totalDeliveries > 0
      ? sf((deliveredStats.count / totalDeliveries) * 100, 1)
      : 0;
  // INITIALIZING STAFF AGGREGATE
  const staffRaw = staffCountAgg[0] || {};
  // CALCULATING MONTHLY STAFF COUNT RAW
  const staffMonthRaw = staffMonthAgg[0] || {};
  // CALCULATING STAFF COUNT
  const totalStaff = staffRaw.totalStaff ?? 0;
  // CALCULATING TOTAL SALARY BILL
  const totalSalaryBill = sf(staffRaw.totalSalaryBill ?? 0);
  // CALCULATING STAFF PAID
  const staffPaid = sf(staffMonthRaw.totalPaid ?? 0);
  // CALCULATING TOTAL EXTRA ALLOCATED
  const totalExtraAllocated = sf(staffMonthRaw.totalExtraAllocated ?? 0);
  // CALCULATING CLEARED COUNT
  const clearedCount = staffMonthRaw.clearedCount ?? 0;
  // CALCULATING TOTAL MONTHLY OUTGO
  const totalMonthlyOutgo = sf(totalSalaryBill + totalExtraAllocated);
  // CALCULATING STAFF PENDING
  const staffPending = sf(Math.max(0, totalSalaryBill - staffPaid));
  // CALCULATING TOTAL SALES OUTSTANDING
  const salesOutRaw = salesOutstandingAgg[0] || {};
  // CALCULATING SALES OUTSTANDING
  const salesOutstanding = sf(salesOutRaw.outstanding ?? 0);
  // CALCULATING ALL TIME DELIVERY OUTSTANDING
  const allTimeDelivDue = sf(allTimeDelivBillingAgg[0]?.allTimeDue ?? 0);
  // CALCULATING ALL TIME PAYMENTS PAID
  const allTimePaymentsPaid = sf(allTimePaymentsAgg[0]?.totalPaid ?? 0);
  // CALCULATING DELIVERY OUTSTANDING
  const deliveryOutstanding = sf(
    Math.max(0, allTimeDelivDue - allTimePaymentsPaid),
  );
  // CALCULATING TOTAL OUTSTANDING
  const totalOutstanding = sf(salesOutstanding + deliveryOutstanding);
  // CALCULATING TOTAL ALL TIME DUE
  const totalAllTimeDue = sf((salesOutRaw.totalDue ?? 0) + allTimeDelivDue);
  // CALCULATING TOTAL ALL TIME PAID
  const totalAllTimePaid = sf(
    (salesOutRaw.totalPaid ?? 0) + allTimePaymentsPaid,
  );
  // CALCULATING RECOVERY RATE
  const recoveryRate =
    totalAllTimeDue > 0 ? sf((totalAllTimePaid / totalAllTimeDue) * 100, 1) : 0;
  // CALCULATING MONTHLY TOTAL REVENUE
  const totalRevenue = sf(totalSalesRevenue + totalQsRevenue);
  // CALCULATING MONTHLY TOTAL EXPENSES
  const totalExpenses = sf(
    totalPurchaseCost + totalExpAmount + totalMonthlyOutgo,
  );
  // CALCULATING NET POSITION
  const netPosition = sf(totalRevenue - totalExpenses);
  // CALCULATING GROSS PROFIT
  const grossProfit = sf(totalRevenue - totalPurchaseCost);
  // RETURNING STRUCTURED MONTHLY REPORT DATA
  return {
    month: monthStr,
    financialSummary: {
      totalRevenue,
      totalExpenses,
      netPosition,
      grossProfit,
    },
    sales: {
      customerMilk,
      customerYoghurt,
      shopMilk,
      shopYoghurt,
      totalCustomerSales,
      totalShopSales,
      totalRevenue: totalSalesRevenue,
    },
    quickSales: {
      milk: qsMilk,
      yoghurt: qsYoghurt,
      totalRevenue: totalQsRevenue,
    },
    purchases: {
      totalCost: totalPurchaseCost,
      totalMilk: totalMilkPurchased,
      avgCostPerLiter,
      count: purchRaw.count ?? 0,
    },
    expenditures: {
      totalAmount: totalExpAmount,
      supplies: expMap["supplies"] ?? 0,
      meals: expMap["meals"] ?? 0,
      transport: expMap["transport"] ?? 0,
      misc: expMap["misc"] ?? 0,
    },
    deliveries: {
      deliveredDays: deliveredStats.count,
      missedDays: missedStats.count,
      totalMilkDelivered: deliveredStats.totalMilk,
      deliveryRate,
      monthlyBillingDue,
      monthlyBillingPaid,
      monthlyBillingPending,
    },
    staff: {
      totalStaff,
      totalSalaryBill,
      totalMonthlyOutgo,
      totalPaid: staffPaid,
      totalPending: staffPending,
      totalExtraAllocated,
      clearedCount,
      pendingCount: totalStaff - clearedCount,
    },
    recovery: {
      salesOutstanding,
      deliveryOutstanding,
      totalOutstanding,
      totalAllTimeDue,
      totalAllTimePaid,
      recoveryRate,
    },
  };
};
