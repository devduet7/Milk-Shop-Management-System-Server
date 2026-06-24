// <== IMPORTS ==>
import mongoose from "mongoose";
import expressAsyncHandler from "express-async-handler";
import { StaffMember } from "../models/staffMember.model.js";
import { StaffMonthRecord } from "../models/staffMonthRecord.model.js";
import { StaffExtraAllocation } from "../models/staffExtraAllocation.model.js";

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

/**
 * GET ALL STAFF MEMBERS WITH THEIR SALARY STATUS FOR THE SELECTED MONTH
 * STATS ARE ALWAYS COMPUTED ACROSS ALL STAFF REGARDLESS OF SEARCH FILTER
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET STAFF ==>
export const getStaff = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING MONTH STRING (DEFAULTS TO CURRENT MONTH)
  const monthStr = req.query.month || getCurrentMonthStr();
  // GETTING SEARCH QUERY
  const search = req.query.search?.trim() || "";
  // PARSING PAGE NUMBER
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // PARSING LIMIT
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  // CALCULATING SKIP
  const skip = (page - 1) * limit;
  // CONVERTING ACCOUNT ID TO OBJECT ID FOR AGGREGATION PIPELINE USE
  const accountObjectId = new mongoose.Types.ObjectId(accountId);
  // BUILDING SEARCH MATCH QUERY FOR STAFF MEMBERS
  const matchQuery = { accountId };
  // APPLYING NAME SEARCH IF PROVIDED
  if (search) matchQuery.name = { $regex: search, $options: "i" };
  // FETCHING COUNT, PAGINATED STAFF, OVERALL SALARY STATS, AND MONTH STATS IN PARALLEL
  const [totalCount, paginatedStaff, [overallStats], [monthStatsRaw]] =
    await Promise.all([
      // TOTAL COUNT FOR PAGINATION
      StaffMember.countDocuments(matchQuery),
      // PAGINATED STAFF MEMBERS MATCHING SEARCH
      StaffMember.find(matchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      // OVERALL STATS — ALL STAFF REGARDLESS OF SEARCH (TOTAL SALARY BILL FOR THE ACCOUNT)
      StaffMember.aggregate([
        { $match: { accountId: accountObjectId } },
        {
          $group: {
            _id: null,
            totalSalaryBill: { $sum: "$monthlySalary" },
            totalStaff: { $sum: 1 },
          },
        },
      ]),
      // MONTH STATS — SALARY PAYMENTS AND EXTRA FOR THE SELECTED MONTH
      StaffMonthRecord.aggregate([
        { $match: { accountId: accountObjectId, month: monthStr } },
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
    ]);
  // EXTRACTING PAGINATED STAFF IDS FOR MONTH RECORD FETCH
  const paginatedStaffIds = paginatedStaff.map((s) => s._id);
  // FETCHING MONTH RECORDS FOR PAGINATED STAFF ONLY
  const pageMonthRecords = await StaffMonthRecord.find({
    staffId: { $in: paginatedStaffIds },
    month: monthStr,
  })
    .lean()
    .exec();
  // BUILDING MAP OF STAFF ID TO MONTH RECORD FOR O(1) LOOKUP
  const monthRecordMap = {};
  // LOOPING THROUGH MONTH RECORDS
  pageMonthRecords.forEach((r) => {
    // MAPPING STAFF ID TO MONTH RECORD
    monthRecordMap[r.staffId.toString()] = r;
  });
  // ENRICHING EACH PAGINATED STAFF MEMBER WITH THEIR MONTH RECORD AND COMPUTED SALARY DUE
  const records = paginatedStaff.map((s) => {
    // GETTING MONTH RECORD FOR THIS STAFF MEMBER
    const mr = monthRecordMap[s._id.toString()] || null;
    // COMPUTING REMAINING SALARY DUE (CANNOT BE NEGATIVE)
    const salaryDue = parseFloat(
      Math.max(0, s.monthlySalary - (mr?.paidAmount ?? 0)).toFixed(2),
    );
    // RETURNING ENRICHED STAFF OBJECT
    return { ...s, monthRecord: mr, salaryDue };
  });
  // EXTRACTING OVERALL STATS WITH FALLBACKS
  const totalSalaryBill = parseFloat(
    (overallStats?.totalSalaryBill ?? 0).toFixed(2),
  );
  // EXTRACTING TOTAL STAFF COUNT
  const totalStaff = overallStats?.totalStaff ?? 0;
  // EXTRACTING MONTH PAYMENT STATS WITH FALLBACKS
  const totalPaid = parseFloat((monthStatsRaw?.totalPaid ?? 0).toFixed(2));
  // EXTRACTING TOTAL EXTRA ALLOCATED FOR THE MONTH
  const totalExtraAllocated = parseFloat(
    (monthStatsRaw?.totalExtraAllocated ?? 0).toFixed(2),
  );
  // EXTRACTING CLEARED COUNT FOR THE MONTH
  const clearedCount = monthStatsRaw?.clearedCount ?? 0;
  // COMPUTING TOTAL PENDING AS TOTAL BILL MINUS TOTAL PAID
  const totalPending = parseFloat(
    Math.max(0, totalSalaryBill - totalPaid).toFixed(2),
  );
  // COMPUTING TOTAL MONTHLY OUTGO — SALARY BILL PLUS ALL EXTRA ALLOCATIONS FOR THE MONTH
  const totalMonthlyOutgo = parseFloat(
    (totalSalaryBill + totalExtraAllocated).toFixed(2),
  );
  // BUILDING STATS OBJECT
  const stats = {
    totalStaff,
    totalSalaryBill,
    totalMonthlyOutgo,
    totalPaid,
    totalPending,
    totalExtraAllocated,
    clearedCount,
    pendingCount: totalStaff - clearedCount,
  };
  // CALCULATING TOTAL PAGES
  const totalPages = Math.ceil(totalCount / limit);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Staff Fetched Successfully!",
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
      appliedFilter: { month: monthStr },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * ADD A NEW STAFF MEMBER
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD STAFF ==>
export const addStaff = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING STAFF DATA FROM REQUEST BODY
  const { name, monthlySalary, note } = req.body;
  // PARSING MONTHLY SALARY AS FLOAT
  const parsedSalary = parseFloat(monthlySalary);
  // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES
  if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: "Monthly Salary must be a Valid Positive Number!",
      success: false,
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // CREATING STAFF MEMBER IN DATABASE
  const staffMember = await StaffMember.create({
    accountId,
    performedBy,
    name: name.trim(),
    monthlySalary: parsedSalary,
    note: note?.trim() || null,
  });
  // RETURNING SUCCESS RESPONSE
  res.status(201).json({
    message: `${staffMember.name} Added to Staff Successfully!`,
    success: true,
    data: { staffMember },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * UPDATE AN EXISTING STAFF MEMBER'S INFO
 * ONLY FIELDS PRESENT IN THE REQUEST BODY ARE UPDATED (PARTIAL UPDATE)
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== UPDATE STAFF ==>
export const updateStaff = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING STAFF MEMBER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING UPDATE DATA FROM REQUEST BODY
  const { name, monthlySalary, note } = req.body;
  // FINDING STAFF MEMBER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const staffMember = await StaffMember.findOne({ _id: id, accountId }).exec();
  // IF STAFF MEMBER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!staffMember) {
    // RETURNING NOT FOUND RESPONSE
    res
      .status(404)
      .json({ message: "Staff Member Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // IF NAME IS PRESENT, TRIM AND UPDATE
  if (name !== undefined) staffMember.name = name.trim();
  // IF MONTHLY SALARY IS PRESENT, VALIDATE AND UPDATE
  if (monthlySalary !== undefined) {
    // PARSING MONTHLY SALARY AS FLOAT
    const parsedSalary = parseFloat(monthlySalary);
    // GUARDING AGAINST NON-FINITE OR NON-POSITIVE VALUES (DEFENSE IN DEPTH)
    if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
      // RETURNING ERROR RESPONSE
      res.status(400).json({
        message: "Monthly Salary must be a Valid Positive Number!",
        success: false,
      });
      // RETURNING FROM FUNCTION
      return;
    }
    // APPLYING PARSED SALARY
    staffMember.monthlySalary = parsedSalary;
  }
  // IF NOTE IS PRESENT, TRIM AND UPDATE (ALLOWING NULL)
  if (note !== undefined) staffMember.note = note?.trim() || null;
  // SAVING UPDATED STAFF MEMBER
  await staffMember.save();
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: `${staffMember.name} Updated Successfully!`,
    success: true,
    data: { staffMember },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * DELETE A STAFF MEMBER AND ALL RELATED MONTH RECORDS AND EXTRA ALLOCATIONS
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== DELETE STAFF ==>
export const deleteStaff = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING STAFF MEMBER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // FINDING STAFF MEMBER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const staffMember = await StaffMember.findOne({ _id: id, accountId })
    .lean()
    .exec();
  // IF STAFF MEMBER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!staffMember) {
    // RETURNING NOT FOUND RESPONSE
    res
      .status(404)
      .json({ message: "Staff Member Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // DELETING STAFF MEMBER AND ALL RELATED RECORDS IN PARALLEL
  await Promise.all([
    // DELETE STAFF MEMBER DOCUMENT WITH ACCOUNT SCOPING FOR DEFENSE IN DEPTH
    StaffMember.deleteOne({ _id: id, accountId }),
    // CASCADE DELETE ALL MONTH RECORDS FOR THIS STAFF MEMBER
    StaffMonthRecord.deleteMany({ staffId: id }),
    // CASCADE DELETE ALL EXTRA ALLOCATIONS FOR THIS STAFF MEMBER
    StaffExtraAllocation.deleteMany({ staffId: id }),
  ]);
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: `${staffMember.name} Deleted Successfully!`,
    success: true,
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * RECORD A SALARY PAYMENT FOR A STAFF MEMBER'S BILLING MONTH
 * BLOCKS PAYMENT IF SALARY IS ALREADY CLEARED OR IF AMOUNT EXCEEDS REMAINING DUE
 * AUTOMATICALLY SETS STATUS TO CLEARED WHEN FULL SALARY IS PAID
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== PAY SALARY ==>
export const paySalary = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING STAFF MEMBER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING PAYMENT DATA FROM REQUEST BODY
  const { month, amount } = req.body;
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
  // FETCHING STAFF MEMBER AND EXISTING MONTH RECORD IN PARALLEL
  const [staffMember, existingRecord] = await Promise.all([
    StaffMember.findOne({ _id: id, accountId }).lean().exec(),
    StaffMonthRecord.findOne({ staffId: id, month }).lean().exec(),
  ]);
  // IF STAFF MEMBER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!staffMember) {
    // RETURNING NOT FOUND RESPONSE
    res
      .status(404)
      .json({ message: "Staff Member Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // GETTING MONTHLY SALARY FROM STAFF MEMBER
  const monthlySalary = staffMember.monthlySalary;
  // EXTRACTING EXISTING PAID AMOUNT WITH FALLBACK TO ZERO
  const existingPaid = existingRecord?.paidAmount ?? 0;
  // GUARD: BLOCK PAYMENT IF SALARY IS ALREADY FULLY CLEARED
  if (existingRecord?.status === "cleared") {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: `Salary for ${month} is Already Fully Paid and Cleared!`,
      success: false,
      data: {
        month,
        monthlySalary,
        paidAmount: existingPaid,
        pending: 0,
      },
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // COMPUTING REMAINING SALARY DUE
  const remaining = parseFloat((monthlySalary - existingPaid).toFixed(2));
  // GUARD: BLOCK PAYMENT IF AMOUNT EXCEEDS REMAINING DUE
  if (parsedAmount > remaining) {
    // RETURNING ERROR RESPONSE
    res.status(400).json({
      message: `Payment Amount Cannot Exceed the Remaining Salary of ₨${remaining.toLocaleString()} for ${month}!`,
      success: false,
      data: {
        month,
        monthlySalary,
        paidAmount: existingPaid,
        pending: remaining,
      },
    });
    // RETURNING FROM FUNCTION
    return;
  }
  // COMPUTING NEW PAID AMOUNT
  const newPaidAmount = parseFloat((existingPaid + parsedAmount).toFixed(2));
  // DETERMINING NEW STATUS — CLEARED IF FULL SALARY IS NOW PAID
  const newStatus = newPaidAmount >= monthlySalary ? "cleared" : "pending";
  // UPSERTING MONTH RECORD WITH NEW PAID AMOUNT AND STATUS
  const updatedRecord = await StaffMonthRecord.findOneAndUpdate(
    // FILTER: FIND EXISTING RECORD FOR THIS STAFF MEMBER AND MONTH
    { staffId: id, accountId, month },
    {
      // UPDATE: SET NEW PAID AMOUNT AND STATUS
      $set: { paidAmount: newPaidAmount, status: newStatus },
      // ON INSERT: INITIALISE EXTRA ALLOCATED TO ZERO FOR NEW RECORDS
      $setOnInsert: { totalExtraAllocated: 0 },
    },
    { upsert: true, new: true },
  );
  // RETURNING SUCCESS RESPONSE WITH CONTEXT-AWARE MESSAGE
  res.status(200).json({
    message:
      newStatus === "cleared"
        ? `Salary for ${month} Fully Paid and Cleared!`
        : `Payment of ₨${parsedAmount.toLocaleString()} Recorded for ${staffMember.name} — ${month}!`,
    success: true,
    data: {
      monthRecord: updatedRecord,
      staffMember: {
        _id: staffMember._id,
        name: staffMember.name,
        monthlySalary,
      },
    },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * ADD AN EXTRA MONEY ALLOCATION FOR A STAFF MEMBER IN A BILLING MONTH
 * CREATES AN INDIVIDUAL ALLOCATION RECORD AND INCREMENTS THE DENORMALISED TOTAL ON THE MONTH RECORD
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== ADD EXTRA ALLOCATION ==>
export const addExtraAllocation = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING THE ACTING USER'S ID FOR ATTRIBUTION
  const performedBy = req.id;
  // GETTING STAFF MEMBER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING ALLOCATION DATA FROM REQUEST BODY
  const { month, date, amount, note } = req.body;
  // FINDING STAFF MEMBER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const staffMember = await StaffMember.findOne({ _id: id, accountId })
    .lean()
    .exec();
  // IF STAFF MEMBER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!staffMember) {
    // RETURNING NOT FOUND RESPONSE
    res
      .status(404)
      .json({ message: "Staff Member Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
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
  // RESOLVING DATE — DEFAULTS TO TODAY IF NOT PROVIDED
  const resolvedDate = date?.trim() || getTodayDateStr();
  // CREATING EXTRA ALLOCATION RECORD AND UPSERTING MONTH RECORD IN PARALLEL
  const [allocation] = await Promise.all([
    // CREATE INDIVIDUAL EXTRA ALLOCATION RECORD WITH ACCOUNT AND ATTRIBUTION FIELDS
    StaffExtraAllocation.create({
      staffId: id,
      accountId,
      performedBy,
      month,
      date: resolvedDate,
      amount: parsedAmount,
      note: note?.trim() || null,
    }),
    // INCREMENT TOTAL EXTRA ALLOCATED ON THE MONTH RECORD (UPSERT IF NOT EXISTS)
    StaffMonthRecord.findOneAndUpdate(
      // FILTER: FIND EXISTING MONTH RECORD FOR THIS STAFF MEMBER AND MONTH
      { staffId: id, accountId, month },
      {
        // INCREMENT TOTAL EXTRA ALLOCATED
        $inc: { totalExtraAllocated: parsedAmount },
        // ON INSERT: INITIALISE PAID AMOUNT AND STATUS FOR NEW RECORDS
        $setOnInsert: { paidAmount: 0, status: "pending" },
      },
      { upsert: true, new: true },
    ),
  ]);
  // RETURNING SUCCESS RESPONSE
  res.status(201).json({
    message: `₨${parsedAmount.toLocaleString()} Extra Allocated to ${staffMember.name} for ${month}!`,
    success: true,
    data: { allocation },
  });
  // RETURNING FROM FUNCTION
  return;
});

/**
 * GET EXTRA ALLOCATION HISTORY FOR A STAFF MEMBER IN A BILLING MONTH
 * FETCHED LAZILY — ONLY CALLED WHEN THE USER OPENS THE EXTRA HISTORY MODAL
 * @param {import("express").Request} req - Request Object
 * @param {import("express").Response} res - Response Object
 * @returns {Promise<void>}
 */
// <== GET EXTRA ALLOCATIONS ==>
export const getExtraAllocations = expressAsyncHandler(async (req, res) => {
  // GETTING ACCOUNT ID FROM AUTHENTICATED REQUEST
  const accountId = req.accountId;
  // GETTING STAFF MEMBER ID FROM REQUEST PARAMS
  const { id } = req.params;
  // GETTING MONTH STRING (DEFAULTS TO CURRENT MONTH)
  const monthStr = req.query.month || getCurrentMonthStr();
  // FINDING STAFF MEMBER AND VERIFYING IT BELONGS TO THIS ACCOUNT
  const staffMember = await StaffMember.findOne({ _id: id, accountId })
    .select("name _id")
    .lean()
    .exec();
  // IF STAFF MEMBER NOT FOUND OR DOES NOT BELONG TO THIS ACCOUNT
  if (!staffMember) {
    // RETURNING NOT FOUND RESPONSE
    res
      .status(404)
      .json({ message: "Staff Member Not Found!", success: false });
    // RETURNING FROM FUNCTION
    return;
  }
  // FETCHING EXTRA ALLOCATIONS AND MONTH RECORD TOTAL IN PARALLEL
  const [allocations, monthRecord] = await Promise.all([
    // FETCH ALL EXTRA ALLOCATIONS FOR THIS STAFF MEMBER AND MONTH
    StaffExtraAllocation.find({ staffId: id, month: monthStr })
      .sort({ date: -1, createdAt: -1 })
      .lean()
      .exec(),
    // FETCH MONTH RECORD TOTAL EXTRA ALLOCATED (DENORMALISED)
    StaffMonthRecord.findOne(
      { staffId: id, month: monthStr },
      { totalExtraAllocated: 1 },
    )
      .lean()
      .exec(),
  ]);
  // EXTRACTING TOTAL EXTRA ALLOCATED WITH FALLBACK TO ZERO
  const totalExtraAllocated = parseFloat(
    (monthRecord?.totalExtraAllocated ?? 0).toFixed(2),
  );
  // RETURNING SUCCESS RESPONSE
  res.status(200).json({
    message: "Extra Allocations Fetched Successfully!",
    success: true,
    data: {
      allocations,
      totalExtraAllocated,
      staffMember,
      month: monthStr,
    },
  });
  // RETURNING FROM FUNCTION
  return;
});
