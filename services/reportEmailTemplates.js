// <== SIGNATURE BLUE PALETTE — USED ACROSS ALL REPORT TEMPLATES ==>
const RED = "#DC2626";
const BLUE = "#3B82F6";
const DARK = "#0F172A";
const MUTED = "#64748B";
const WHITE = "#FFFFFF";
const GREEN = "#16A34A";
const AMBER = "#D97706";
const RED_BG = "#FEF2F2";
const BORDER = "#E2E8F0";
const LIGHT_BG = "#F8FAFC";
const GREEN_BG = "#F0FDF4";
const AMBER_BG = "#FFFBEB";
const BLUE_DARK = "#1D4ED8";
const BLUE_LIGHT = "#EFF6FF";
const BLUE_BORDER = "#BFDBFE";

// <== HELPER: FORMAT AMOUNT ==>
const fmt = (n) => `&#8360;${Number(n ?? 0).toLocaleString("en-PK")}`;

// <== HELPER: FORMAT QUANTITY ==>
const fmtQty = (n, unit) => `${Number(n ?? 0).toLocaleString("en-PK")}${unit}`;

// <== HELPER: FORMAT MONTH NAME FROM YYYY-MM ==>
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const formatMonth = (monthStr) => {
  // PARSING YEAR AND MONTH FROM YYYY-MM STRING
  const [year, month] = monthStr.split("-").map(Number);
  // RETURNING MONTH NAME
  return `${MONTH_NAMES[month - 1]} ${year}`;
};

// <== HELPER: FORMAT DATE FROM YYYY-MM-DD TO READABLE FORM ==>
const formatDate = (dateStr) => {
  // PARSING YEAR, MONTH AND DAY FROM YYYY-MM-DD STRING
  const [year, month, day] = dateStr.split("-").map(Number);
  // RETURNING READABLE DATE
  const d = new Date(Date.UTC(year, month - 1, day));
  // RETURNING READABLE DATE
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
};

// <== HELPER: METRIC BOX — SINGLE STAT CELL WITH COLOURED LEFT BORDER ==>
const metricBox = ({ label, value, borderColor = BLUE, valueColor = DARK }) => `
<td style="width:50%;padding:5px;">
  <div style="background:${BLUE_LIGHT};border-left:3px solid ${borderColor};border-radius:0 6px 6px 0;padding:12px 14px;">
    <p style="margin:0 0 3px;font-size:10px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${MUTED};font-family:Arial,sans-serif;">${label}</p>
    <p style="margin:0;font-size:18px;font-weight:700;color:${valueColor};font-family:Arial,sans-serif;">${value}</p>
  </div>
</td>`;

// <== HELPER: SECTION HEADER ROW ==>
const sectionHeader = (title) => `
<tr>
  <td colspan="2" style="padding:20px 0 8px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="border-bottom:2px solid ${BLUE};padding-bottom:6px;">
          <span style="font-size:13px;font-weight:700;color:${BLUE};text-transform:uppercase;letter-spacing:0.8px;font-family:Arial,sans-serif;">${title}</span>
        </td>
      </tr>
    </table>
  </td>
</tr>`;

// <== HELPER: DATA ROW — LABEL AND VALUE PAIR ==>
const dataRow = (label, value, valueColor = DARK) => `
<tr>
  <td style="padding:5px 0;font-size:13px;color:${MUTED};font-family:Arial,sans-serif;border-bottom:1px solid ${BORDER};">${label}</td>
  <td style="padding:5px 0;font-size:13px;font-weight:600;color:${valueColor};text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid ${BORDER};">${value}</td>
</tr>`;

// <== HELPER: INDICATOR BOX — COLOURED STATUS INDICATOR ==>
const statusBadge = (text, bgColor, textColor) =>
  `<span style="display:inline-block;background:${bgColor};color:${textColor};font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;font-family:Arial,sans-serif;">${text}</span>`;

// <== BASE LAYOUT — SHARED SHELL FOR ALL REPORT EMAILS ==>
const reportBaseLayout = ({
  title,
  preheader,
  period,
  bodyContent,
}) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">

          <!-- HEADER BAND -->
          <tr>
            <td style="background-color:${BLUE};padding:24px 36px;text-align:center;border-radius:12px 12px 0 0;">
              <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${BLUE_BORDER};font-family:Arial,sans-serif;">MILK SHOP MANAGEMENT</p>
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:${WHITE};font-family:Arial,sans-serif;">${title}</p>
              <p style="margin:0;font-size:13px;color:${BLUE_LIGHT};font-family:Arial,sans-serif;">${period}</p>
            </td>
          </tr>

          <!-- CARD BODY -->
          <tr>
            <td style="background-color:${WHITE};padding:28px 36px 24px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
              ${bodyContent}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:${LIGHT_BG};padding:18px 36px;text-align:center;border:1px solid ${BORDER};border-top:none;border-radius:0 0 12px 12px;">
              <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.7;font-family:Arial,sans-serif;">
                This report was automatically generated by <strong style="color:${MUTED};">Milk Shop Management System</strong>.<br/>
                You can manage report settings from your account preferences.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// <== DAILY REPORT TEMPLATE ==>
export const dailyReportTemplate = ({ fullName, date, data }) => {
  // FORMAT DATE FOR DISPLAY
  const displayDate = formatDate(date);
  // NET POSITION IS POSITIVE IF REVENUE EXCEEDS EXPENSES
  const netPositive = data.totalRevenue >= data.totalExpenses;
  // NET VALUE
  const netValue = Math.abs(data.totalRevenue - data.totalExpenses);
  // DELIVERY RATE COLOUR
  const delivRateColor =
    data.deliveries.deliveryRate >= 80
      ? GREEN
      : data.deliveries.deliveryRate >= 60
        ? AMBER
        : RED;
  // BUILD EMAIL BODY
  const bodyContent = `
    <!-- GREETING -->
    <p style="margin:0 0 20px;font-size:15px;color:${DARK};font-family:Arial,sans-serif;">
      Hi <strong>${fullName}</strong>, here is your daily summary for <strong>${displayDate}</strong>.
    </p>
    <!-- FINANCIAL OVERVIEW METRICS — 2x2 GRID -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:8px;">
      <tr>
        ${metricBox({ label: "Total Revenue", value: fmt(data.totalRevenue), borderColor: GREEN, valueColor: GREEN })}
        ${metricBox({ label: "Total Expenses", value: fmt(data.totalExpenses), borderColor: RED, valueColor: RED })}
      </tr>
      <tr>
        ${metricBox({ label: netPositive ? "Net Surplus" : "Net Deficit", value: fmt(netValue), borderColor: netPositive ? GREEN : RED, valueColor: netPositive ? GREEN : RED })}
        ${metricBox({ label: "Quick Sales", value: fmt(data.quickSales.totalRevenue), borderColor: BLUE, valueColor: BLUE })}
      </tr>
    </table>
    <!-- SALES SECTION -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      ${sectionHeader("Sales")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${dataRow("Customer Sales", fmt(data.sales.customerSales))}
            ${data.sales.customerSalesPending > 0 ? dataRow("&nbsp;&nbsp;&nbsp;Pending Amount", fmt(data.sales.customerSalesPending), AMBER) : ""}
            ${dataRow("Shop Sales", fmt(data.sales.shopSales))}
            ${dataRow("Total Sales Revenue", fmt(data.sales.totalRevenue), BLUE)}
          </table>
        </td>
      </tr>
      <!-- QUICK SALES SECTION -->
      ${sectionHeader("Quick Sales")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${dataRow("Milk — " + fmtQty(data.quickSales.milkQty, "L"), fmt(data.quickSales.milkRevenue))}
            ${dataRow("Yoghurt — " + fmtQty(data.quickSales.yoghurtQty, "kg"), fmt(data.quickSales.yoghurtRevenue))}
            ${dataRow("Quick Sales Total", fmt(data.quickSales.totalRevenue), BLUE)}
          </table>
        </td>
      </tr>
      <!-- DELIVERIES SECTION -->
      ${sectionHeader("Customer Deliveries")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${dataRow("Delivered", `${data.deliveries.delivered} customer${data.deliveries.delivered !== 1 ? "s" : ""}`, GREEN)}
            ${dataRow("Missed", `${data.deliveries.missed} customer${data.deliveries.missed !== 1 ? "s" : ""}`, data.deliveries.missed > 0 ? RED : MUTED)}
            ${dataRow("Milk Delivered", fmtQty(data.deliveries.totalMilkDelivered, "L"))}
            ${dataRow("Delivery Rate", `${data.deliveries.deliveryRate}%`, delivRateColor)}
          </table>
        </td>
      </tr>
      <!-- PURCHASES AND EXPENDITURES SECTION -->
      ${sectionHeader("Purchases &amp; Expenditures")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${data.purchases.count > 0 ? dataRow(`Purchases (${data.purchases.count} record${data.purchases.count !== 1 ? "s" : ""} — ${fmtQty(data.purchases.totalMilk, "L")})`, fmt(data.purchases.totalCost), RED) : dataRow("Purchases", "None today", MUTED)}
            ${data.expenditures.count > 0 ? dataRow(`Expenditures (${data.expenditures.count} record${data.expenditures.count !== 1 ? "s" : ""})`, fmt(data.expenditures.totalAmount), AMBER) : dataRow("Expenditures", "None today", MUTED)}
          </table>
        </td>
      </tr>
    </table>
    <!-- STATUS LINE -->
    <p style="margin:20px 0 0;font-size:12px;color:${MUTED};text-align:center;font-family:Arial,sans-serif;">
      ${
        netPositive
          ? `<span style="color:${GREEN};font-weight:600;">Profitable day</span> — Revenue exceeded expenses by ${fmt(netValue)}`
          : `<span style="color:${RED};font-weight:600;">Loss day</span> — Expenses exceeded revenue by ${fmt(netValue)}`
      }
    </p>
  `;
  // RETURNING FORMATTED DAILY REPORT EMAIL
  return reportBaseLayout({
    title: "Daily Business Report",
    preheader: `Your daily summary for ${displayDate} — Revenue: ${fmt(data.totalRevenue)}`,
    period: displayDate,
    bodyContent,
  });
};

// <== MONTHLY REPORT TEMPLATE ==>
export const monthlyReportTemplate = ({ fullName, month, data }) => {
  // FORMAT MONTH FOR DISPLAY
  const displayMonth = formatMonth(month);
  // NET POSITION FLAGS
  const netPositive = data.financialSummary.netPosition >= 0;
  // NET POSITION COLOUR
  const netColor = netPositive ? GREEN : RED;
  // NET POSITION LABEL
  const netLabel = netPositive ? "Net Surplus" : "Net Deficit";
  // DELIVERY RATE COLOUR
  const delivRateColor =
    data.deliveries.deliveryRate >= 80
      ? GREEN
      : data.deliveries.deliveryRate >= 60
        ? AMBER
        : RED;
  // RECOVERY RATE COLOUR
  const recovRateColor =
    data.recovery.recoveryRate >= 75
      ? GREEN
      : data.recovery.recoveryRate >= 50
        ? AMBER
        : RED;
  // BUILD EMAIL BODY
  const bodyContent = `
    <!-- GREETING -->
    <p style="margin:0 0 20px;font-size:15px;color:${DARK};font-family:Arial,sans-serif;">
      Hi <strong>${fullName}</strong>, here is your comprehensive monthly report for <strong>${displayMonth}</strong>.
    </p>

    <!-- FINANCIAL OVERVIEW — 2x2 GRID -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:4px;">
      <tr>
        ${metricBox({ label: "Total Revenue", value: fmt(data.financialSummary.totalRevenue), borderColor: GREEN, valueColor: GREEN })}
        ${metricBox({ label: "Total Expenses", value: fmt(data.financialSummary.totalExpenses), borderColor: RED, valueColor: RED })}
      </tr>
      <tr>
        ${metricBox({ label: netLabel, value: fmt(Math.abs(data.financialSummary.netPosition)), borderColor: netColor, valueColor: netColor })}
        ${metricBox({ label: "Gross Profit", value: fmt(data.financialSummary.grossProfit), borderColor: BLUE, valueColor: BLUE })}
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <!-- SALES SECTION -->
      ${sectionHeader("Sales")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${dataRow("Customer Sales — Milk (" + fmtQty(data.sales.customerMilk.qty, "L") + ")", fmt(data.sales.customerMilk.total))}
            ${dataRow("Customer Sales — Yoghurt (" + fmtQty(data.sales.customerYoghurt.qty, "kg") + ")", fmt(data.sales.customerYoghurt.total))}
            ${dataRow("Shop Sales — Milk (" + fmtQty(data.sales.shopMilk.qty, "L") + ")", fmt(data.sales.shopMilk.total))}
            ${dataRow("Shop Sales — Yoghurt (" + fmtQty(data.sales.shopYoghurt.qty, "kg") + ")", fmt(data.sales.shopYoghurt.total))}
            ${dataRow("Total Customer Sales", fmt(data.sales.totalCustomerSales), BLUE)}
            ${dataRow("Total Shop Sales", fmt(data.sales.totalShopSales), BLUE)}
            ${dataRow("Combined Sales Revenue", fmt(data.sales.totalRevenue), DARK)}
          </table>
        </td>
      </tr>
      <!-- QUICK SALES SECTION -->
      ${sectionHeader("Quick Sales")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${dataRow("Milk — " + fmtQty(data.quickSales.milk.qty, "L") + " (" + data.quickSales.milk.count + " transactions)", fmt(data.quickSales.milk.total))}
            ${dataRow("Yoghurt — " + fmtQty(data.quickSales.yoghurt.qty, "kg") + " (" + data.quickSales.yoghurt.count + " transactions)", fmt(data.quickSales.yoghurt.total))}
            ${dataRow("Quick Sales Total", fmt(data.quickSales.totalRevenue), BLUE)}
          </table>
        </td>
      </tr>
      <!-- PURCHASES SECTION -->
      ${sectionHeader("Purchases")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${dataRow("Total Milk Purchased", fmtQty(data.purchases.totalMilk, "L"))}
            ${dataRow("Average Cost Per Litre", fmt(data.purchases.avgCostPerLiter))}
            ${dataRow("Total Purchase Cost (" + data.purchases.count + " records)", fmt(data.purchases.totalCost), RED)}
          </table>
        </td>
      </tr>
      <!-- EXPENDITURES SECTION -->
      ${sectionHeader("Expenditures")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${data.expenditures.supplies > 0 ? dataRow("Supplies", fmt(data.expenditures.supplies)) : ""}
            ${data.expenditures.meals > 0 ? dataRow("Meals", fmt(data.expenditures.meals)) : ""}
            ${data.expenditures.transport > 0 ? dataRow("Transport", fmt(data.expenditures.transport)) : ""}
            ${data.expenditures.misc > 0 ? dataRow("Misc", fmt(data.expenditures.misc)) : ""}
            ${dataRow("Total Expenditures", fmt(data.expenditures.totalAmount), AMBER)}
          </table>
        </td>
      </tr>
      <!-- DELIVERIES SECTION -->
      ${sectionHeader("Customer Deliveries")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${dataRow("Days Delivered", String(data.deliveries.deliveredDays), GREEN)}
            ${dataRow("Days Missed", String(data.deliveries.missedDays), data.deliveries.missedDays > 0 ? RED : MUTED)}
            ${dataRow("Total Milk Delivered", fmtQty(data.deliveries.totalMilkDelivered, "L"))}
            ${dataRow("Delivery Rate", `${data.deliveries.deliveryRate}%`, delivRateColor)}
            ${dataRow("Monthly Billing Due", fmt(data.deliveries.monthlyBillingDue))}
            ${dataRow("Collected", fmt(data.deliveries.monthlyBillingPaid), GREEN)}
            ${dataRow("Still Pending", fmt(data.deliveries.monthlyBillingPending), data.deliveries.monthlyBillingPending > 0 ? RED : MUTED)}
          </table>
        </td>
      </tr>
      <!-- STAFF SECTION -->
      ${sectionHeader("Staff &amp; Payroll")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${dataRow("Total Staff", String(data.staff.totalStaff))}
            ${dataRow("Monthly Salary Bill", fmt(data.staff.totalSalaryBill))}
            ${data.staff.totalExtraAllocated > 0 ? dataRow("Extra Allocated", fmt(data.staff.totalExtraAllocated), AMBER) : ""}
            ${dataRow("Total Monthly Outgo", fmt(data.staff.totalMonthlyOutgo), RED)}
            ${dataRow("Total Paid", fmt(data.staff.totalPaid), GREEN)}
            ${data.staff.totalPending > 0 ? dataRow("Still Pending", fmt(data.staff.totalPending), RED) : ""}
            ${dataRow("Cleared / Total", `${data.staff.clearedCount} / ${data.staff.totalStaff}`, data.staff.clearedCount === data.staff.totalStaff ? GREEN : AMBER)}
          </table>
        </td>
      </tr>
      <!-- RECOVERY SECTION -->
      ${sectionHeader("Outstanding Recovery (All-Time)")}
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${dataRow("Sales Outstanding", fmt(data.recovery.salesOutstanding), data.recovery.salesOutstanding > 0 ? RED : MUTED)}
            ${dataRow("Delivery Outstanding", fmt(data.recovery.deliveryOutstanding), data.recovery.deliveryOutstanding > 0 ? RED : MUTED)}
            ${dataRow("Total Outstanding", fmt(data.recovery.totalOutstanding), data.recovery.totalOutstanding > 0 ? RED : GREEN)}
            ${dataRow("Total Collected (All-Time)", fmt(data.recovery.totalAllTimePaid), GREEN)}
            ${dataRow("Recovery Rate", `${data.recovery.recoveryRate}%`, recovRateColor)}
          </table>
        </td>
      </tr>

    </table>
    <!-- CLOSING NOTE -->
    <p style="margin:20px 0 0;font-size:12px;color:${MUTED};text-align:center;font-family:Arial,sans-serif;">
      ${
        netPositive
          ? `<span style="color:${GREEN};font-weight:600;">Profitable month</span> — Net surplus of ${fmt(data.financialSummary.netPosition)}`
          : `<span style="color:${RED};font-weight:600;">Loss month</span> — Net deficit of ${fmt(Math.abs(data.financialSummary.netPosition))}`
      }
    </p>
  `;
  // RETURNING FORMATTED MONTHLY REPORT EMAIL
  return reportBaseLayout({
    // TITLE FOR THE TEMPLATE
    title: "Monthly Business Report",
    // PREHEADER FOR THE TEMPLATE
    preheader: `Your ${displayMonth} monthly report — Revenue: ${fmt(data.financialSummary.totalRevenue)}, Net: ${netPositive ? "+" : "-"}${fmt(Math.abs(data.financialSummary.netPosition))}`,
    // PERIOD FOR THE TEMPLATE
    period: displayMonth,
    // BODY CONTENT FOR THE TEMPLATE
    bodyContent,
  });
};
