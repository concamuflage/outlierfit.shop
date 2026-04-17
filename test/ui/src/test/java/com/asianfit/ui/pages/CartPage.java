package com.asianfit.ui.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CartPage extends BasePage {
  private static final By PAGE_TITLE = By.xpath("//h1[normalize-space()='Your cart']");

  public CartPage(WebDriver driver) {
    super(driver);
  }

  public boolean isVisible() {
    return waitForVisible(PAGE_TITLE).isDisplayed() && currentUrl().contains("/cart");
  }
}
