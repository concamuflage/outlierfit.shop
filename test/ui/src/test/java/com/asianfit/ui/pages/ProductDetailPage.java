package com.asianfit.ui.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/** Product-page controls and precise variant weights, e.g. 0.05625 kg displayed as 0.06 kg. */
public class ProductDetailPage extends BasePage {
  private static final By ADD_TO_CART_BUTTON = By.cssSelector("[data-testid='add-to-cart-button']");
  private static final By PRICE = By.xpath("//h1/following-sibling::div[contains(@class,'font-semibold')][2]");
  private static final By WEIGHT = By.cssSelector("[data-testid='product-weight']");

  public ProductDetailPage(WebDriver driver) {
    super(driver);
  }

  public void addToCart() {
    click(ADD_TO_CART_BUTTON);
  }

  /** Reads the precise item weight used in totals, e.g. 0.05625 despite a 0.06 kg label. */
  public double weightKg() {
    return Double.parseDouble(waitForVisible(WEIGHT).getAttribute("data-weight-kg"));
  }

  public double priceUsd() {
    String raw = text(PRICE);
    String normalized = raw.replace("$", "").replace(",", "").trim();
    return Double.parseDouble(normalized);
  }
}
