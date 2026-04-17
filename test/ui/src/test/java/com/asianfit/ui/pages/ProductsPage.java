package com.asianfit.ui.pages;

import com.asianfit.ui.utils.TestConfig;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class ProductsPage extends BasePage {
  private static final By ALL_FILTER = By.xpath("//button[.//span[normalize-space()='All']]");
  private static final By FIRST_PRODUCT_CARD = By.cssSelector("[data-testid^='product-card-']");

  public ProductsPage(WebDriver driver) {
    super(driver);
  }

  public void open() {
    driver.get(TestConfig.baseUrl() + "/products");
    waitForVisible(FIRST_PRODUCT_CARD);
  }

  public void openFirstProduct() {
    click(FIRST_PRODUCT_CARD);
  }

  public boolean showsAllFilter() {
    try {
      return waitForVisible(ALL_FILTER).isDisplayed();
    } catch (Exception ignored) {
      return false;
    }
  }

  public void openProtectedCartPage() {
    driver.get(TestConfig.baseUrl() + "/cart");
  }
}
