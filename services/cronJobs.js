// <== IMPORTS ==>
import {
  getLastMonthStr,
  getYesterdayDateStr,
  fetchDailyReportData,
  fetchMonthlyReportData,
} from "./reportService.js";
import cron from "node-cron";
import { User } from "../models/user.model.js";
import { sendDailyReport, sendMonthlyReport } from "./emailService.js";

// <== DAILY LOCK FLAG — PREVENT OVERLAPPING EXECUTIONS IF A RUN TAKES LONGER THAN 24 HOURS ==>
let isDailyRunning = false;
// <== MONTHLY LOCK FLAG — PREVENT OVERLAPPING EXECUTIONS IF A RUN TAKES LONGER THAN 24 HOURS ==>
let isMonthlyRunning = false;

// <== HELPER: PROCESS DAILY REPORTS FOR ALL ELIGIBLE USERS ==>
const processDailyReports = async (yesterdayStr) => {
  // GUARD: SKIP IF PREVIOUS DAILY RUN IS STILL IN PROGRESS
  if (isDailyRunning) {
    // LOG WARNING AND RETURN WITHOUT STARTING A NEW RUN
    console.warn(
      "[CRON:DAILY] Skipping run — previous execution is still in progress.",
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
    // FIND ALL USERS ELIGIBLE FOR DAILY REPORT
    const eligibleUsers = await User.find({
      dailyReportsEnabled: true,
      lastDailyReportSentDate: { $ne: yesterdayStr },
    })
      .select("_id email fullName")
      .lean()
      .exec();
    // LOG ELIGIBLE USER COUNT
    console.log(
      `[CRON:DAILY] ${eligibleUsers.length} user(s) eligible for daily report (period: ${yesterdayStr})`,
    );
    // PROCESS EACH ELIGIBLE USER INDEPENDENTLY
    for (const user of eligibleUsers) {
      try {
        // FETCHING DAILY REPORT DATA FOR THIS USER AND DATE
        const data = await fetchDailyReportData(user._id, yesterdayStr);
        // SENDING THE DAILY REPORT EMAIL
        await sendDailyReport({
          to: user.email,
          fullName: user.fullName,
          data,
          date: yesterdayStr,
        });
        // UPDATING THE USER LAST DAILY REPORT SENT DATE
        await User.updateOne(
          { _id: user._id },
          { lastDailyReportSentDate: yesterdayStr },
        );
        // LOG SUCCESS PER USER
        console.log(
          `[CRON:DAILY] Sent to ${user.email} for Period ${yesterdayStr}`,
        );
      } catch (userErr) {
        // LOG ERROR PER USER
        console.error(
          `[CRON:DAILY] Failed for ${user.email}: ${userErr.message}`,
        );
      }
    }
  } catch (fatalErr) {
    // LOG FATAL ERROR — LOCK WILL BE RELEASED IN FINALLY BLOCK
    console.error("[CRON:DAILY] Fatal error during run:", fatalErr.message);
  } finally {
    // ALWAYS RELEASE LOCK — EVEN IF AN ERROR OCCURRED
    isDailyRunning = false;
    // LOG RUN COMPLETE
    console.log("[CRON:DAILY] Run complete.");
  }
};

// <== HELPER: PROCESS MONTHLY REPORTS FOR ALL ELIGIBLE USERS ==>
const processMonthlyReports = async (lastMonthStr) => {
  // GUARD: SKIP IF PREVIOUS MONTHLY RUN IS STILL IN PROGRESS
  if (isMonthlyRunning) {
    // LOG WARNING AND RETURN WITHOUT STARTING A NEW RUN
    console.warn(
      "[CRON:MONTHLY] Skipping run — previous execution is still in progress.",
    );
    // RELEASE LOCK
    return;
  }
  // ACQUIRE LOCK
  isMonthlyRunning = true;
  // LOG RUN START
  console.log(
    `[CRON:MONTHLY] Starting monthly report run — report period: ${lastMonthStr}`,
  );
  try {
    // FIND ALL USERS ELIGIBLE FOR MONTHLY REPORT
    const eligibleUsers = await User.find({
      monthlyReportsEnabled: true,
      lastMonthlyReportSentDate: { $ne: lastMonthStr },
    })
      .select("_id email fullName")
      .lean()
      .exec();
    // LOG ELIGIBLE USER COUNT
    console.log(
      `[CRON:MONTHLY] ${eligibleUsers.length} user(s) eligible for monthly report (period: ${lastMonthStr})`,
    );
    // PROCESS EACH ELIGIBLE USER INDEPENDENTLY
    for (const user of eligibleUsers) {
      try {
        // FETCHING COMPREHENSIVE MONTHLY REPORT DATA FOR THIS USER AND MONTH
        const data = await fetchMonthlyReportData(user._id, lastMonthStr);
        // SENDING THE MONTHLY REPORT EMAIL
        await sendMonthlyReport({
          to: user.email,
          fullName: user.fullName,
          data,
          month: lastMonthStr,
        });
        // UPDATING THE USER LAST MONTHLY REPORT SENT DATE
        await User.updateOne(
          { _id: user._id },
          { lastMonthlyReportSentDate: lastMonthStr },
        );
        // LOG SUCCESS PER USER
        console.log(
          `[CRON:MONTHLY] Sent to ${user.email} for period ${lastMonthStr}`,
        );
      } catch (userErr) {
        // LOG ERROR PER USER
        console.error(
          `[CRON:MONTHLY] Failed for ${user.email}: ${userErr.message}`,
        );
      }
    }
  } catch (fatalErr) {
    // LOG FATAL ERROR — LOCK WILL BE RELEASED IN FINALLY BLOCK
    console.error("[CRON:MONTHLY] Fatal error during run:", fatalErr.message);
  } finally {
    // ALWAYS RELEASE LOCK — EVEN IF AN ERROR OCCURRED
    isMonthlyRunning = false;
    // LOG RUN COMPLETE
    console.log("[CRON:MONTHLY] Run complete.");
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
      // RUNNING MONTHLY REPORTS CHECK — SENDS ONLY IF LAST MONTH'S REPORT HAS NOT BEEN SENT YET
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
