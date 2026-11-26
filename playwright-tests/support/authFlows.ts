import { expect, type Page } from "@playwright/test";
import { SignupPage } from "../pages/SignupPage";
import { LoginPage } from "../pages/LoginPage";
import { findMail, type DeliveredMail } from "./gmailVerificationClient";
import { expectedResendFromEmail } from "./testEnv";
import { password } from "./sandbox";

/** Waits for client session initialization before signup, preventing native GET submission before hydration. */
export async function signup(page: Page, email: string, value = password) {
  const form = new SignupPage(page);
  const ready = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/session" && response.status() === 200);
  await Promise.all([form.goto(), ready]);
  await expect(form.heading).toBeVisible();
  await form.signup({ email, password: value, firstName: "PW", lastName: "Tester" });
  return form;
}

/** Waits for the hydrated session provider before login; wrong passwords still require an actual UI error. */
export async function login(page: Page, email: string, value = password) {
  const form = new LoginPage(page);
  const ready = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/session" && response.status() === 200);
  await Promise.all([form.goto(), ready]);
  await expect(form.heading).toBeVisible();
  await form.login(email, value);
  return form;
}

/** Checks the actual sender mailbox rather than a display-name/encoded-header formatting coincidence. */
export function assertSender(mail: DeliveredMail) {
  const sender = expectedResendFromEmail().match(/<([^>]+)>/)?.[1] ?? expectedResendFromEmail();
  expect(mail.from.toLowerCase()).toContain(sender.toLowerCase());
}

/** Follows only a delivered link for this app's exact origin; a wrong-environment mail must fail. */
export async function followMail(page: Page, link: string, path: string) {
  const target = new URL(link);
  expect(target.origin).toBe(new URL(page.url()).origin);
  expect(target.pathname).toBe(path);
  await page.goto(target.href);
}

/** Verifies through delivered Gmail; after resend, explicitly skips the original link even if both emails share a timestamp. */
export async function verify(page: Page, email: string, after: number, excludedLinks: readonly string[] = []) {
  const mail = await findMail(email, "verification", after, excludedLinks);
  assertSender(mail);
  await followMail(page, mail.link, "/verify-email");
  await expect(page.getByRole("heading", { name: "Email verified", exact: true })).toBeVisible();
  return mail;
}
