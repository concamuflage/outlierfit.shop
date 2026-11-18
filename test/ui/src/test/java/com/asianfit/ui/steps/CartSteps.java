package com.asianfit.ui.steps;

import com.asianfit.ui.pages.CartPage;
import com.asianfit.ui.pages.CartDrawer;
import com.asianfit.ui.pages.HomePage;
import com.asianfit.ui.pages.ProductDetailPage;
import com.asianfit.ui.pages.ProductsPage;
import com.asianfit.ui.utils.DriverFactory;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.ArrayList;
import java.util.List;
import org.testng.Assert;

/** Verifies item subtotals and one flat domestic shipping fee across cart views. */
public class CartSteps {
  private String rememberedSubtotal;
  private double rememberedTotalProductPriceUsd;
  private final List<Double> addedProductPricesUsd = new ArrayList<>();

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

  private CartPage cartPage() {
    return new CartPage(DriverFactory.getDriver());
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
    rememberedTotalProductPriceUsd += priceUsd;
    addedProductPricesUsd.add(priceUsd);
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


  /** Checks the item subtotal before the flat domestic shipping fee. */
  @Then("the cart should show the correct product subtotal")
  public void theCartShouldShowTheCorrectProductSubtotal() {
    Assert.assertEquals(cartPage().subtotalUsd(), rememberedTotalProductPriceUsd, 0.01);
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
    cartPage().increaseFirstItemQuantity();
  }

  @When("I increase the quantity of the second cart item")
  public void iIncreaseTheQuantityOfTheSecondCartItem() {
    rememberedTotalProductPriceUsd += addedProductPricesUsd.get(1);
    cartPage().increaseSecondItemQuantity();
  }



  @When("I increase the quantity of the first cart drawer item")
  public void iIncreaseTheQuantityOfTheFirstCartDrawerItem() {
    rememberedTotalProductPriceUsd += addedProductPricesUsd.get(0);
    cartDrawer().increaseFirstItemQuantity();
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

  @Then("I should land on the cart page")
  public void iShouldLandOnTheCartPage() {
    Assert.assertTrue(cartPage().isVisible(), "Expected cart page to be visible");
  }

  @Then("I should land on the products page")
  public void iShouldLandOnTheProductsPage() {
    Assert.assertTrue(productsPage().showsAllFilter(), "Expected products page to show the All filter");
  }




  /** Flat-rate totals stay independent of weight; e.g. $49.90 + $8.95 = $58.85. */
  private ExpectedCartTotals expectedCartTotals() {
    double shippingUsd = 8.95;
    return new ExpectedCartTotals(shippingUsd, rememberedTotalProductPriceUsd + shippingUsd);
  }

  /** Expected totals include only the flat fee and payable amount. */
  private record ExpectedCartTotals(
    double shippingUsd,
    double orderTotalUsd
  ) {}
}
