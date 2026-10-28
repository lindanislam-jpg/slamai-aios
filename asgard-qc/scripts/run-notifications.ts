/** Run the reminder and Smart Quality Alert scan once. Schedule with cron, e.g. every 15 minutes:
 *    npm run notifications:run
 *  Creates/updates in-app notifications only; it sends no email. */
import { runNotificationScan } from "../src/lib/services/notifications";
import { db } from "../src/lib/db";

runNotificationScan()
  .then((r) => console.log(`Scan: ${r.conditions} conditions, ${r.created} new reminders, ${r.resolved} resolved; alerts ${JSON.stringify(r.alerts)}.`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
