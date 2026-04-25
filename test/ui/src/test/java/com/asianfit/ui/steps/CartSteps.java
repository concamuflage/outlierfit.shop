package com.asianfit.ui.steps;

import com.asianfit.ui.pages.CartPage;
import com.asianfit.ui.pages.CartDrawer;
import com.asianfit.ui.pages.LoginPage;
import com.asianfit.ui.pages.HomePage;
import com.asianfit.ui.pages.ProductDetailPage;
import com.asianfit.ui.pages.ProductsPage;
import com.asianfit.ui.pages.SignupPage;
import com.asianfit.ui.utils.DriverFactory;
import com.asianfit.ui.utils.TestConfig;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.ArrayList;
import java.util.List;
import org.testng.Assert;

public class CartSteps {
  private static final String PASSWORD_REQUIREMENTS_MESSAGE =
    "Password must be at least 12 characters and include uppercase, lowercase, a number, a special character, and no spaces.";
  private static final String SIGNUP_SUCCESS_MESSAGE =
    "Check your email to verify your account before signing in.";
  private static final String EMAIL_NOT_VERIFIED_MESSAGE =
    "Please verify your email before signing in.";
  private static final String GENERATED_SIGNUP_PASSWORD = "StrongPass123A!";

  private String rememberedSubtotal;
  private String generatedSignupEmail;
  private double rememberedTotalProductPriceUsd;
  private double rememberedTotalProductWeightKg;
  private final List<Double> addedProductPricesUsd = new ArrayList<>();
  private final List<Double> addedProductWeightsKg = new ArrayList<>();

  private ProductsPage productsPage() {
    return new ProductsPage(DriverFactory.getDriver());
  }

  private HomePage homePage() {
    return new HomePage(DriverFactory.getDriver());
  }

  private ProductDetailPage productDetailPage() {
    return new ProductDetailPage(DriverFactory.getDriver());
  }

  private CartDrawer cartDrawer() {
    return new CartDrawer(DriverFactory.getDriver());
  }

  private LoginPage loginPage() {
    return new LoginPage(DriverFactory.getDriver());
  }

  private CartPage cartPage() {
    return new CartPage(DriverFactory.getDriver());
  }

  private SignupPage signupPage() {
    return new SignupPage(DriverFactory.getDriver());
  }

  @Given("I open the products page")
  public void iOpenTheProductsPage() {
    productsPage().open();
  }

  @Given("I open the home page")
  public void iOpenTheHomePage() {
    homePage().open();
  }

  @Given("I open the protected cart page")
  public void iOpenTheProtectedCartPage() {
    productsPage().openProtectedCartPage();
  }

  @Given("I open the login page")
  public void iOpenTheLoginPage() {
    DriverFactory.getDriver().get(TestConfig.baseUrl() + "/login");
  }

  @Given("I open the signup page")
  public void iOpenTheSignupPage() {
    signupPage().open();
  }

  @When("I open the first product from the grid")
  public void iOpenTheFirstProductFromTheGrid() {
    productsPage().openFirstProduct();
  }

  @When("click on the first product")
  public void clickOnTheFirstProduct() {
    productsPage().openFirstProduct();
  }

  @When("I open the login modal")
  public void iOpenTheLoginModal() {
    homePage().openLoginModal();
  }

  @When("I switch to the signup modal")
  public void iSwitchToTheSignupModal() {
    homePage().switchLoginModalToSignupModal();
  }

  @When("I close the auth modal")
  public void iCloseTheAuthModal() {
    homePage().closeModal();
  }

  @When("I add the product to the cart")
  public void iAddTheProductToTheCart() {
    double priceUsd = productDetailPage().priceUsd();
    double weightKg = productDetailPage().weightKg();
    rememberedTotalProductPriceUsd += priceUsd;
    rememberedTotalProductWeightKg += weightKg;
    addedProductPricesUsd.add(priceUsd);
    addedProductWeightsKg.add(weightKg);
    productDetailPage().addToCart();
  }

  @When("I click on the {string} filter")
  public void iClickOnTheFilter(String filterName) {
    productsPage().selectFilter(filterName);
  }

  @When("I go to the products page")
  public void iGoToTheProductsPage() {
    productsPage().open();
  }

  @When("I go to the cart page")
  public void iGoToTheCartPage() {
    cartPage().open();
  }

  @When("I open the cart drawer")
  public void iOpenTheCartDrawer() {
    cartDrawer().open();
  }

  @Then("the cart drawer should be visible")
  public void theCartDrawerShouldBeVisible() {
    Assert.assertTrue(cartDrawer().isVisible(), "Cart drawer should be visible");
  }

  @Then("the cart should show the correct total weight of the products")
  public void theCartShouldShowTheCorrectTotalWeightOfTheProducts() {
    Assert.assertEquals(cartPage().clothesWeightKg(), rememberedTotalProductWeightKg, 0.001);
  }

  @Then("the cart should show the correct total weight and price of the products")
  public void theCartShouldShowTheCorrectTotalWeightAndPriceOfTheProducts() {
    Assert.assertEquals(cartPage().clothesWeightKg(), rememberedTotalProductWeightKg, 0.001);
    Assert.assertEquals(cartPage().subtotalUsd(), rememberedTotalProductPriceUsd, 0.01);
  }

  @Then("the cart should show the correct total weight with carton box and shipping cost")
  public void theCartShouldShowTheCorrectTotalWeightWithCartonBoxAndShippingCost() {
    ExpectedCartTotals totals = expectedCartTotals();

    Assert.assertEquals(cartPage().boxWeightKg(), totals.boxWeightKg(), 0.001);
    Assert.assertEquals(cartPage().shipmentWeightKg(), totals.shipmentWeightKg(), 0.001);
    Assert.assertEquals(cartPage().shippingUsd(), totals.shippingUsd(), 0.01);
  }

  @Then("the cart should show the correct total price with shipping cost")
  public void theCartShouldShowTheCorrectTotalPriceWithShippingCost() {
    ExpectedCartTotals totals = expectedCartTotals();

    Assert.assertEquals(
      cartPage().orderTotalUsd(),
      totals.orderTotalUsd(),
      0.01
    );
  }

  @Then("the cart should still show the correct total price with shipping cost")
  public void theCartShouldStillShowTheCorrectTotalPriceWithShippingCost() {
    theCartShouldShowTheCorrectTotalPriceWithShippingCost();
  }

  @Then("I should see the essential order details")
  public void iShouldSeeTheEssentialOrderDetails() {
    Assert.assertTrue(cartPage().hasCheckoutDetails(), "Expected essential order details to be visible");
  }

  @Then("the login modal should be visible")
  public void theLoginModalShouldBeVisible() {
    Assert.assertTrue(homePage().isLoginModalVisible(), "Expected login modal to be visible");
  }

  @Then("the signup modal should be visible")
  public void theSignupModalShouldBeVisible() {
    Assert.assertTrue(homePage().isSignupModalVisible(), "Expected signup modal to be visible");
  }

  @Then("the auth modal should be closed")
  public void theAuthModalShouldBeClosed() {
    Assert.assertTrue(homePage().isModalClosed(), "Expected auth modal to be closed");
  }

  @Then("the cart drawer should contain at least {int} item")
  public void theCartDrawerShouldContainAtLeastItem(Integer minimumCount) {
    Assert.assertTrue(
      cartDrawer().itemCount() >= minimumCount,
      "Expected at least " + minimumCount + " cart item(s)"
    );
  }

  @Then("the cart drawer should contain {int} items")
  public void theCartDrawerShouldContainItems(Integer expectedCount) {
    Assert.assertEquals(cartDrawer().itemCount(), expectedCount.intValue());
  }

  @When("I increase the quantity of the first cart item")
  public void iIncreaseTheQuantityOfTheFirstCartItem() {
    rememberedTotalProductPriceUsd += addedProductPricesUsd.get(0);
    rememberedTotalProductWeightKg += addedProductWeightsKg.get(0);
    cartPage().increaseFirstItemQuantity();
  }

  @When("I increase the quantity of the second cart item")
  public void iIncreaseTheQuantityOfTheSecondCartItem() {
    rememberedTotalProductPriceUsd += addedProductPricesUsd.get(1);
    rememberedTotalProductWeightKg += addedProductWeightsKg.get(1);
    cartPage().increaseSecondItemQuantity();
  }

  @When("I choose the second shipping option")
  public void iChooseTheSecondShippingOption() {
    cartPage().selectSecondShippingOption();
  }

  @When("I choose the second shipping option in the cart drawer")
  public void iChooseTheSecondShippingOptionInTheCartDrawer() {
    cartDrawer().selectSecondShippingOption();
  }

  @When("I increase the quantity of the first cart drawer item")
  public void iIncreaseTheQuantityOfTheFirstCartDrawerItem() {
    rememberedTotalProductPriceUsd += addedProductPricesUsd.get(0);
    rememberedTotalProductWeightKg += addedProductWeightsKg.get(0);
    cartDrawer().increaseFirstItemQuantity();
  }

  @Then("the cart page should show the second shipping option as selected")
  public void theCartPageShouldShowTheSecondShippingOptionAsSelected() {
    Assert.assertTrue(
      cartPage().isSecondShippingOptionSelected(),
      "Expected the second shipping option to be selected on the cart page"
    );
  }

  @Then("the cart drawer should show the second shipping option as selected")
  public void theCartDrawerShouldShowTheSecondShippingOptionAsSelected() {
    Assert.assertTrue(
      cartDrawer().isSecondShippingOptionSelected(),
      "Expected the second shipping option to be selected in the cart drawer"
    );
  }

  @Then("the cart page should display the same items and quantities as the cart drawer")
  public void theCartPageShouldDisplayTheSameItemsAndQuantitiesAsTheCartDrawer() {
    cartDrawer().open();
    Assert.assertEquals(
      cartPage().itemQuantitiesById(),
      cartDrawer().itemQuantitiesById(),
      "Expected the cart page to show the same item ids and quantities as the cart drawer"
    );
  }

  @Then("the cart page should display the same shipping cost and total price as the cart drawer")
  public void theCartPageShouldDisplayTheSameShippingCostAndTotalPriceAsTheCartDrawer() {
    cartDrawer().open();
    Assert.assertEquals(cartPage().shippingUsd(), cartDrawer().shippingUsd(), 0.01);
    Assert.assertEquals(cartPage().orderTotalUsd(), cartDrawer().orderTotalUsd(), 0.01);
  }

  @Then("the cart drawer should display the same items and quantities as the cart page")
  public void theCartDrawerShouldDisplayTheSameItemsAndQuantitiesAsTheCartPage() {
    Assert.assertEquals(
      cartDrawer().itemQuantitiesById(),
      cartPage().itemQuantitiesById(),
      "Expected the cart drawer to show the same item ids and quantities as the cart page"
    );
  }

  @Then("the cart drawer should display the same shipping cost and total price as the cart page")
  public void theCartDrawerShouldDisplayTheSameShippingCostAndTotalPriceAsTheCartCartPage() {
    Assert.assertEquals(cartDrawer().shippingUsd(), cartPage().shippingUsd(), 0.01);
    Assert.assertEquals(cartDrawer().orderTotalUsd(), cartPage().orderTotalUsd(), 0.01);
  }

  @Then("the first cart item quantity should be {int}")
  public void theFirstCartItemQuantityShouldBe(Integer quantity) {
    Assert.assertEquals(cartDrawer().firstItemQuantity(), String.valueOf(quantity));
  }

  @When("I remove the first cart item")
  public void iRemoveTheFirstCartItem() {
    cartDrawer().removeFirstItem();
  }

  @When("I clear the cart drawer")
  public void iClearTheCartDrawer() {
    cartDrawer().clearCart();
  }

  @When("I note the cart drawer subtotal")
  public void iNoteTheCartDrawerSubtotal() {
    rememberedSubtotal = cartDrawer().subtotal();
  }

  @Then("the cart drawer subtotal should change")
  public void theCartDrawerSubtotalShouldChange() {
    Assert.assertNotNull(rememberedSubtotal, "Subtotal should have been remembered");
    Assert.assertNotEquals(cartDrawer().subtotal(), rememberedSubtotal);
  }

  @Then("I should be on the login page")
  public void iShouldBeOnTheLoginPage() {
    Assert.assertTrue(loginPage().isVisible(), "Expected login page to be visible");
  }

  @When("I sign in with the configured test account")
  public void iSignInWithTheConfiguredTestAccount() {
    loginPage().signIn(TestConfig.testUserEmail(), TestConfig.testUserPassword());
  }

  @When("I sign in with the unverified test account")
  public void iSignInWithTheUnverifiedTestAccount() {
    loginPage().signIn(TestConfig.unverifiedTestUserEmail(), TestConfig.unverifiedTestUserPassword());
  }

  @When("I sign up with a specified email address and password")
  public void iSignUpWithASpecifiedEmailAddressAndPassword() {
    generatedSignupEmail = TestConfig.signupUserEmail();
    signupPage().signUp("UI", "Tester", generatedSignupEmail, TestConfig.signupUserPassword());
  }

  @When("I sign up with a generated account")
  public void iSignUpWithAGeneratedAccount() {
    generatedSignupEmail = TestConfig.signupUserEmail();
    signupPage().signUp("UI", "Tester", generatedSignupEmail, GENERATED_SIGNUP_PASSWORD);
  }

  @When("I sign up with the configured existing account email")
  public void iSignUpWithTheConfiguredExistingAccountEmail() {
    signupPage().signUp("Existing", "User", TestConfig.testUserEmail(), GENERATED_SIGNUP_PASSWORD);
  }

  @When("I sign up with a generated account using password {string}")
  public void iSignUpWithAGeneratedAccountUsingPassword(String password) {
    long uniqueSuffix = System.currentTimeMillis();
    String email = "ui-test-invalid-" + uniqueSuffix + "@example.com";
    signupPage().signUp("UI", "Tester", email, password);
  }

  @When("I sign in with the generated account")
  public void iSignInWithTheGeneratedAccount() {
    Assert.assertNotNull(generatedSignupEmail, "Generated signup email should have been created first");
    loginPage().signIn(generatedSignupEmail, GENERATED_SIGNUP_PASSWORD);
  }

  @When("I wait 10 seconds before signing in")
  public void iWaitTenSecondsBeforeSigningIn() throws InterruptedException {
    Thread.sleep(10_000);
  }

  @Then("I should land on the cart page")
  public void iShouldLandOnTheCartPage() {
    Assert.assertTrue(cartPage().isVisible(), "Expected cart page to be visible");
  }

  @Then("I should land on the products page")
  public void iShouldLandOnTheProductsPage() {
    Assert.assertTrue(productsPage().showsAllFilter(), "Expected products page to show the All filter");
  }

  @Then("I should be on the signup page")
  public void iShouldBeOnTheSignupPage() {
    Assert.assertTrue(signupPage().isVisible(), "Expected signup page to be visible");
  }

  @Then("the login page should not show an authentication error")
  public void theLoginPageShouldNotShowAnAuthenticationError() {
    Assert.assertFalse(loginPage().hasErrorMessage(), "Login page should not show an authentication error");
  }

  @Then("the login page should show the email verification error")
  public void theLoginPageShouldShowTheEmailVerificationError() {
    Assert.assertTrue(loginPage().hasErrorMessage(), "Login page should show the email verification error");
    Assert.assertEquals(loginPage().errorMessage(), EMAIL_NOT_VERIFIED_MESSAGE);
  }

  @Then("the signup page should not show a validation error")
  public void theSignupPageShouldNotShowAValidationError() {
    Assert.assertFalse(signupPage().hasErrorMessage(), "Signup page should not show a validation error");
  }

  @Then("the signup page should show a validation error")
  public void theSignupPageShouldShowAValidationError() {
    Assert.assertTrue(signupPage().hasErrorMessage(), "Signup page should show a validation error");
  }

  @Then("the signup page should show the password requirements error")
  public void theSignupPageShouldShowThePasswordRequirementsError() {
    Assert.assertEquals(signupPage().errorMessage(), PASSWORD_REQUIREMENTS_MESSAGE);
  }

  @Then("the signup page should show a verification success message")
  public void theSignupPageShouldShowAVerificationSuccessMessage() {
    Assert.assertTrue(
      signupPage().hasSuccessMessage(),
      "Signup page should show a verification success message, but got: " + signupPage().submissionState()
    );
    Assert.assertEquals(signupPage().successMessage(), SIGNUP_SUCCESS_MESSAGE);
  }

  @Then("the signup should be successful and ask the user to verify their email address")
  public void theSignupShouldBeSuccessfulAndAskTheUserToVerifyTheirEmailAddress() {
    theSignupPageShouldShowAVerificationSuccessMessage();
  }

  private double calculateBoxWeightKg(double clothesWeightKg) {
    if (clothesWeightKg <= 0) return 0;
    if (clothesWeightKg <= 1) return 0.25;
    if (clothesWeightKg <= 2) return 0.3;
    if (clothesWeightKg <= 3) return 0.35;
    if (clothesWeightKg <= 4) return 0.4;
    if (clothesWeightKg <= 5) return 0.45;

    double extraKgSteps = Math.ceil(clothesWeightKg) - 5;
    return 0.45 + extraKgSteps * 0.05;
  }

  private double calculateShippingCostUsd(double shipmentWeightKg, CartPage.ShippingRates shippingRates) {
    if (shipmentWeightKg <= 0) return 0;

    // The first kilogram always uses the base rate.
    // Any remaining weight is billed in whole kilograms, rounded up,
    // using the selected option's additional-kg rate.
    double extraWeightKg = Math.max(shipmentWeightKg - 1, 0);
    double billedAdditionalKg = extraWeightKg > 0 ? Math.ceil(extraWeightKg) : 0;
    return shippingRates.firstKgUsd() + billedAdditionalKg * shippingRates.additionalKgUsd();
  }

  private ExpectedCartTotals expectedCartTotals() {
    double boxWeightKg = calculateBoxWeightKg(rememberedTotalProductWeightKg);
    double shipmentWeightKg = rememberedTotalProductWeightKg + boxWeightKg;
    CartPage.ShippingRates shippingRates = cartPage().selectedShippingRatesUsd();
    double shippingUsd = calculateShippingCostUsd(shipmentWeightKg, shippingRates);
    double orderTotalUsd = rememberedTotalProductPriceUsd + shippingUsd;

    return new ExpectedCartTotals(boxWeightKg, shipmentWeightKg, shippingUsd, orderTotalUsd);
  }

  private record ExpectedCartTotals(
    double boxWeightKg,
    double shipmentWeightKg,
    double shippingUsd,
    double orderTotalUsd
  ) {}
}
