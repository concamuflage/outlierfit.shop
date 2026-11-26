import { expect, type Frame, type Locator, type Page } from "@playwright/test";

/** Handles hosted Checkout's changing frame layout, including the collapsed Card button inside its iframe. */
export class StripePage {
  /** Uses a browser already navigated to a separately validated cs_test_ session. */
  constructor(readonly page: Page) {}

  /** Finds a visible control across current frames, e.g. a cc-number selector or an exact Card button locator. */
  async field(selector: string | ((frame: Frame) => Locator)): Promise<Locator> {
    let result: Locator | undefined;
    await expect(async () => {
      for (const frame of this.page.frames()) {
        const candidates = typeof selector === "string" ? frame.locator(selector) : selector(frame);
        for (const locator of await candidates.all()) {
          if (await locator.isVisible()) { result = locator; return; }
        }
      }
      throw new Error("Stripe field is not visible yet.");
    }).toPass({ timeout: 30000, intervals: [250, 500, 1000] });
    return result!;
  }

  /** Opens Card when collapsed, then fills 4242424242424242 only after the caller verifies test mode. */
  async fillCard(email: string) {
    const number = "input[name=number],input[name=cardNumber],input[autocomplete=cc-number],input[placeholder='Card number']";
    // Hosted Checkout now exposes Card as a button; retain older radio/accordion and already-open forms.
    /** Resolves the exact Card button as well as legacy controls within each newly mounted frame. */
    const cardControls = (frame: Frame) => frame.getByRole("button", { name: "Card", exact: true })
      .or(frame.locator(number + ",#payment-method-accordion-item-title-card,input[type=radio][value=card]"));
    const control = await this.field(cardControls);
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
