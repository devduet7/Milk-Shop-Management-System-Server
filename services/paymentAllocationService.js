// <== IMPORTS ==>
import { Payment } from "../models/payment.model.js";
import { DeliveryRecord } from "../models/deliveryRecord.model.js";

/**
 * COMPUTE MONTHLY STATS FROM PRE-FETCHED RECORDS
 * @param {string} monthStr - YYYY-MM
 * @param {Array} deliveryRecords - DELIVERY RECORDS FOR THIS MONTH
 * @param {Array} payments - PAYMENTS FOR THIS BILLING MONTH
 * @param {number} pricePerLiter - CUSTOMER'S CURRENT PRICE PER LITER
 * @returns {object} MONTHLY STATS OBJECT
 */
// <== HELPER: COMPUTE MONTHLY STATS FROM PRE-FETCHED RECORDS ==>
export const computeMonthlyStats = (
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
 * BUILD FULL MONTHLY BREAKDOWN FOR A CUSTOMER
 * @param {string} customerId - CUSTOMER ID
 * @param {number} pricePerLiter - CUSTOMER'S CURRENT PRICE PER LITER
 * @returns {Promise<Array>} MONTHLY BREAKDOWN SORTED OLDEST TO NEWEST
 */
// <== HELPER: BUILD FULL MONTHLY BREAKDOWN FOR A CUSTOMER ==>
export const buildMonthlyBreakdown = async (customerId, pricePerLiter) => {
  // FETCHING ALL DELIVERY RECORDS AND PAYMENTS FOR THIS CUSTOMER IN PARALLEL
  const [allDeliveries, allPayments] = await Promise.all([
    DeliveryRecord.find({ customerId }).sort({ date: 1 }).lean().exec(),
    Payment.find({ customerId }).lean().exec(),
  ]);
  // GROUPING ALL-TIME DELIVERY RECORDS BY MONTH STRING
  const deliveriesByMonth = {};
  // LOOPING THROUGH ALL DELIVERY RECORDS TO GROUP BY MONTH
  allDeliveries.forEach((record) => {
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
  allPayments.forEach((payment) => {
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
  // SORTING ALL ACTIVE MONTHS IN ASCENDING CHRONOLOGICAL ORDER (OLDEST FIRST)
  const sortedActiveMonths = Array.from(activeMonthsSet).sort();
  // BUILDING MONTHLY BREAKDOWN WITH FULL STATS AND PAYMENT STATUS FOR EACH ACTIVE MONTH
  return sortedActiveMonths.map((month) => {
    // GETTING DELIVERY RECORDS FOR THIS MONTH
    const monthDeliveries = deliveriesByMonth[month] || [];
    // GETTING PAYMENTS FOR THIS MONTH
    const monthPayments = paymentsByBillingMonth[month] || [];
    // COMPUTING MONTHLY STATS FOR THIS MONTH
    const stats = computeMonthlyStats(
      month,
      monthDeliveries,
      monthPayments,
      pricePerLiter,
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
};

/**
 * ALLOCATE A PAYMENT ACROSS OUTSTANDING MONTHS, OLDEST FIRST
 * @param {object} params - PAYMENT ALLOCATION PARAMETERS
 * @param {string} params.accountId - ACCOUNT ID OF THE USER PERFORMING THE PAYMENT
 * @param {string} params.customerId - CUSTOMER ID
 * @param {string} params.performedBy - USER ID OF THE PERSON PERFORMING THE PAYMENT
 * @param {number} params.amount - TOTAL AMOUNT BEING PAID ACROSS HOWEVER MANY MONTHS IT COVERS
 * @param {string} params.paymentDate - YYYY-MM-DD
 * @param {string|null} params.note - OPTIONAL NOTE ATTACHED TO THE PAYMENT
 * @param {number} params.pricePerLiter - CUSTOMER'S CURRENT PRICE PER LITER
 * @returns {Promise<object>} ALLOCATION RESULT OBJECT WITH DETAILS OF HOW THE PAYMENT WAS APPLIED
 */
// <== HELPER: ALLOCATE PAYMENT ACROSS OUTSTANDING MONTHS, OLDEST FIRST ==>
export const allocatePaymentAcrossMonths = async ({
  accountId,
  customerId,
  performedBy,
  amount,
  paymentDate,
  note,
  pricePerLiter,
}) => {
  // BUILDING THE FULL MONTHLY BREAKDOWN TO FIND EVERY MONTH WITH AN OUTSTANDING BALANCE
  const breakdown = await buildMonthlyBreakdown(customerId, pricePerLiter);
  // FILTERING TO ONLY MONTHS WITH A PENDING BALANCE — ALREADY SORTED OLDEST FIRST
  const outstandingMonths = breakdown.filter((m) => m.pending > 0);
  // SUMMING TOTAL OUTSTANDING ACROSS ALL PENDING MONTHS
  const totalOutstandingBefore = parseFloat(
    outstandingMonths.reduce((sum, m) => sum + m.pending, 0).toFixed(2),
  );
  // GUARDING AGAINST A CUSTOMER WITH NO OUTSTANDING BALANCE AT ALL
  if (outstandingMonths.length === 0) {
    // RETURNING AN ERROR RESULT — NOTHING TO ALLOCATE THIS PAYMENT AGAINST
    return { error: "This Customer has No Outstanding Balance to Pay!" };
  }
  // GUARDING AGAINST A PAYMENT LARGER THAN WHAT IS ACTUALLY OWED — NOTHING TO PRE-PAY AGAINST YET
  if (amount > totalOutstandingBefore) {
    // RETURNING AN ERROR RESULT RATHER THAN THROWING AN EXCEPTION — THE CALLER CAN HANDLE THIS GRACEFULLY
    return {
      error: `Payment Amount (₨${amount.toLocaleString()}) exceeds Total Outstanding (₨${totalOutstandingBefore.toLocaleString()})!`,
    };
  }
  // TRACKING HOW MUCH OF THE LUMP AMOUNT IS STILL UNALLOCATED
  let remaining = amount;
  // COLLECTING THE PAYMENT DOCUMENTS TO INSERT
  const paymentDocs = [];
  // COLLECTING A HUMAN-READABLE ALLOCATION SUMMARY FOR THE RESPONSE
  const allocations = [];
  // WALKING OUTSTANDING MONTHS OLDEST-FIRST UNTIL THE AMOUNT IS FULLY ALLOCATED
  for (const month of outstandingMonths) {
    // STOPPING ONCE THE FULL AMOUNT HAS BEEN ALLOCATED
    if (remaining <= 0) break;
    // APPLYING WHICHEVER IS SMALLER — THE REMAINING AMOUNT OR THIS MONTH'S PENDING BALANCE
    const applied = parseFloat(Math.min(remaining, month.pending).toFixed(2));
    // BUILDING THE PAYMENT DOCUMENT FOR THIS MONTH
    paymentDocs.push({
      customerId,
      accountId,
      performedBy,
      amount: applied,
      billingMonth: month.month,
      paymentDate,
      note,
    });
    // RECORDING THE ALLOCATION FOR THE RESPONSE SUMMARY
    allocations.push({
      billingMonth: month.month,
      pendingBefore: month.pending,
      amountApplied: applied,
      pendingAfter: parseFloat((month.pending - applied).toFixed(2)),
    });
    // DEDUCTING THE APPLIED AMOUNT FROM WHAT REMAINS TO BE ALLOCATED
    remaining = parseFloat((remaining - applied).toFixed(2));
  }
  // INSERTING ALL PAYMENT DOCUMENTS IN A SINGLE BATCH WRITE
  await Payment.insertMany(paymentDocs);
  // REBUILDING THE MONTHLY BREAKDOWN SO THE CALLER CAN RETURN FRESH, POST-PAYMENT FIGURES
  const updatedBreakdown = await buildMonthlyBreakdown(
    customerId,
    pricePerLiter,
  );
  // COMPUTING THE UPDATED ALL-TIME OUTSTANDING BALANCE
  const allTimeOutstanding = parseFloat(
    updatedBreakdown.reduce((sum, m) => sum + m.pending, 0).toFixed(2),
  );
  // RETURNING THE FULL ALLOCATION RESULT
  return {
    allocations,
    totalApplied: amount,
    totalOutstandingBefore,
    monthlyBreakdown: updatedBreakdown,
    allTimeOutstanding,
  };
};
