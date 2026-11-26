import type { APIResponse } from "@playwright/test";
import type Stripe from "stripe";
import { createBdd } from "playwright-bdd";
import { test as base } from "./fixtures";
import { password, type Account, type Product } from "./sandbox";
import type { DeliveredMail } from "./gmailVerificationClient";

export type ScenarioState = {
  email: string; password: string; registeredAt: number; resetAt: number; category: string; subtotal: number;
  account?: Account; product?: Product; second?: Product; shipping?: number; billing?: number;
  expectedItems?: { id: string; qty: number }[];
  verification?: DeliveredMail; reset?: DeliveredMail; invoiceMail?: DeliveredMail;
  response?: APIResponse; order?: { id: number; invoiceNumber: string }; invoice?: object;
  stripe?: Stripe; checkout?: Stripe.Checkout.Session; invoiceLink?: string;
};

export const test = base.extend<{ state: ScenarioState }>({
  /** Shares state only within one Gherkin scenario, e.g. its generated email and expected order total. */
  state: async ({}, provide) => { await provide({ email: "", password, registeredAt: 0, resetAt: 0, category: "Shirts", subtotal: 0 }); },
});

export const { Given, When, Then, Before } = createBdd(test);
