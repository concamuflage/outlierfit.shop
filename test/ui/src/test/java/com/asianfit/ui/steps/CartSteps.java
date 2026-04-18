package com.asianfit.ui.steps;

import com.asianfit.ui.pages.CartPage;
import com.asianfit.ui.pages.CartDrawer;
import com.asianfit.ui.pages.LoginPage;
import com.asianfit.ui.pages.ProductDetailPage;
import com.asianfit.ui.pages.ProductsPage;
import com.asianfit.ui.pages.SignupPage;
import com.asianfit.ui.utils.DriverFactory;
import com.asianfit.ui.utils.TestConfig;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
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

  private ProductsPage productsPage() {
    return new ProductsPage(DriverFactory.getDriver());
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

  @When("I add the product to the cart")
  public void iAddTheProductToTheCart() {
    productDetailPage().addToCart();
  }

  @Then("the cart drawer should be visible")
  public void theCartDrawerShouldBeVisible() {
    Assert.assertTrue(cartDrawer().isVisible(), "Cart drawer should be visible");
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
    cartDrawer().increaseFirstItemQuantity();
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
}
