package com.asianfit.ui.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class LoginPage extends BasePage {
  private static final By EMAIL = By.cssSelector("input#email");
  private static final By PASSWORD = By.cssSelector("input#password");
  private static final By SUBMIT = By.cssSelector("button[type='submit']");
  private static final By ERROR = By.cssSelector(".text-red-600");

  public LoginPage(WebDriver driver) {
    super(driver);
  }

  public boolean isVisible() {
    if (!waitForUrlContains("/login")) {
      return false;
    }
    return count(EMAIL) > 0;
  }

  public void signIn(String email, String password) {
    waitForUrlContains("/login");
    wait.until(ExpectedConditions.presenceOfElementLocated(EMAIL));
    typeIntoField(EMAIL, email);
    typeIntoField(PASSWORD, password);
    click(SUBMIT);
  }

  public boolean hasErrorMessage() {
    return count(ERROR) > 0;
  }

  private void typeIntoField(By locator, String value) {
    WebElement field = waitForClickable(locator);
    field.click();
    field.sendKeys(value);
  }
}
