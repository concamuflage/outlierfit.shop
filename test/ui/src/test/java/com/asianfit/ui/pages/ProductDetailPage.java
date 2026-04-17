package com.asianfit.ui.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class ProductDetailPage extends BasePage {
  private static final By ADD_TO_CART_BUTTON = By.cssSelector("[data-testid='add-to-cart-button']");

  public ProductDetailPage(WebDriver driver) {
    super(driver);
  }

  public void addToCart() {
    click(ADD_TO_CART_BUTTON);
  }
}
