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
