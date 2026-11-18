package com.asianfit.ui.pages;

import com.asianfit.ui.utils.DriverFactory;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicInteger;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

/** Exercises local redirect, card, and submit fixtures without payments; one shared browser requires serial methods. */
@Test(singleThreaded = true)
public class StripeCheckoutPageTest {
  private WebDriver driver;

  /** Opens one headless test browser using the existing driver configuration. */
  @BeforeClass
  public void setUp() {
    DriverFactory.createDriver();
    driver = DriverFactory.getDriver();
  }

  /** Closes the fixture browser even when a selector assertion fails. */
  @AfterClass(alwaysRun = true)
  public void tearDown() {
    DriverFactory.quitDriver();
  }

  /** Checks the observed Stripe layout, e.g. no Card radio exists but number, expiry, and CVC inputs are in a frame. */
  @Test
  public void acceptsAnExpandedCardFormInNestedFrames() {
    openFixture(frame(frame("<input name='number' autocomplete='cc-number'>"
      + "<input name='expiry' autocomplete='cc-exp'><input name='cvc' autocomplete='cc-csc'>")));
    StripeCheckoutPage page = new StripeCheckoutPage(driver);
    page.chooseCardPaymentOption();
    page.enterCardNumber("1234");
    page.enterExpirationDate("1234");
    page.enterSecurityCode("123");
    Assert.assertEquals(driver.findElement(By.name("cvc")).getDomProperty("value"), "123");
    Assert.assertEquals(driver.findElement(By.name("number")).getDomProperty("value"), "1234");
  }

  /** Supports selectable layouts too, e.g. the old Card ID belongs to a button rather than an input. */
  @Test
  public void expandsCardOptionBeforeTyping() {
    openFixture("<button id='payment-method-accordion-item-title-card' "
      + "onclick=\"document.getElementById('form').style.display='block'\">Card</button>"
      + "<div id='form' style='display:none'><input name='number' autocomplete='cc-number'></div>");
    StripeCheckoutPage page = new StripeCheckoutPage(driver);
    page.chooseCardPaymentOption();
    page.enterCardNumber("1234");
    Assert.assertEquals(driver.findElement(By.name("number")).getDomProperty("value"), "1234");
  }

  /** Finds Pay in nested frames even after a field leaves the driver in a different frame. */
  @Test
  public void submitsPaymentInNestedFrames() {
    openFixture(frame("<input name='number' autocomplete='cc-number'>")
      + frame(frame("<button type='submit' disabled>Unavailable</button>"
        + "<button type='submit' id='pay' onclick=\"this.textContent='Submitted'\">Pay</button>")));
    StripeCheckoutPage page = new StripeCheckoutPage(driver);
    page.enterCardNumber("1234");
    page.submitPayment();
    Assert.assertEquals(driver.findElement(By.id("pay")).getText(), "Submitted");
  }

  /** Preserves unframed Checkout support, e.g. a top-level Pay button changes to Submitted on click. */
  @Test
  public void submitsPaymentAtTopLevel() {
    openFixture("<button type='submit' id='pay' onclick=\"this.textContent='Submitted'\">Pay</button>");
    new StripeCheckoutPage(driver).submitPayment();
    Assert.assertEquals(driver.findElement(By.id("pay")).getText(), "Submitted");
  }

  /** Polls past local URLs, including a Stripe URL in a query, until the actual checkout host is reached. */
  @Test
  public void waitsForActualCheckoutRedirect() {
    String[] urls = {
      "http://localhost:3000/cart?next=https://checkout.stripe.com",
      "http://localhost:3000/cart?checkout=1",
      "https://checkout.stripe.com/c/pay/test-fixture"
    };
    AtomicInteger reads = new AtomicInteger();
    // Only URL reads are simulated; this fixture cannot create a Checkout session or submit payment.
    WebDriver redirectDriver = (WebDriver) Proxy.newProxyInstance(
      WebDriver.class.getClassLoader(), new Class<?>[] { WebDriver.class },
      (proxy, method, args) -> {
        if ("getCurrentUrl".equals(method.getName())) {
          return urls[Math.min(reads.getAndIncrement(), urls.length - 1)];
        }
        throw new UnsupportedOperationException(method.getName());
      });
    new StripeCheckoutPage(redirectDriver).waitForCheckoutRedirect();
    Assert.assertTrue(reads.get() >= 3, "Must wait for the real Stripe host, not a query-string match");
  }

  /** Loads a local HTML document, e.g. a selectable card button with no requests to Stripe. */
  private void openFixture(String html) {
    driver.get("data:text/html;base64," + Base64.getEncoder().encodeToString(html.getBytes(StandardCharsets.UTF_8)));
  }

  /** Wraps HTML in a frame safely, e.g. calling frame(frame(input)) tests recursive frame traversal. */
  private String frame(String html) {
    return "<iframe style='width:700px;height:400px' srcdoc=\""
      + html.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;")
      + "\"></iframe>";
  }
}
