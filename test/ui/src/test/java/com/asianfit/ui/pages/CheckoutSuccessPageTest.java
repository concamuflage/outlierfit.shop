package com.asianfit.ui.pages;

import com.asianfit.ui.utils.DriverFactory;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

/** Checks confirmation-page frame recovery using local HTML, with no requests or payments to Stripe. */
@Test(singleThreaded = true)
public class CheckoutSuccessPageTest {
  private WebDriver driver;

  /** Opens a browser using the suite's configured headless setting. */
  @BeforeClass
  public void setUp() {
    DriverFactory.createDriver();
    driver = DriverFactory.getDriver();
  }

  /** Closes the fixture browser even after an assertion failure. */
  @AfterClass(alwaysRun = true)
  public void tearDown() {
    DriverFactory.quitDriver();
  }

  /** Finds the heading and invoice outside a selected iframe, reproducing the post-payment context. */
  @Test
  public void returnsToTopLevelBeforeCheckingConfirmation() {
    String html = "<h1>Thank you for your order.</h1>"
      + "<a href='/invoice.pdf'>Download invoice PDF</a><iframe srcdoc='<p>Payment frame</p>'></iframe>";
    // The fragment supplies the expected URL marker without running an app or creating an order.
    driver.get("data:text/html;base64,"
      + Base64.getEncoder().encodeToString(html.getBytes(StandardCharsets.UTF_8)) + "#/checkout/success");
    driver.switchTo().frame(driver.findElement(By.tagName("iframe")));
    CheckoutSuccessPage page = new CheckoutSuccessPage(driver);
    page.waitForSuccessPage();
    Assert.assertTrue(page.isVisible());
    page.waitForInvoiceLink();
    Assert.assertTrue(page.invoiceLinkHref().endsWith("/invoice.pdf"));
  }
}
