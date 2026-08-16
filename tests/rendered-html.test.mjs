import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("requires explicit commitment terms during authentication", async () => {
  const [screen, register, login] = await Promise.all([
    readFile(new URL("../app/AuthScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(screen, /acceptedTerms/);
  assert.match(screen, /two LeetCode questions by 11:59 PM ET/);
  assert.match(screen, /\$10 charge for each other eligible member/);
  assert.match(register, /input\.acceptedTerms !== true/);
  assert.match(login, /input\.acceptedTerms !== true/);
});

test("stores screenshot proof and renders real daily progress", async () => {
  const [route, app, page] = await Promise.all([
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AccountabilityApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /env\.PROOFS\.put/);
  assert.match(route, /completedCount: currentCount \+ 1/);
  assert.match(route, /DAILY_REQUIRED/);
  assert.match(app, /Today’s progress is \$\{count\}\/2/);
  assert.match(app, /proof-grid/);
  assert.match(page, /problemSubmissions/);
  assert.match(page, /ownProgress/);
});
