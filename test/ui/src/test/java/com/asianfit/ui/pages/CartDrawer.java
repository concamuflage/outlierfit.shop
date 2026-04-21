package com.asianfit.ui.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import java.util.List;

public class CartDrawer extends BasePage {
  private static final By DRAWER = By.cssSelector("[data-testid='cart-drawer']");
  private static final By CART_ITEMS = By.cssSelector("[data-testid^='cart-drawer-line-item-']");
  private static final By FIRST_ITEM_INCREASE = By.cssSelector("[data-testid^='cart-drawer-item-increase-']");
  private static final By FIRST_ITEM_QTY = By.cssSelector("[data-testid^='cart-drawer-item-qty-']");
  private static final By FIRST_ITEM_REMOVE = By.cssSelector("[data-testid^='cart-drawer-item-remove-']");
  private static final By SUBTOTAL = By.cssSelector("[data-testid='cart-drawer-subtotal']");
  private static final By CLEAR_CART = By.cssSelector("[data-testid='cart-drawer-clear-cart']");

  public CartDrawer(WebDriver driver) {
    super(driver);
  }

  public boolean isVisible() {
    return waitForVisible(DRAWER).isDisplayed();
  }

  public int itemCount() {
    waitForVisible(DRAWER);
    return count(CART_ITEMS);
  }

  public void waitUntilOpen() {
    waitForVisible(DRAWER);
  }

  public void increaseFirstItemQuantity() {
    click(FIRST_ITEM_INCREASE);
  }

  public void increaseSecondItemQuantity() {
    List<WebElement> items = driver.findElements(CART_ITEMS);
    if (items.size() < 2) {
      throw new IllegalStateException("Expected at least 2 cart items in the drawer");
    }
    WebElement secondItem = items.get(1);
    WebElement increaseButton = secondItem.findElement(By.cssSelector("[data-testid^='cart-drawer-item-increase-']"));
    increaseButton.click();
  }

  public String firstItemQuantity() {
    return text(FIRST_ITEM_QTY);
  }

  public void removeFirstItem() {
    click(FIRST_ITEM_REMOVE);
  }

  public String subtotal() {
    return text(SUBTOTAL);
  }

  public void clearCart() {
    click(CLEAR_CART);
  }
}
