package com.asianfit.ui.pages;

import java.net.URI;
import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.NoSuchFrameException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

/** Handles hosted Checkout layouts, e.g. card fields and the Pay button inside Stripe's payment iframe. */
public class StripeCheckoutPage extends BasePage {
  private static final String CARD_NUMBER_SELECTOR =
    "input[name='number'], input[autocomplete='cc-number'], input[placeholder='Card number']";
  private static final By CARD_NUMBER_INPUT = By.cssSelector(CARD_NUMBER_SELECTOR);
  private static final By EXPIRATION_INPUT = By.cssSelector(
    "input[name='exp-date'], input[autocomplete='cc-exp'], input[placeholder*='MM'], input[placeholder='MM / YY']"
  );
  private static final By CVC_INPUT = By.cssSelector(
    "input[name='cvc'], input[autocomplete='cc-csc'], input[placeholder='CVC'], input[placeholder='CVV']"
  );
  private static final By CARDHOLDER_NAME_INPUT = By.cssSelector(
    "input[name='cardholderName'], input[autocomplete='cc-name']"
  );
  private static final By EMAIL_INPUT = By.cssSelector("input#email, input[name='email'], input[autocomplete='email']");
  private static final By ZIP_INPUT = By.cssSelector(
    "input[name='postalCode'], input[autocomplete='postal-code'], input[placeholder='ZIP'], input[placeholder='Postal code']"
  );
  private static final By PHONE_INPUT = By.xpath("//input[@id='phoneNumber']");
  private static final By CARD_CONTROL = By.cssSelector(
    CARD_NUMBER_SELECTOR + ", #payment-method-accordion-item-title-card, input[type='radio'][value='card']"
  );
  private static final By PAY_BUTTON = By.xpath("//button[@type='submit']");
  private static final By BUSINESS_BACK_LINK = By.xpath("//a[@data-testid='business-link']");
  private static final By DECLINED_CARD_ERROR = By.xpath(
    "//*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'card was declined') " +
    "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'your card has been declined') " +
    "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'declined')]"
  );

  public StripeCheckoutPage(WebDriver driver) {
    super(driver);
  }

  public boolean isVisible() {
    try {
      return wait.until((ignored) -> {
        String url = currentUrl();
        return url.contains("checkout.stripe.com") || url.contains("pay.stripe.com");
      });
    } catch (Exception ignored) {
      return false;
    }
  }

  /** Waits up to 60 seconds for session creation and redirect, e.g. localhost/cart to checkout.stripe.com. */
  public void waitForCheckoutRedirect() {
    // Keep the timeout local to this network-dependent transition; never repeat the payment click.
    new WebDriverWait(driver, Duration.ofSeconds(60))
      .withMessage(() -> "Expected Stripe Checkout redirect within 60 seconds; current host: "
        + URI.create(currentUrl()).getHost()
        + ". Check checkout-session errors if the browser remains on the app.")
      // Match the actual host, not a local URL with a Stripe address in its query string.
      .until(ExpectedConditions.urlMatches("^https://(checkout|pay)\\.stripe\\.com(?:[/?#].*)?$"));
  }

  public void enterCardNumber(String value) {
    typeIntoField(CARD_NUMBER_INPUT, value);
  }

  public void enterExpirationDate(String value) {
    typeIntoField(EXPIRATION_INPUT, value);
  }

  public void enterSecurityCode(String value) {
    typeIntoField(CVC_INPUT, value);
  }

  public void enterCardholderName(String value) {
    typeIntoField(CARDHOLDER_NAME_INPUT, value);
  }

  public void enterEmail(String value) {
    typeIntoField(EMAIL_INPUT, value);
  }

  public void enterZipCode(String value) {
    typeIntoField(ZIP_INPUT, value);
  }

  public void enterPhoneNumber(String value) {
    WebElement field = wait.until(ExpectedConditions.presenceOfElementLocated(PHONE_INPUT));
    // ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView({block:'center'});", field);
    // // ((JavascriptExecutor) driver).executeScript("arguments[0].focus();", field);
    field.sendKeys(value);
  }

  /** Selects Card when needed, or accepts the already-open form, e.g. input[autocomplete='cc-number'] in an iframe. */
  public void chooseCardPaymentOption() {
    WebElement control = waitForCheckoutField(CARD_CONTROL);
    boolean cardFormAlreadyOpen = "cc-number".equals(control.getDomAttribute("autocomplete"))
      || "number".equals(control.getDomAttribute("name"))
      || "Card number".equals(control.getDomAttribute("placeholder"));
    if (!cardFormAlreadyOpen) {
      control.click();
      waitForCheckoutField(CARD_NUMBER_INPUT);
    }
  }

  /** Clicks the enabled submit button in its owning frame, e.g. Pay inside a nested checkout iframe. */
  public void submitPayment() {
    // Checkout may frame the submit button along with the card fields; retain that frame for the click.
    WebElement payButton = waitForCheckoutField(PAY_BUTTON);
    ((JavascriptExecutor) driver).executeScript(
      "const r = arguments[0].getBoundingClientRect();" +
      "window.scrollBy({ top: r.top - (window.innerHeight / 2) + (r.height / 2), behavior: 'instant' });",
      payButton
    );
    payButton.click();
  }

  public void cancelCheckout() {
    driver.switchTo().defaultContent();
    driver.navigate().back();
  }

  public void cancelCheckoutThroughBusinessBackLink() {
    driver.switchTo().defaultContent();
    WebElement backLink = wait.until(ExpectedConditions.elementToBeClickable(BUSINESS_BACK_LINK));
    ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView({block:'center'});", backLink);
    backLink.click();
  }

  public boolean showsDeclinedCardError() {
    try {
      return wait.until(ExpectedConditions.visibilityOfElementLocated(DECLINED_CARD_ERROR)).isDisplayed();
    } catch (Exception ignored) {
      return false;
    }
  }

  /** Finds and fills the field in its owning frame, e.g. number and expiry can share a nested payment iframe. */
  private void typeIntoField(By locator, String value) {
    WebElement field = waitForCheckoutField(locator);
    ((JavascriptExecutor) driver).executeScript("arguments[0].focus();", field);
    field.sendKeys(value);
  }

  /** Searches from the top on each retry so iframe rerenders do not leave a stale browsing context. */
  private WebElement waitForCheckoutField(By locator) {
    Duration implicitWait = driver.manage().timeouts().getImplicitWaitTimeout();
    // Empty lookups must not each consume the global implicit wait across Stripe's many frames.
    driver.manage().timeouts().implicitlyWait(Duration.ZERO);
    try {
      return wait.until(ignored -> {
        driver.switchTo().defaultContent();
        try {
          return findCheckoutFieldInFrames(locator);
        } catch (StaleElementReferenceException | NoSuchFrameException transientFrameChange) {
          return null;
        }
      });
    } finally {
      driver.manage().timeouts().implicitlyWait(implicitWait);
    }
  }

  /** Recursively finds a usable control and stays in its frame; e.g. nested cc-number fields remain typeable. */
  private WebElement findCheckoutFieldInFrames(By locator) {
    for (WebElement field : driver.findElements(locator)) {
      if (field.isDisplayed() && field.isEnabled()) return field;
    }
    for (WebElement frame : driver.findElements(By.cssSelector("iframe, frame"))) {
      driver.switchTo().frame(frame);
      WebElement field = findCheckoutFieldInFrames(locator);
      if (field != null) return field;
      driver.switchTo().parentFrame();
    }
    return null;
  }
}
