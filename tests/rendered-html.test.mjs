import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("requires explicit commitment terms during authentication", async () => {
  const [screen, register, login, welcomeEmail] = await Promise.all([
    readFile(new URL("../app/AuthScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/email/welcome-notification.ts", import.meta.url), "utf8"),
  ]);
  assert.match(screen, /acceptedTerms/);
  assert.match(screen, /two LeetCode questions by 11:59 PM ET/);
  assert.match(screen, /\$10 charge for each other eligible member/);
  assert.match(register, /input\.acceptedTerms !== true/);
  assert.match(login, /input\.acceptedTerms !== true/);
  assert.match(register, /sendWelcomeNotification/);
  assert.match(welcomeEmail, /subject: "Welcome to Commit"/);
  assert.match(welcomeEmail, /`welcome-\$\{input\.userId\}`/);
});

test("requires a 300-word waiver and unanimous member approval", async () => {
  const [requestRoute, voteRoute, app, email] = await Promise.all([
    readFile(new URL("../app/api/waivers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/waivers/[id]/vote/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AccountabilityApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/email/waiver-notification.ts", import.meta.url), "utf8"),
  ]);
  assert.match(requestRoute, /wordCount\(explanation\) < 300/);
  assert.match(requestRoute, /sendWaiverNotification/);
  assert.match(voteRoute, /waiver\.requesterId === user\.id/);
  assert.match(voteRoute, /sendWaiverAcceptedNotification/);
  assert.match(voteRoute, /previousVote !== "APPROVE"/);
  assert.match(voteRoute, /sendWaiverRejectedNotifications/);
  assert.match(voteRoute, /previousVote !== "REJECT"/);
  assert.match(voteRoute, /eligibleVoterIds\.every/);
  assert.match(app, /\/ 300 words/);
  assert.match(app, /Every other active member must approve/);
  assert.match(app, /Today is complete/);
  assert.match(app, /!complete && <button className="primary" onClick=\{onRequest\}/);
  assert.match(requestRoute, /activeMembers\.map\(member => member\.email\)/);
  assert.match(email, /email !== requesterEmail/);
  assert.match(email, /to: \[recipient\]/);
  assert.match(email, /waiver-request-\$\{input\.waiverId\}-\$\{recipient\}/);
});

test("stores screenshot proof and renders real daily progress", async () => {
  const [route, app, page] = await Promise.all([
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AccountabilityApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /env\.PROOFS\.put/);
  assert.match(route, /await proof\.file\.arrayBuffer\(\)/);
  assert.match(route, /completedCount: currentCount \+ 1/);
  assert.match(route, /DAILY_REQUIRED/);
  assert.match(route, /sendCompletionNotification/);
  assert.match(route, /completedCount === DAILY_REQUIRED/);
  assert.match(app, /Today’s progress is \$\{count\}\/2/);
  assert.match(app, /proof-grid/);
  assert.match(page, /problemSubmissions/);
  assert.match(page, /ownProgress/);
});

test("protects malformed auth requests, upload metadata, and proof privacy", async () => {
  const [login, register, submissions, proofs, admin] = await Promise.all([
    readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/proofs/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(login, /request\.json\(\)\.catch/);
  assert.match(register, /request\.json\(\)\.catch/);
  assert.match(submissions, /problemTitle\.length > 200/);
  assert.match(proofs, /isNull\(groupMembers\.leftAt\)/);
  assert.match(admin, /isNull\(groupMembers\.leftAt\)/);
});

test("keeps successful actions on the current view with confirmation", async () => {
  const app = await readFile(new URL("../app/AccountabilityApp.tsx", import.meta.url), "utf8");
  assert.match(app, /useRouter/);
  assert.match(app, /router\.refresh\(\)/);
  assert.match(app, /Waiver approved\. The requester has been notified\./);
  assert.match(app, /Waiver rejected\. Your vote was saved\./);
  assert.doesNotMatch(app, /setTimeout\(\(\) => window\.location\.reload/);
  assert.match(app, /success-toast/);
});

test("requires card and payout setup before proof submission", async () => {
  const [status, sync, route, page, app] = await Promise.all([
    readFile(new URL("../lib/payments/commitment-status.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/sync-stripe.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AccountabilityApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(status, /paymentMethods\.status, "ACTIVE"/);
  assert.match(status, /payoutsEnabled/);
  assert.match(status, /complete: hasCard && payoutsReady/);
  assert.match(sync, /setupIntents\.retrieve/);
  assert.match(sync, /intent\.metadata\.commitUserId !== userId/);
  assert.match(sync, /accounts\.retrieve/);
  assert.match(route, /if \(!paymentSetup\.complete\)/);
  assert.match(route, /status: 403/);
  assert.match(page, /paymentSetup=\{paymentSetup\}/);
  assert.match(app, /Commitment setup incomplete/);
  assert.match(app, /Unlock submissions/);
});

test("schedules retry-safe automatic violation evaluation", async () => {
  const [workflow, route, processor] = await Promise.all([
    readFile(new URL("../.github/workflows/evaluate-commitments.yml", import.meta.url), "utf8"),
    readFile(new URL("../app/api/jobs/evaluate-violations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/process-violation.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow, /secrets\.COMMIT_CRON_SECRET/);
  assert.match(route, /lte\(dailyCommitments\.deadline, now\)/);
  assert.match(route, /eq\(dailyCommitments\.status, "WAIVER_PENDING"\)/);
  assert.match(processor, /violation-charge-\$\{commitmentId\}/);
  assert.match(processor, /violation-transfer-\$\{commitmentId\}-\$\{recipient\.userId\}/);
  assert.match(processor, /source_transaction: chargeId/);
});
