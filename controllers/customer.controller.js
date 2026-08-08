// <== IMPORTS ==>
import {
  computeMonthlyStats,
  buildMonthlyBreakdown,
  allocatePaymentAcrossMonths,
} from "../services/paymentAllocationService.js";
import { Payment } from "../models/payment.model.js";
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
  // CALCULATING LAST DAY OF MONTH (DAY 0 OF NEXT MONTH = LAST DAY OF CURRENT MONTH)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // BUILDING END DATE (LAST DAY OF MONTH)
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  // RETURNING DATE RANGE
  return { startDate, endDate };
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
  const [deliveryRecords, payments] = await Promise.all([
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
  ]);
  // COMPUTING MONTHLY STATS FOR SELECTED MONTH
  const monthlyStats = computeMonthlyStats(
    monthStr,
    deliveryRecords,
    payments,
    customer.pricePerLiter,
  );
  // BUILDING THE FULL MONTHLY BREAKDOWN FOR THIS CUSTOMER ACROSS ALL ACTIVE MONTHS
  const monthlyBreakdown = await buildMonthlyBreakdown(
    id,
    customer.pricePerLiter,
  );
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
 * RESPECTS THE ACCOUNT'S DELETION MODE PREFERENCE — MOVED TO TRASH OR HARD-DELETED
 * WHEN TRASHED, ALL DELIVERY RECORDS AND PAYMENTS ARE CASCADE-EMBEDDED IN THE SAME TRASH ENTRY
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE CUSTOMER ==>
export const deleteCustomer = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING CUSTOMER ID FROM REQUEST PARAMS
  const { id } = req.params;
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
  // FETCHING ALL DELIVERY RECORDS (NOT JUST DELIVERED) AND ALL PAYMENTS IN PARALLEL
  const [allDeliveryRecords, allPayments] = await Promise.all([
    DeliveryRecord.find({ customerId: id }).lean().exec(),
    Payment.find({ customerId: id }).lean().exec(),
  ]);
  // FILTERING DELIVERED RECORDS ONLY FOR THE OUTSTANDING BALANCE CALCULATION
  const deliveredRecords = allDeliveryRecords.filter(
    (d) => d.status === "delivered",
  );
  // CALCULATING ALL-TIME TOTAL MILK DELIVERED FOR THIS CUSTOMER
  const totalMilkDeliveredAllTime = deliveredRecords.reduce(
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
  // REMOVING CUSTOMER (RESPECTS ACCOUNT DELETION MODE PREFERENCE)
  const { trashed } = await removeDocument({
    accountId,
    entityType: TRASH_ENTITY_TYPES.CUSTOMER,
    document: customer,
    performedBy,
    relatedDocuments: {
      [DeliveryRecord.modelName]: allDeliveryRecords,
      [Payment.modelName]: allPayments,
    },
  });
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: trashed
      ? "Customer Moved to Trash!"
      : "Customer Deleted Successfully!",
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
  // GETTING DATE, STATUS, AND OPTIONAL MILK QUANTITY OVERRIDE FROM REQUEST BODY
  const { date, status, milkQuantity: requestedMilkQuantity } = req.body;
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
  // PARSING THE OPTIONAL MILK QUANTITY OVERRIDE AS A FLOAT
  const parsedMilkQuantity = parseFloat(requestedMilkQuantity);
  // DETERMINING MILK QUANTITY BASED ON STATUS
  const milkQuantity =
    status === "delivered"
      ? Number.isFinite(parsedMilkQuantity) && parsedMilkQuantity > 0
        ? parsedMilkQuantity
        : customer.dailyMilk
      : 0;
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

/**
 * ADD A LUMP-SUM PAYMENT AUTO-ALLOCATED ACROSS A CUSTOMER'S OUTSTANDING BILLING MONTHS
 * OLDEST MONTH FIRST — EACH MONTH TOUCHED GETS ITS OWN PAYMENT DOCUMENT SO IT STAYS CORRECTLY
 * LINKED TO THE BILL IT SETTLES, REGARDLESS OF WHEN THE LUMP PAYMENT WAS ACTUALLY MADE
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD BULK PAYMENT ==>
export const addBulkPayment = expressAsyncHandler(async (req, res) => {
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
    res.status(404).json({
      message: "Customer Not Found!",
      success: false,
    });
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
