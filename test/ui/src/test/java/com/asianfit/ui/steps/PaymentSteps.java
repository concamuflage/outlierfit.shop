package com.asianfit.ui.steps;

import com.asianfit.ui.pages.CartPage;
import com.asianfit.ui.pages.CheckoutSuccessPage;
import com.asianfit.ui.pages.StripeCheckoutPage;
import com.asianfit.ui.utils.DriverFactory;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.time.Instant;
import org.testng.Assert;

public class PaymentSteps {
  private CartPage cartPage() {
    return new CartPage(DriverFactory.getDriver());
  }

  private StripeCheckoutPage stripeCheckoutPage() {
    return new StripeCheckoutPage(DriverFactory.getDriver());
  }

  private CheckoutSuccessPage checkoutSuccessPage() {
    return new CheckoutSuccessPage(DriverFactory.getDriver());
  }

  private String generatedStripeEmail() {
    return "stripe-ui-" + Instant.now().toEpochMilli() + "@example.com";
  }

  @When("I click checkout")
  public void iClickCheckout() {
    cartPage().clickCheckout();
    cartPage().waitForCheckoutDetails();
  }

  @When("I start Stripe Checkout payment")
  public void iStartStripeCheckoutPayment() {
    cartPage().startStripeCheckoutPayment();
  }

  @Then("I should be redirected to the Stripe Checkout page")
  public void iShouldBeRedirectedToTheStripeCheckoutPage() {
    Assert.assertTrue(stripeCheckoutPage().isVisible(), "Expected to be on the Stripe Checkout page");
  }

  @When("I choose the Stripe Card payment option")
  public void iChooseTheStripeCardPaymentOption() {
    stripeCheckoutPage().chooseCardPaymentOption();
  }

  @When("I pay with the Stripe test card {string}")
  public void iPayWithTheStripeTestCard(String cardNumber) {
    stripeCheckoutPage().enterCardNumber(cardNumber);
  }

  @When("I enter the Stripe expiration date {string}")
  public void iEnterTheStripeExpirationDate(String expirationDate) {
    stripeCheckoutPage().enterExpirationDate(expirationDate);
  }

  @When("I enter the Stripe security code {string}")
  public void iEnterTheStripeSecurityCode(String securityCode) {
    stripeCheckoutPage().enterSecurityCode(securityCode);
  }

  @When("I enter the Stripe cardholder name {string}")
  public void iEnterTheStripeCardholderName(String cardholderName) {
    stripeCheckoutPage().enterCardholderName(cardholderName);
  }

  @When("I enter a generated Stripe email address")
  public void iEnterAGeneratedStripeEmailAddress() {
    stripeCheckoutPage().enterEmail(generatedStripeEmail());
  }

  @When("I enter the Stripe billing ZIP code {string}")
  public void iEnterTheStripeBillingZipCode(String zipCode) {
    stripeCheckoutPage().enterZipCode(zipCode);
  }

  @When("I enter the Stripe phone number {string}")
  public void iEnterTheStripePhoneNumber(String phoneNumber) {
    stripeCheckoutPage().enterPhoneNumber(phoneNumber);
  }

  @When("I submit the Stripe payment")
  public void iSubmitTheStripePayment() {
    stripeCheckoutPage().submitPayment();
  }

  @Then("I should be redirected back to the checkout success page")
  public void iShouldBeRedirectedBackToTheCheckoutSuccessPage() {
    checkoutSuccessPage().waitForSuccessPage();
    Assert.assertTrue(checkoutSuccessPage().isVisible(), "Expected checkout success page to be visible");
  }

  @Then("I should see the invoice download link")
  public void iShouldSeeTheInvoiceDownloadLink() {
    checkoutSuccessPage().waitForConfirmationStateToDisappear();
    checkoutSuccessPage().waitForInvoiceLink();
  }
}
