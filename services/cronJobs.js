// <== IMPORTS ==>
import {
  getLastMonthStr,
  getYesterdayDateStr,
  fetchDailyReportData,
  fetchMonthlyReportData,
} from "./reportService.js";
import cron from "node-cron";
import { Account } from "../models/account.model.js";
import { User, USER_ROLES } from "../models/user.model.js";
import { sendDailyReport, sendMonthlyReport } from "./emailService.js";

// <== DAILY LOCK FLAG — PREVENT OVERLAPPING EXECUTIONS IF A RUN TAKES LONGER THAN 24 HOURS ==>
let isDailyRunning = false;
// <== MONTHLY LOCK FLAG — PREVENT OVERLAPPING EXECUTIONS IF A RUN TAKES LONGER THAN 24 HOURS ==>
let isMonthlyRunning = false;

// <== HELPER: PROCESS DAILY REPORTS FOR ALL ELIGIBLE ACCOUNTS ==>
const processDailyReports = async (yesterdayStr) => {
  // GUARD: SKIP IF PREVIOUS DAILY RUN IS STILL IN PROGRESS
  if (isDailyRunning) {
    // LOG WARNING AND RETURN WITHOUT STARTING A NEW RUN
    console.warn(
      "[CRON:DAILY] Skipping Run — Previous Execution is Still in Progress.",
    );
    // RELEASE LOCK
    return;
  }
  // ACQUIRE LOCK
  isDailyRunning = true;
  // LOG RUN START
  console.log(
    `[CRON:DAILY] Starting Daily Report Run — Report Period: ${yesterdayStr}`,
  );
  try {
    // FINDING ALL ACCOUNTS ELIGIBLE FOR DAILY REPORT
    const eligibleAccounts = await Account.find({
      dailyReportsEnabled: true,
      lastDailyReportSentDate: { $ne: yesterdayStr },
    })
      .select("_id")
      .lean()
      .exec();
    // LOG ELIGIBLE ACCOUNT COUNT
    console.log(
      `[CRON:DAILY] ${eligibleAccounts.length} Account(s) Eligible for Daily Report (Period: ${yesterdayStr})`,
    );
    // PROCESS EACH ELIGIBLE ACCOUNT INDEPENDENTLY
    for (const account of eligibleAccounts) {
      try {
        // FINDING THE SUPERADMIN OF THIS ACCOUNT TO OBTAIN EMAIL AND NAME FOR THE REPORT
        const superadmin = await User.findOne({
          accountId: account._id,
          role: USER_ROLES.SUPERADMIN,
        })
          .select("email fullName")
          .lean()
          .exec();
        // GUARD: SKIP ACCOUNT IF SUPERADMIN IS NOT FOUND — LOG WARNING FOR DATA INTEGRITY VISIBILITY
        if (!superadmin) {
          // LOGGING WARNING FOR MISSING SUPERADMIN
          console.warn(
            `[CRON:DAILY] No Superadmin Found for Account ${account._id} — Skipping`,
          );
          // SKIPPING TO NEXT ACCOUNT
          continue;
        }
        // FETCHING DAILY REPORT DATA FOR THIS ACCOUNT AND DATE
        const data = await fetchDailyReportData(account._id, yesterdayStr);
        // SENDING THE DAILY REPORT EMAIL TO THE SUPERADMIN
        await sendDailyReport({
          to: superadmin.email,
          fullName: superadmin.fullName,
          data,
          date: yesterdayStr,
        });
        // UPDATING THE ACCOUNT LAST DAILY REPORT SENT DATE — IDEMPOTENCY GUARD ON Account
        await Account.updateOne(
          { _id: account._id },
          { lastDailyReportSentDate: yesterdayStr },
        );
        // LOG SUCCESS PER ACCOUNT
        console.log(
          `[CRON:DAILY] Sent to ${superadmin.email} for Period ${yesterdayStr}`,
        );
      } catch (accountErr) {
        // LOG ERROR PER ACCOUNT
        console.error(
          `[CRON:DAILY] Failed for Account ${account._id}: ${accountErr.message}`,
        );
      }
    }
  } catch (fatalErr) {
    // LOG FATAL ERROR — LOCK WILL BE RELEASED IN FINALLY BLOCK
    console.error("[CRON:DAILY] Fatal Error during Run:", fatalErr.message);
  } finally {
    // ALWAYS RELEASE LOCK — EVEN IF AN ERROR OCCURRED
    isDailyRunning = false;
    // LOG RUN COMPLETE
    console.log("[CRON:DAILY] Run Complete.");
  }
};

// <== HELPER: PROCESS MONTHLY REPORTS FOR ALL ELIGIBLE ACCOUNTS ==>
const processMonthlyReports = async (lastMonthStr) => {
  // GUARD: SKIP IF PREVIOUS MONTHLY RUN IS STILL IN PROGRESS
  if (isMonthlyRunning) {
    // LOG WARNING AND RETURN WITHOUT STARTING A NEW RUN
    console.warn(
      "[CRON:MONTHLY] Skipping Run — Previous Execution is Still in Progress.",
    );
    // RELEASE LOCK
    return;
  }
  // ACQUIRE LOCK
  isMonthlyRunning = true;
  // LOG RUN START
  console.log(
    `[CRON:MONTHLY] Starting Monthly range: Report Run — Report Period: ${lastMonthStr}`,
  );
  try {
    // FINDING ALL ACCOUNTS ELIGIBLE FOR MONTHLY REPORT
    const eligibleAccounts = await Account.find({
      monthlyReportsEnabled: true,
      lastMonthlyReportSentDate: { $ne: lastMonthStr },
    })
      .select("_id")
      .lean()
      .exec();
    // LOG ELIGIBLE ACCOUNT COUNT
    console.log(
      `[CRON:MONTHLY] ${eligibleAccounts.length} Account(s) Eligible for Monthly Report (Period: ${lastMonthStr})`,
    );
    // PROCESS EACH ELIGIBLE ACCOUNT INDEPENDENTLY
    for (const account of eligibleAccounts) {
      try {
        // FINDING THE SUPERADMIN OF THIS ACCOUNT TO OBTAIN EMAIL AND NAME FOR THE REPORT
        const superadmin = await User.findOne({
          accountId: account._id,
          role: USER_ROLES.SUPERADMIN,
        })
          .select("email fullName")
          .lean()
          .exec();
        // GUARD: SKIP ACCOUNT IF SUPERADMIN IS NOT FOUND — LOG WARNING FOR DATA INTEGRITY VISIBILITY
        if (!superadmin) {
          // LOGGING WARNING FOR MISSING SUPERADMIN
          console.warn(
            `[CRON:MONTHLY] No Superadmin Found for Account ${account._id} — Skipping`,
          );
          // SKIPPING TO NEXT ACCOUNT
          continue;
        }
        // FETCHING COMPREHENSIVE MONTHLY REPORT DATA FOR THIS ACCOUNT AND MONTH
        const data = await fetchMonthlyReportData(account._id, lastMonthStr);
        // SENDING THE MONTHLY REPORT EMAIL TO THE SUPERADMIN
        await sendMonthlyReport({
          to: superadmin.email,
          fullName: superadmin.fullName,
          data,
          month: lastMonthStr,
        });
        // UPDATING THE ACCOUNT LAST MONTHLY REPORT SENT DATE
        await Account.updateOne(
          { _id: account._id },
          { lastMonthlyReportSentDate: lastMonthStr },
        );
        // LOG SUCCESS PER ACCOUNT
        console.log(
          `[CRON:MONTHLY] Sent to ${superadmin.email} for Period ${lastMonthStr}`,
        );
      } catch (accountErr) {
        // LOG ERROR PER ACCOUNT
        console.error(
          `[CRON:MONTHLY] Failed for Account ${account._id}: ${accountErr.message}`,
        );
      }
    }
  } catch (fatalErr) {
    // LOG FATAL ERROR — LOCK WILL BE RELEASED IN FINALLY BLOCK
    console.error("[CRON:MONTHLY] Fatal Error during Run:", fatalErr.message);
  } finally {
    // ALWAYS RELEASE LOCK — EVEN IF AN ERROR OCCURRED
    isMonthlyRunning = false;
    // LOG RUN COMPLETE
    console.log("[CRON:MONTHLY] Run Complete.");
  }
};

/**
 * INITIALIZE ALL CRON JOBS
 * CALLED ONCE ON SERVER STARTUP AFTER DATABASE CONNECTION IS CONFIRMED
 * SCHEDULE: RUNS DAILY AT 07:00 UTC
 * AT 07:00 UTC = 12:00 NOON PKT (UTC+5)
 */
// <== INITIALIZE CRON JOBS ==>
export const initializeCronJobs = () => {
  // SCHEDULE CRON JOBS
  cron.schedule(
    "0 7 * * *",
    async () => {
      // GETTING YESTERDAY DATE STRING FOR DAILY REPORT PERIOD
      const yesterdayStr = getYesterdayDateStr();
      // GETTING LAST MONTH STRING FOR MONTHLY REPORT PERIOD
      const lastMonthStr = getLastMonthStr();
      // RUNNING DAILY REPORTS FIRST
      await processDailyReports(yesterdayStr);
      // RUNNING MONTHLY REPORTS CHECK
      await processMonthlyReports(lastMonthStr);
    },
    // RUNNING IN UTC TO AVOID DAYLIGHT SAVING TIME AMBIGUITY
    { timezone: "UTC" },
  );
  // LOG INITIALIZATION SUCCESS
  console.log(
    "[CRON] Report Jobs Initialized — Daily and Monthly Reports Fire at 07:00 UTC Every Day.",
  );
};
