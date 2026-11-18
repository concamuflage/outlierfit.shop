package com.asianfit.ui.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchFrameException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

/** Checks the app's top-level confirmation page after payment, e.g. /checkout/success with an invoice link. */
public class CheckoutSuccessPage extends BasePage {
  private static final By TITLE = By.xpath("//h1[normalize-space()='Thank you for your order.']");
  private static final By CONFIRMING_BANNER = By.xpath("//*[normalize-space()='Confirming payment']");
  private static final By INVOICE_LINK = By.xpath("//a[normalize-space()='Download invoice PDF']");

  public CheckoutSuccessPage(WebDriver driver) {
    super(driver);
  }

  /** Checks the app document rather than a previous Stripe iframe for the confirmation heading. */
  public boolean isVisible() {
    driver.switchTo().defaultContent();
    return waitForUrlContains("/checkout/success") && count(TITLE) > 0;
  }

  /** Waits for the return URL and heading together, e.g. Stripe's payment iframe to the app confirmation. */
  public void waitForSuccessPage() {
    new WebDriverWait(driver, Duration.ofSeconds(60))
      .withMessage("Expected /checkout/success and the order confirmation heading within 60 seconds")
      .until(ignored -> {
        try {
          // Payment clicks can leave Selenium inside a Stripe iframe that disappears during redirect.
          driver.switchTo().defaultContent();
          return currentUrl().contains("/checkout/success")
            && ExpectedConditions.visibilityOfElementLocated(TITLE).apply(driver) != null;
        } catch (NoSuchFrameException | StaleElementReferenceException redirectInProgress) {
          return false;
        }
      });
  }

  public void refresh() {
    driver.navigate().refresh();
    waitForSuccessPage();
  }

  public void waitForInvoiceLink() {
    waitForVisible(INVOICE_LINK);
  }

  public String invoiceLinkHref() {
    return waitForVisible(INVOICE_LINK).getAttribute("href");
  }

  public void waitForConfirmationStateToDisappear() {
    wait.until((ignored) -> count(CONFIRMING_BANNER) == 0);
  }
}
