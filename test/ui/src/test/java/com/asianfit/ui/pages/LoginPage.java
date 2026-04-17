package com.asianfit.ui.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.Keys;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class LoginPage extends BasePage {
  // Page Object representing the Login page.

  // Locators for login page elements
  private static final By EMAIL = By.xpath("//input[@id='login-email']");
  private static final By PASSWORD = By.xpath("//input[@id='login-password']");
  private static final By SUBMIT = By.xpath("//button[@type='submit']");
  // Constructor initializes the page with WebDriver instance
  public LoginPage(WebDriver driver) {
    super(driver);
  }

  // Checks if the login page is visible by verifying URL and presence of email field
  public boolean isVisible() {
    if (!waitForUrlContains("/login")) {
      return false;
    }
    return count(EMAIL) > 0;
  }

  // Performs sign-in action.
  // Waits for either login form to be present OR redirect to cart page (if already logged in)
  public void signIn(String email, String password) {
    waitForUrlContains("/login");
    // Wait until login form appears
    wait.until(ExpectedConditions.presenceOfElementLocated(EMAIL));
    typeIntoField(EMAIL, email);
    typeIntoField(PASSWORD, password);
    click(SUBMIT);
  }

  // Helper method to click into a field and type value using explicit wait for clickability
  private void typeIntoField(By locator, String value) {
    WebElement field = waitForClickable(locator);
    field.click();
    field.sendKeys(value);
  }
}
