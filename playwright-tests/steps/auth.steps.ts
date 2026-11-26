import { Given, When, Then, Before } from "../support/bdd";
import { expect } from "../support/fixtures";
import { envValue } from "../support/testEnv";
import { signup, login, verify, followMail, assertSender } from "../support/authFlows";
import { findMail } from "../support/gmailVerificationClient";
import { SignupPage } from "../pages/SignupPage";

/** Keeps feature discovery complete while explicitly skipping external services unless opted in. */
Before(async ({ $tags, $testInfo, baseURL }) => {
  $testInfo.skip($tags.includes("@mail") && envValue("RUN_MAIL_TESTS") !== "1", "Requires RUN_MAIL_TESTS=1.");
  $testInfo.skip($tags.includes("@payment") && envValue("RUN_PAYMENT_TESTS") !== "1", "Requires RUN_PAYMENT_TESTS=1.");
  $testInfo.skip($tags.includes("@dev-only") && (envValue("RUN_MOCK_PAYMENT_TESTS") !== "1" || new URL(baseURL!).hostname === "staging.outlierfit.shop"), "Requires a local dev app and RUN_MOCK_PAYMENT_TESTS=1.");
  if ($tags.includes("@payment")) $testInfo.setTimeout(300000);
  else if ($tags.includes("@mail")) $testInfo.setTimeout(240000);
});

/** Opens an actual app route; e.g. /signup before a registration scenario. */
Given("I open the {word} page", async ({ page }, name: string) => {
  expect(["signup", "login", "products"]).toContain(name);
  await page.goto(`/${name}`);
});

/** Registers through the UI after recording ownership, so failed signup tests still clean their account. */
When("I sign up with a unique email and password {string}", async ({ page, sandbox, state }, value: string) => {
  state.email = sandbox.email(true); state.password = value; state.registeredAt = Date.now();
  await signup(page, state.email, value);
});

/** Confirms the same successful registration message as Java before relying on any delivered mail. */
Then("signup should ask me to verify my email", async ({ page }) => {
  await expect(page.locator("#signup-success")).toHaveText("Check your email to verify your account before signing in.");
});

/** Uses the same owned address again, preserving the duplicate-registration UI path. */
When("I sign up again with the same email", async ({ page, state }) => { await signup(page, state.email, state.password); });

/** Exercises each invalid-password outline row without issuing an outbound signup request. */
When("I sign up using invalid password {string}", async ({ page, sandbox }, value: string) => { await signup(page, sandbox.email(), value); });

/** Keeps duplicate-account errors distinct from silent successful registration. */
Then("signup should show a validation error", async ({ page }) => {
  await expect(page.locator("#signup-error")).toBeVisible();
  await expect(page.locator("#signup-error")).not.toHaveText("");
});

/** Checks the password requirements shown by all five outline examples. */
Then("signup should show the password requirements", async ({ page }) => { await expect(page.locator("#signup-error")).toContainText(/12|uppercase|lowercase|digit/i); });

/** Submits the existing standalone login form, including deliberate wrong-password attempts. */
When("I log in with the generated email and password {string}", async ({ page, state }, value: string) => { await login(page, state.email, value); });

/** Asserts verification and password failures without accepting a successful redirect. */
Then("login should fail because of {string}", async ({ page }, reason: string) => {
  await expect(page.locator("#login-error")).toContainText(reason === "verification" ? /verify your email/i : /Invalid credentials/i);
});

/** Checks both products navigation and its All filter after a verified login. */
Then("I should be authenticated on the products page", async ({ page }) => {
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByTestId("products-filter-all")).toBeVisible();
});

/** Verifies delivered mail, excluding a recorded superseded link after resend; no token is read from the database. */
When("I verify the generated email through the delivered message", async ({ page, state }) => {
  const superseded = state.verification ? [state.verification.link] : [];
  state.verification = await verify(page, state.email, state.registeredAt, superseded);
});

/** Records the unopened original link, confirms resend succeeds, then permits only a different delivered verification link. */
When("I request a new verification email", async ({ page, state }) => {
  // Timestamp filtering alone is insufficient: both deliveries can fall inside Gmail's two-second tolerance.
  state.verification = await findMail(state.email, "verification", state.registeredAt);
  assertSender(state.verification);
  state.registeredAt = Date.now();
  const response = page.waitForResponse(result => new URL(result.url()).pathname === "/api/store/auth/resend-verification" && result.request().method() === "POST");
  const [, resent] = await Promise.all([new SignupPage(page).resendVerificationEmail(), response]);
  expect(resent.status()).toBe(200);
  await expect(page.locator("#signup-success")).toHaveText("Verification email sent.");
});

/** Retains the original link without consuming it for the unverified-password-reset scenario. */
When("I keep the original verification message without opening its link", async ({ state }) => {
  state.verification = await findMail(state.email, "verification", state.registeredAt);
  assertSender(state.verification);
});

/** Requests reset via the Forgot password UI, preserving its confirmation text and recipient. */
When("I request a password reset for the generated email", async ({ page, state }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset password", exact: true })).toBeVisible();
  await page.locator("#forgot-password-email").fill(state.email);
  state.resetAt = Date.now();
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If that account exists, a password reset email has been sent/i)).toBeVisible();
});

/** Polls for the actual reset email and opens only a link belonging to the app under test. */
When("I open the delivered password reset link", async ({ page, state }) => {
  state.reset = await findMail(state.email, "reset", state.resetAt);
  assertSender(state.reset);
  await followMail(page, state.reset.link, "/reset-password");
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
});

/** Fills both password fields and verifies the reset completion link before a new login. */
When("I reset and confirm the password as {string}", async ({ page }, value: string) => {
  await page.locator("#reset-password").fill(value);
  await page.locator("#reset-password-confirm").fill(value);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("link", { name: "Go to sign in" })).toBeVisible();
});

/** Reuses the original verification URL to assert reset also verified the formerly unverified account. */
Then("the original verification link should say the email is already verified", async ({ page, state }) => {
  await followMail(page, state.verification!.link, "/verify-email");
  await expect(page.getByText("Your email is already verified. You can sign in.", { exact: true })).toBeVisible();
});

/** Opens the header modal on a guest page, not the standalone login route. */
When("I open the login modal", async ({ page }) => { await page.getByRole("button", { name: "Sign in", exact: true }).click(); });

/** Checks modal heading visibility without assuming missing dialog roles in the current app. */
Then("the {word} modal should be visible", async ({ page }, kind: string) => {
  await expect(page.getByRole("heading", { name: kind === "login" ? "Welcome back" : "Create your account" })).toBeVisible();
});

/** Switches modes while leaving the auth overlay open. */
When("I switch to the signup modal", async ({ page }) => { await page.getByRole("button", { name: "Create an account", exact: true }).click(); });

/** Closes the overlay using its existing accessible Close button. */
When("I close the auth modal", async ({ page }) => { await page.getByRole("button", { name: "Close", exact: true }).click(); });

/** Asserts neither modal remains visible after closing. */
Then("the auth modal should be closed", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeHidden();
});
