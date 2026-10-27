/** Run the reminder scan once. Schedule with cron, e.g. every 15 minutes:
 *    npm run notifications:run
 *  Creates/updates in-app notifications only; it sends no email. */
import { runNotificationScan } from "../src/lib/services/notifications";
import { db } from "../src/lib/db";

runNotificationScan()
  .then((r) => console.log(`Reminder scan: ${r.conditions} conditions, ${r.created} new, ${r.resolved} resolved.`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
