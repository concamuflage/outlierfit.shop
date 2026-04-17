package com.asianfit.ui.steps;

import com.asianfit.ui.pages.CartPage;
import com.asianfit.ui.pages.CartDrawer;
import com.asianfit.ui.pages.LoginPage;
import com.asianfit.ui.pages.ProductDetailPage;
import com.asianfit.ui.pages.ProductsPage;
import com.asianfit.ui.utils.DriverFactory;
import com.asianfit.ui.utils.TestConfig;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

public class CartSteps {
  private String rememberedSubtotal;

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

  @Given("I open the products page")
  public void iOpenTheProductsPage() {
    productsPage().open();
  }

  @Given("I open the protected cart page")
  public void iOpenTheProtectedCartPage() {
    productsPage().openProtectedCartPage();
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

  @Then("I should land on the cart page")
  public void iShouldLandOnTheCartPage() {
    Assert.assertTrue(cartPage().isVisible(), "Expected cart page to be visible");
  }
}
