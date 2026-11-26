import { expect, type Locator, type Page } from "@playwright/test";

/** Handles hosted Checkout's changing frame layout without stale Selenium frame references. */
export class StripePage {
  /** Uses a browser already navigated to a separately validated cs_test_ session. */
  constructor(readonly page: Page) {}

  /** Finds a visible field in any current frame, e.g. cc-number in a newly mounted payment iframe. */
  async field(selector: string): Promise<Locator> {
    let result: Locator | undefined;
    await expect(async () => {
      for (const frame of this.page.frames()) {
        for (const locator of await frame.locator(selector).all()) {
          if (await locator.isVisible()) { result = locator; return; }
        }
      }
      throw new Error("Stripe field is not visible yet.");
    }).toPass({ timeout: 30000, intervals: [250, 500, 1000] });
    return result!;
  }

  /** Fills only documented test-card data after the caller verifies Stripe session.livemode is false. */
  async fillCard(email: string) {
    const number = "input[name=number],input[name=cardNumber],input[autocomplete=cc-number],input[placeholder='Card number']";
    const control = await this.field(number + ",#payment-method-accordion-item-title-card,input[type=radio][value=card]");
    if (await control.evaluate(el => el.tagName !== "INPUT" || (el as HTMLInputElement).type === "radio")) await control.click();
    await (await this.field(number)).fill("4242424242424242");
    await (await this.field("input[name='exp-date'],input[name=cardExpiry],input[autocomplete=cc-exp]")).fill("1234");
    await (await this.field("input[name=cvc],input[name=cardCvc],input[autocomplete=cc-csc]")).fill("123");
    await (await this.field("input[name=cardholderName],input[name=billingName],input[autocomplete=cc-name]")).fill("UI Test User");
    for (const frame of this.page.frames()) {
      const input = frame.locator("input#email,input[name=email],input[autocomplete=email]").first();
      if (await input.isVisible() && await input.isEditable()) await input.fill(email);
    }
  }

  /** Submits once: retries may wait for navigation, but must never repeat the payment click. */
  async submit() {
    const button = await this.field("button[type=submit]");
    await expect(button).toBeEnabled();
    await button.click();
  }
}
