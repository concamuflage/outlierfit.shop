package com.asianfit.ui.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.Keys;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class LoginPage extends BasePage {
  private static final By EMAIL = By.cssSelector("input[name='email']");
  private static final By PASSWORD = By.cssSelector("input[name='password']");
  private static final By SUBMIT = By.cssSelector("button[type='submit']");
  private static final By PAGE_HEADING = By.xpath("//*[normalize-space()='Welcome back']");

  public LoginPage(WebDriver driver) {
    super(driver);
  }

  public boolean isVisible() {
    if (!waitForUrlContains("/login")) {
      return false;
    }

    return count(EMAIL) > 0 || count(PAGE_HEADING) > 0;
  }

  public void signIn(String email, String password) {
    waitForUrlContains("/login");
    wait.until(
      ExpectedConditions.or(
        ExpectedConditions.presenceOfElementLocated(EMAIL),
        ExpectedConditions.urlContains("/cart")
      )
    );

    if (currentUrl().contains("/cart")) {
      return;
    }

    typeIntoField(EMAIL, email);
    typeIntoField(PASSWORD, password);
    click(SUBMIT);
  }

  private void typeIntoField(By locator, String value) {
    WebElement field = waitForClickable(locator);
    field.click();
    field.sendKeys(Keys.chord(Keys.COMMAND, "a"));
    field.sendKeys(Keys.DELETE);
    field.sendKeys(value);
  }
}
