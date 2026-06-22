// <== IMPORTS ==>
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
  // CALCULATING LAST DAY OF MONTH (DAY 0 OF NEXT MONTH = LAST DAY OF CURRENT MONTH)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // BUILDING END DATE (LAST DAY OF MONTH)
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  // RETURNING DATE RANGE
  return { startDate, endDate };
};

// <== HELPER: COMPUTE MONTHLY STATS FROM PRE-FETCHED RECORDS ==>
const computeMonthlyStats = (
  monthStr,
  deliveryRecords,
  payments,
  pricePerLiter,
) => {
  // FILTERING DELIVERED RECORDS ONLY
  const deliveredRecords = deliveryRecords.filter(
    (d) => d.status === "delivered",
  );
  // FILTERING MISSED RECORDS ONLY
  const missedRecords = deliveryRecords.filter((d) => d.status === "missed");
  // CALCULATING TOTAL MILK DELIVERED THIS MONTH
  const totalMilkDelivered = deliveredRecords.reduce(
    (sum, d) => sum + d.milkQuantity,
    0,
  );
  // CALCULATING MONTHLY TOTAL DUE
  const monthlyTotal = parseFloat(
    (totalMilkDelivered * pricePerLiter).toFixed(2),
  );
  // CALCULATING TOTAL PAID FOR THIS BILLING MONTH
  const totalPaid = parseFloat(
    payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
  );
  // CALCULATING PENDING AMOUNT (CANNOT BE NEGATIVE)
  const pending = parseFloat(Math.max(0, monthlyTotal - totalPaid).toFixed(2));
  // RETURNING COMPUTED STATS OBJECT
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

/**
 * GET ALL CUSTOMERS WITH MONTHLY STATS AND ALL-TIME OUTSTANDING
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET ALL CUSTOMERS ==>
export const getCustomers = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING MONTH FROM QUERY OR DEFAULTING TO CURRENT MONTH
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING SEARCH QUERY FROM REQUEST
  const search = req.query.search?.trim() || "";
  // PARSING PAGE NUMBER (DEFAULT 1, MINIMUM 1)
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  // PARSING LIMIT PER PAGE (DEFAULT 10, CLAMPED BETWEEN 1 AND 100)
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
  // BUILDING BASE CUSTOMER QUERY FOR THIS ACCOUNT
  const customerQuery = { accountId };
  // APPLYING SEARCH FILTER IF PROVIDED
  if (search) {
    // FILTERING BY NAME OR PHONE USING CASE-INSENSITIVE REGEX
    customerQuery.$or = [
      // NAME FIELD REGEX
      { name: { $regex: search, $options: "i" } },
      // PHONE FIELD REGEX
      { phone: { $regex: search, $options: "i" } },
    ];
  }
  // FETCHING ALL MATCHING CUSTOMERS — REQUIRED IN FULL FOR ACCURATE CROSS-CUSTOMER SUMMARY STATS
  const customers = await Customer.find(customerQuery)
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  // COMPUTING TOTAL MATCHING CUSTOMERS FOR PAGINATION METADATA
  const total = customers.length;
  // COMPUTING TOTAL PAGES
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  // IF NO CUSTOMERS FOUND, RETURNING EMPTY RESPONSE WITH ZERO SUMMARY AND PAGINATION
  if (total === 0) {
    // RETURNING SUCCESS RESPONSE WITH EMPTY DATA
    res.status(200).json({
      message: "Customers Fetched Successfully!",
      success: true,
      data: {
        customers: [],
        summary: {
          month: monthStr,
          totalCustomers: 0,
          monthlyDue: 0,
          monthlyReceived: 0,
          monthlyPending: 0,
          totalOutstanding: 0,
        },
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GETTING MONTH DATE RANGE FOR BATCH QUERIES
  const { startDate, endDate } = getMonthDateRange(monthStr);
  // EXTRACTING ALL CUSTOMER IDS FOR BATCH DATABASE QUERIES
  const customerIds = customers.map((c) => c._id);
  // BATCH FETCHING ALL FOUR DATA SETS IN PARALLEL TO MINIMIZE RESPONSE TIME
  const [
    allDeliveryRecords,
    allPayments,
    allTimeDeliveredRecords,
    allTimePaymentsAll,
  ] = await Promise.all([
    // CURRENT MONTH DELIVERY RECORDS FOR ALL CUSTOMERS
    DeliveryRecord.find({
      customerId: { $in: customerIds },
      date: { $gte: startDate, $lte: endDate },
    })
      .lean()
      .exec(),
    // CURRENT MONTH PAYMENTS FOR ALL CUSTOMERS
    Payment.find({
      customerId: { $in: customerIds },
      billingMonth: monthStr,
    })
      .lean()
      .exec(),
    // ALL-TIME DELIVERED RECORDS FOR OUTSTANDING BALANCE CALCULATION
    DeliveryRecord.find({
      customerId: { $in: customerIds },
      status: "delivered",
    })
      .lean()
      .exec(),
    // ALL-TIME PAYMENTS FOR OUTSTANDING BALANCE CALCULATION
    Payment.find({
      customerId: { $in: customerIds },
    })
      .lean()
      .exec(),
  ]);
  // GROUPING DELIVERY RECORDS BY CUSTOMER ID FOR O(1) LOOKUP
  const deliveryByCustomer = {};
  // LOOPING THROUGH ALL DELIVERY RECORDS
  allDeliveryRecords.forEach((record) => {
    // GETTING STRING KEY FOR CUSTOMER ID
    const key = record.customerId.toString();
    // INITIALIZING ARRAY IF NOT EXISTS
    if (!deliveryByCustomer[key]) deliveryByCustomer[key] = [];
    // PUSHING RECORD TO CUSTOMER'S ARRAY
    deliveryByCustomer[key].push(record);
  });
  // GROUPING PAYMENTS BY CUSTOMER ID FOR O(1) LOOKUP
  const paymentsByCustomer = {};
  // LOOPING THROUGH ALL PAYMENTS
  allPayments.forEach((payment) => {
    // GETTING STRING KEY FOR CUSTOMER ID
    const key = payment.customerId.toString();
    // INITIALIZING ARRAY IF NOT EXISTS
    if (!paymentsByCustomer[key]) paymentsByCustomer[key] = [];
    // PUSHING PAYMENT TO CUSTOMER'S ARRAY
    paymentsByCustomer[key].push(payment);
  });
  // GROUPING ALL-TIME DELIVERED RECORDS BY CUSTOMER ID FOR O(1) LOOKUP
  const allTimeDeliveryByCustomer = {};
  // LOOPING THROUGH ALL-TIME DELIVERY RECORDS
  allTimeDeliveredRecords.forEach((record) => {
    // GETTING STRING KEY FOR CUSTOMER ID
    const key = record.customerId.toString();
    // INITIALIZING ARRAY IF NOT EXISTS
    if (!allTimeDeliveryByCustomer[key]) allTimeDeliveryByCustomer[key] = [];
    // PUSHING RECORD TO CUSTOMER'S ARRAY
    allTimeDeliveryByCustomer[key].push(record);
  });
  // GROUPING ALL-TIME PAYMENTS BY CUSTOMER ID FOR O(1) LOOKUP
  const allTimePaymentsByCustomer = {};
  // LOOPING THROUGH ALL-TIME PAYMENTS
  allTimePaymentsAll.forEach((payment) => {
    // GETTING STRING KEY FOR CUSTOMER ID
    const key = payment.customerId.toString();
    // INITIALIZING ARRAY IF NOT EXISTS
    if (!allTimePaymentsByCustomer[key]) allTimePaymentsByCustomer[key] = [];
    // PUSHING PAYMENT TO CUSTOMER'S ARRAY
    allTimePaymentsByCustomer[key].push(payment);
  });
  // INITIALIZING MONTHLY DUE ACCUMULATOR
  let monthlyDue = 0;
  // INITIALIZING MONTHLY RECEIVED ACCUMULATOR
  let monthlyReceived = 0;
  // INITIALIZING TOTAL OUTSTANDING ACCUMULATOR ACROSS ALL CUSTOMERS
  let totalOutstanding = 0;
  // BUILDING FULL STATS ARRAY ACROSS ALL MATCHING CUSTOMERS (REQUIRED FOR ACCURATE SUMMARY)
  const customersWithStats = customers.map((customer) => {
    // GETTING STRING KEY FOR THIS CUSTOMER
    const custId = customer._id.toString();
    // GETTING THIS CUSTOMER'S DELIVERY RECORDS FOR SELECTED MONTH (EMPTY ARRAY IF NONE)
    const deliveries = deliveryByCustomer[custId] || [];
    // GETTING THIS CUSTOMER'S PAYMENTS FOR SELECTED MONTH (EMPTY ARRAY IF NONE)
    const payments = paymentsByCustomer[custId] || [];
    // COMPUTING MONTHLY STATS FOR THIS CUSTOMER
    const monthlyStats = computeMonthlyStats(
      monthStr,
      deliveries,
      payments,
      customer.pricePerLiter,
    );
    // ACCUMULATING MONTHLY DUE
    monthlyDue += monthlyStats.monthlyTotal;
    // ACCUMULATING MONTHLY RECEIVED
    monthlyReceived += monthlyStats.totalPaid;
    // GETTING THIS CUSTOMER'S ALL-TIME DELIVERED RECORDS
    const allTimeDeliveries = allTimeDeliveryByCustomer[custId] || [];
    // GETTING THIS CUSTOMER'S ALL-TIME PAYMENTS
    const allTimePaymentsForCustomer = allTimePaymentsByCustomer[custId] || [];
    // CALCULATING ALL-TIME TOTAL MILK DELIVERED FOR THIS CUSTOMER
    const allTimeMilkDelivered = allTimeDeliveries.reduce(
      (sum, d) => sum + d.milkQuantity,
      0,
    );
    // CALCULATING ALL-TIME TOTAL AMOUNT DUE FOR THIS CUSTOMER
    const allTimeTotalDue = parseFloat(
      (allTimeMilkDelivered * customer.pricePerLiter).toFixed(2),
    );
    // CALCULATING ALL-TIME TOTAL PAID FOR THIS CUSTOMER
    const allTimeTotalPaid = parseFloat(
      allTimePaymentsForCustomer
        .reduce((sum, p) => sum + p.amount, 0)
        .toFixed(2),
    );
    // CALCULATING ALL-TIME OUTSTANDING BALANCE FOR THIS CUSTOMER (CANNOT BE NEGATIVE)
    const allTimeOutstanding = parseFloat(
      Math.max(0, allTimeTotalDue - allTimeTotalPaid).toFixed(2),
    );
    // ACCUMULATING TOTAL OUTSTANDING ACROSS ALL CUSTOMERS
    totalOutstanding += allTimeOutstanding;
    // RETURNING CUSTOMER WITH MONTHLY STATS AND ALL-TIME OUTSTANDING
    return {
      _id: customer._id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      dailyMilk: customer.dailyMilk,
      pricePerLiter: customer.pricePerLiter,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      monthlyStats,
      allTimeOutstanding,
    };
  });
  // CALCULATING OVERALL MONTHLY PENDING
  const monthlyPending = parseFloat(
    Math.max(0, monthlyDue - monthlyReceived).toFixed(2),
  );
  // COMPUTING SKIP OFFSET FOR CURRENT PAGE
  const skip = (page - 1) * limit;
  // SLICING FULL STATS ARRAY TO RETURN ONLY THE REQUESTED PAGE OF CUSTOMERS
  const paginatedCustomers = customersWithStats.slice(skip, skip + limit);
  // RETURNING SUCCESS RESPONSE WITH PAGINATED CUSTOMERS, FULL SUMMARY, AND PAGINATION METADATA
  res.status(200).json({
    message: "Customers Fetched Successfully!",
    success: true,
    data: {
      customers: paginatedCustomers,
      summary: {
        month: monthStr,
        totalCustomers: total,
        monthlyDue: parseFloat(monthlyDue.toFixed(2)),
        monthlyReceived: parseFloat(monthlyReceived.toFixed(2)),
        monthlyPending,
        totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * GET SINGLE CUSTOMER DETAIL WITH DELIVERY RECORDS AND FULL MONTHLY BREAKDOWN
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET CUSTOMER DETAIL ==>
export const getCustomerDetail = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING CUSTOMER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING MONTH FROM QUERY OR DEFAULTING TO CURRENT MONTH
  const monthStr = req.query.month || getCurrentMonthStr();
  // FINDING CUSTOMER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const customer = await Customer.findOne({ _id: id, accountId }).lean().exec();
  // IF CUSTOMER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!customer) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Customer Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // GETTING MONTH DATE RANGE FOR SELECTED MONTH
  const { startDate, endDate } = getMonthDateRange(monthStr);
  // FETCHING ALL FOUR QUERY SETS IN PARALLEL TO MINIMIZE RESPONSE TIME
  const [deliveryRecords, payments, allTimeDeliveries, allTimePayments] =
    await Promise.all([
      // DELIVERY RECORDS FOR SELECTED MONTH ONLY (FOR CALENDAR DISPLAY)
      DeliveryRecord.find({
        customerId: id,
        date: { $gte: startDate, $lte: endDate },
      })
        .sort({ date: 1 })
        .lean()
        .exec(),
      // PAYMENTS FOR SELECTED BILLING MONTH ONLY
      Payment.find({
        customerId: id,
        billingMonth: monthStr,
      })
        .sort({ paymentDate: -1 })
        .lean()
        .exec(),
      // ALL DELIVERY RECORDS ACROSS ALL TIME FOR MONTHLY BREAKDOWN
      DeliveryRecord.find({ customerId: id }).sort({ date: 1 }).lean().exec(),
      // ALL PAYMENTS ACROSS ALL TIME FOR MONTHLY BREAKDOWN
      Payment.find({ customerId: id }).lean().exec(),
    ]);
  // COMPUTING MONTHLY STATS FOR SELECTED MONTH
  const monthlyStats = computeMonthlyStats(
    monthStr,
    deliveryRecords,
    payments,
    customer.pricePerLiter,
  );
  // GROUPING ALL-TIME DELIVERY RECORDS BY MONTH STRING
  const deliveriesByMonth = {};
  // LOOPING THROUGH ALL DELIVERY RECORDS TO GROUP BY MONTH
  allTimeDeliveries.forEach((record) => {
    // EXTRACTING MONTH STRING FROM DATE FIELD (YYYY-MM)
    const month = record.date.substring(0, 7);
    // INITIALIZING ARRAY IF NOT EXISTS
    if (!deliveriesByMonth[month]) deliveriesByMonth[month] = [];
    // PUSHING RECORD TO MONTH'S ARRAY
    deliveriesByMonth[month].push(record);
  });
  // GROUPING ALL-TIME PAYMENTS BY BILLING MONTH
  const paymentsByBillingMonth = {};
  // LOOPING THROUGH ALL PAYMENTS TO GROUP BY BILLING MONTH
  allTimePayments.forEach((payment) => {
    // GETTING BILLING MONTH KEY
    const month = payment.billingMonth;
    // INITIALIZING ARRAY IF NOT EXISTS
    if (!paymentsByBillingMonth[month]) paymentsByBillingMonth[month] = [];
    // PUSHING PAYMENT TO MONTH'S ARRAY
    paymentsByBillingMonth[month].push(payment);
  });
  // BUILDING COMPLETE SET OF ALL MONTHS WITH ANY DELIVERY OR PAYMENT ACTIVITY
  const activeMonthsSet = new Set([
    ...Object.keys(deliveriesByMonth),
    ...Object.keys(paymentsByBillingMonth),
  ]);
  // SORTING ALL ACTIVE MONTHS IN ASCENDING CHRONOLOGICAL ORDER
  const sortedActiveMonths = Array.from(activeMonthsSet).sort();
  // BUILDING MONTHLY BREAKDOWN WITH FULL STATS AND PAYMENT STATUS FOR EACH ACTIVE MONTH
  const monthlyBreakdown = sortedActiveMonths.map((month) => {
    // GETTING DELIVERY RECORDS FOR THIS MONTH
    const monthDeliveries = deliveriesByMonth[month] || [];
    // GETTING PAYMENTS FOR THIS MONTH
    const monthPayments = paymentsByBillingMonth[month] || [];
    // COMPUTING MONTHLY STATS FOR THIS MONTH
    const stats = computeMonthlyStats(
      month,
      monthDeliveries,
      monthPayments,
      customer.pricePerLiter,
    );
    // DETERMINING PAYMENT STATUS FOR THIS MONTH
    let paymentStatus;
    // IF PENDING IS ZERO THE BILL IS FULLY CLEARED FOR THIS MONTH
    if (stats.pending === 0) {
      // SETTING STATUS TO CLEARED
      paymentStatus = "cleared";
    } else if (stats.totalPaid > 0) {
      // PARTIAL PAYMENT HAS BEEN MADE TOWARDS THIS MONTH
      paymentStatus = "partial";
    } else {
      // NO PAYMENT HAS BEEN MADE FOR THIS MONTH YET
      paymentStatus = "unpaid";
    }
    // RETURNING FULL BREAKDOWN ENTRY FOR THIS MONTH WITH PAYMENT STATUS
    return { ...stats, paymentStatus };
  });
  // COMPUTING ALL-TIME OUTSTANDING BALANCE BY SUMMING PENDING ACROSS ALL MONTHS
  const allTimeOutstanding = parseFloat(
    monthlyBreakdown.reduce((sum, m) => sum + m.pending, 0).toFixed(2),
  );
  // RETURNING SUCCESS RESPONSE WITH FULL CUSTOMER DETAIL AND MONTHLY BREAKDOWN
  res.status(200).json({
    message: "Customer Details Fetched Successfully!",
    success: true,
    data: {
      customer: {
        _id: customer._id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        dailyMilk: customer.dailyMilk,
        pricePerLiter: customer.pricePerLiter,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      deliveryRecords,
      payments,
      monthlyStats,
      monthlyBreakdown,
      allTimeOutstanding,
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * ADD A NEW CUSTOMER
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD CUSTOMER ==>
export const addCustomer = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING CUSTOMER DATA FROM REQUEST BODY
  const { name, phone, address, dailyMilk, pricePerLiter } = req.body;
  // CHECKING FOR DUPLICATE CUSTOMER NAME WITHIN THIS ACCOUNT (CASE-INSENSITIVE)
  const existingCustomer = await Customer.findOne({
    accountId,
    name: { $regex: `^${name.trim()}$`, $options: "i" },
  })
    .lean()
    .exec();
  // IF DUPLICATE NAME FOUND, RETURNING CONFLICT ERROR
  if (existingCustomer) {
    // RETURNING ERROR RESPONSE
    res.status(409).json({
      message: "A Customer with this Name Already Exists!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CREATING NEW CUSTOMER IN DATABASE
  const customer = await Customer.create({
    accountId,
    performedBy,
    name: name.trim(),
    phone: phone?.trim() || null,
    address: address?.trim() || null,
    dailyMilk: parseFloat(dailyMilk),
    pricePerLiter: parseFloat(pricePerLiter),
  });
  // RETURNING SUCCESS RESPONSE WITH NEW CUSTOMER DATA
  res.status(201).json({
    message: "Customer Added Successfully!",
    success: true,
    data: { customer },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE AN EXISTING CUSTOMER
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE CUSTOMER ==>
export const updateCustomer = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING CUSTOMER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING UPDATE DATA FROM REQUEST BODY
  const { name, phone, address, dailyMilk, pricePerLiter } = req.body;
  // FINDING CUSTOMER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const customer = await Customer.findOne({ _id: id, accountId }).exec();
  // IF CUSTOMER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!customer) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Customer Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CHECKING FOR DUPLICATE NAME IF NAME IS BEING UPDATED
  if (name !== undefined) {
    // LOOKING FOR ANOTHER CUSTOMER IN THIS ACCOUNT WITH THE SAME NAME (EXCLUDING CURRENT)
    const duplicateName = await Customer.findOne({
      accountId,
      _id: { $ne: id },
      name: { $regex: `^${name.trim()}$`, $options: "i" },
    })
      .lean()
      .exec();
    // IF DUPLICATE FOUND, RETURNING CONFLICT ERROR
    if (duplicateName) {
      // RETURNING ERROR RESPONSE
      res.status(409).json({
        message: "A Customer with this Name Already Exists!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // UPDATING NAME FIELD
    customer.name = name.trim();
  }
  // UPDATING PHONE IF PROVIDED (ALLOW SETTING TO NULL)
  if (phone !== undefined) customer.phone = phone?.trim() || null;
  // UPDATING ADDRESS IF PROVIDED (ALLOW SETTING TO NULL)
  if (address !== undefined) customer.address = address?.trim() || null;
  // UPDATING DAILY MILK IF PROVIDED
  if (dailyMilk !== undefined) customer.dailyMilk = parseFloat(dailyMilk);
  // UPDATING PRICE PER LITER IF PROVIDED
  if (pricePerLiter !== undefined)
    customer.pricePerLiter = parseFloat(pricePerLiter);
  // SAVING UPDATED CUSTOMER TO DATABASE
  await customer.save();
  // RETURNING SUCCESS RESPONSE WITH UPDATED CUSTOMER
  res.status(200).json({
    message: "Customer Updated Successfully!",
    success: true,
    data: { customer },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE A CUSTOMER (BLOCKED IF OUTSTANDING BALANCE EXISTS)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE CUSTOMER ==>
export const deleteCustomer = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING CUSTOMER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING CUSTOMER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const customer = await Customer.findOne({ _id: id, accountId }).lean().exec();
  // IF CUSTOMER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!customer) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Customer Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // FETCHING DELIVERED RECORDS AND ALL-TIME PAYMENTS IN PARALLEL FOR OUTSTANDING BALANCE CHECK
  const [allDeliveredRecords, allPayments] = await Promise.all([
    DeliveryRecord.find({ customerId: id, status: "delivered" }).lean().exec(),
    Payment.find({ customerId: id }).lean().exec(),
  ]);
  // CALCULATING ALL-TIME TOTAL MILK DELIVERED FOR THIS CUSTOMER
  const totalMilkDeliveredAllTime = allDeliveredRecords.reduce(
    (sum, d) => sum + d.milkQuantity,
    0,
  );
  // CALCULATING ALL-TIME TOTAL AMOUNT DUE FOR THIS CUSTOMER
  const totalAmountDueAllTime = parseFloat(
    (totalMilkDeliveredAllTime * customer.pricePerLiter).toFixed(2),
  );
  // CALCULATING ALL-TIME TOTAL AMOUNT PAID
  const totalPaidAllTime = parseFloat(
    allPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
  );
  // CALCULATING OUTSTANDING BALANCE
  const outstandingBalance = parseFloat(
    Math.max(0, totalAmountDueAllTime - totalPaidAllTime).toFixed(2),
  );
  // BLOCKING DELETION IF OUTSTANDING BALANCE EXISTS
  if (outstandingBalance > 0) {
    // RETURNING ERROR RESPONSE WITH OUTSTANDING AMOUNT
    res.status(400).json({
      message: `Cannot Delete Customer with an Outstanding Balance of ₨${outstandingBalance.toLocaleString()}! Please Clear the Balance First.`,
      success: false,
      data: { outstandingBalance },
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETING CUSTOMER AND ALL RELATED RECORDS IN PARALLEL TO MINIMIZE RESPONSE TIME
  await Promise.all([
    Customer.deleteOne({ _id: id, accountId }),
    DeliveryRecord.deleteMany({ customerId: id }),
    Payment.deleteMany({ customerId: id }),
  ]);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Customer Deleted Successfully!",
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * MARK OR UPDATE A DELIVERY DAY FOR A CUSTOMER
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== MARK DELIVERY ==>
export const markDelivery = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING CUSTOMER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING DATE AND STATUS FROM REQUEST BODY
  const { date, status } = req.body;
  // FINDING CUSTOMER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const customer = await Customer.findOne({ _id: id, accountId }).lean().exec();
  // IF CUSTOMER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!customer) {
    // RETURNING NOT FOUND RESPONSE
    res.status(404).json({
      message: "Customer Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // PREVENTING MARKING OF FUTURE DATES
  const todayStr = getTodayDateStr();
  // IF DATE IS IN THE FUTURE, RETURN ERROR
  if (date > todayStr) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Cannot Mark Delivery for a Future Date!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // DETERMINING MILK QUANTITY BASED ON STATUS
  const milkQuantity = status === "delivered" ? customer.dailyMilk : 0;
  // UPSERTING DELIVERY RECORD (UPDATE IF EXISTS, INSERT IF NOT)
  const deliveryRecord = await DeliveryRecord.findOneAndUpdate(
    // FILTER: FIND EXISTING RECORD FOR THIS CUSTOMER AND DATE
    { customerId: id, date },
    // UPDATE: SET NEW VALUES INCLUDING ATTRIBUTION FIELDS
    {
      $set: {
        accountId,
        performedBy,
        milkQuantity,
        status,
      },
    },
    // OPTIONS: UPSERT CREATES IF NOT FOUND, NEW RETURNS UPDATED DOCUMENT
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
    .lean()
    .exec();
  // EXTRACTING BILLING MONTH FROM DATE (YYYY-MM)
  const billingMonth = date.substring(0, 7);
  // GETTING MONTH DATE RANGE FOR RECALCULATED STATS
  const { startDate, endDate } = getMonthDateRange(billingMonth);
  // FETCHING UPDATED DELIVERY RECORDS AND PAYMENTS FOR THIS MONTH IN PARALLEL TO MINIMIZE RESPONSE TIME
  const [monthDeliveries, monthPayments] = await Promise.all([
    DeliveryRecord.find({
      customerId: id,
      date: { $gte: startDate, $lte: endDate },
    })
      .lean()
      .exec(),
    Payment.find({ customerId: id, billingMonth }).lean().exec(),
  ]);
  // COMPUTING UPDATED MONTHLY STATS
  const monthlyStats = computeMonthlyStats(
    billingMonth,
    monthDeliveries,
    monthPayments,
    customer.pricePerLiter,
  );
  // BUILDING STATUS-SPECIFIC SUCCESS MESSAGE
  const statusMessages = {
    delivered: "Delivery Marked as Delivered Successfully!",
    missed: "Delivery Marked as Missed Successfully!",
    unmarked: "Delivery Record Cleared Successfully!",
  };
  // RETURNING SUCCESS RESPONSE WITH UPDATED RECORD AND STATS
  res.status(200).json({
    message: statusMessages[status],
    success: true,
    data: {
      deliveryRecord,
      monthlyStats,
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * ADD A PAYMENT FOR A CUSTOMER'S BILLING MONTH
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD PAYMENT ==>
export const addPayment = expressAsyncHandler(async (req, res) => {
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
    res.status(404).json({
      message: "Customer Not Found!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // PARSING PAYMENT AMOUNT AS FLOAT
  const parsedAmount = parseFloat(amount);
  // DETERMINING PAYMENT DATE (DEFAULT TO TODAY)
  const resolvedPaymentDate = paymentDate?.trim() || getTodayDateStr();
  // GETTING MONTH DATE RANGE FOR DELIVERY RECORD QUERIES
  const { startDate, endDate } = getMonthDateRange(billingMonth);
  // FETCHING DELIVERED RECORDS AND EXISTING PAYMENTS IN PARALLEL TO MINIMIZE RESPONSE TIME
  const [monthDeliveries, existingPayments] = await Promise.all([
    // DELIVERED RECORDS FOR THIS BILLING MONTH ONLY
    DeliveryRecord.find({
      customerId: id,
      date: { $gte: startDate, $lte: endDate },
      status: "delivered",
    })
      .lean()
      .exec(),
    // EXISTING PAYMENTS FOR THIS BILLING MONTH
    Payment.find({ customerId: id, billingMonth }).lean().exec(),
  ]);
  // CALCULATING MONTHLY TOTAL MILK DELIVERED FOR THIS BILLING MONTH
  const totalMilkDelivered = monthDeliveries.reduce(
    (sum, d) => sum + d.milkQuantity,
    0,
  );
  // CALCULATING MONTHLY TOTAL DUE
  const monthlyTotal = parseFloat(
    (totalMilkDelivered * customer.pricePerLiter).toFixed(2),
  );
  // CALCULATING ALREADY PAID AMOUNT FOR THIS BILLING MONTH
  const alreadyPaid = parseFloat(
    existingPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
  );
  // CALCULATING CURRENT PENDING AMOUNT FOR THIS BILLING MONTH
  const pendingAmount = parseFloat(
    Math.max(0, monthlyTotal - alreadyPaid).toFixed(2),
  );
  // BLOCKING PAYMENT IF NO OUTSTANDING BALANCE EXISTS
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
  // BLOCKING PAYMENT IF AMOUNT EXCEEDS PENDING BALANCE
  if (parsedAmount > pendingAmount) {
    // RETURNING ERROR RESPONSE WITH PENDING AMOUNT
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
  // RETURNING SUCCESS RESPONSE WITH PAYMENT AND UPDATED STATS
  res.status(201).json({
    message: `Payment of ₨${parsedAmount.toLocaleString()} Added Successfully!`,
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
