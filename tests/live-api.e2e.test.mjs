import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.E2E_BASE_URL;
if (!base) throw new Error("Set E2E_BASE_URL to the deployed application URL.");
async function request(path, init) { return fetch(new URL(path, base), init); }

test("public application renders", async () => { assert.equal((await request("/")).status, 200); });
test("authentication validates bad credentials and invalid registration", async () => {
  const login = await request("/api/auth/login", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({email:"e2e-invalid@example.com",password:"incorrect",acceptedTerms:true}) });
  assert.equal(login.status, 401);
  const registration = await request("/api/auth/register", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({name:"",email:"bad",password:"x",acceptedTerms:false}) });
  assert.equal(registration.status, 400);
});
test("protected write routes reject anonymous callers", async () => {
  for (const [path, method] of [["/api/waivers","POST"],["/api/payments/setup-intent","POST"],["/api/admin/members/not-a-user","DELETE"]]) {
    const response = await request(path, { method, headers:{"content-type":"application/json"}, body:method==="POST"?"{}":undefined });
    assert.ok([401,403].includes(response.status), `${method} ${path} returned ${response.status}`);
  }
});
test("Resend webhook rejects an unsigned event", async () => {
  const response = await request("/api/webhooks/resend", { method:"POST", headers:{"content-type":"application/json"}, body:"{}" });
  assert.ok([400,503].includes(response.status));
});
