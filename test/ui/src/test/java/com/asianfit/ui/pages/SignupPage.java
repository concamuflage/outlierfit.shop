package com.asianfit.ui.pages;

import com.asianfit.ui.utils.TestConfig;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class SignupPage extends BasePage {
  private static final By FIRST_NAME = By.cssSelector("input#firstName");
  private static final By LAST_NAME = By.cssSelector("input#lastName");
  private static final By EMAIL = By.cssSelector("input#email");
  private static final By PASSWORD = By.cssSelector("input#password");
  private static final By CONFIRM_PASSWORD = By.cssSelector("input#confirmPassword");
  private static final By SUBMIT = By.cssSelector("button[type='submit']");
  private static final By ERROR = By.cssSelector(".text-red-600");
  private static final By SUCCESS = By.cssSelector(".text-emerald-700");

  public SignupPage(WebDriver driver) {
    super(driver);
  }

  public void open() {
    driver.get(TestConfig.baseUrl() + "/signup");
  }

  public boolean isVisible() {
    if (!waitForUrlContains("/signup")) {
      return false;
    }
    return count(EMAIL) > 0;
  }

  public void signUp(String firstName, String lastName, String email, String password) {
    signUp(firstName, lastName, email, password, password);
  }

  public void signUp(String firstName, String lastName, String email, String password, String confirmPassword) {
    typeIntoField(FIRST_NAME, firstName);
    typeIntoField(LAST_NAME, lastName);
    typeIntoField(EMAIL, email);
    typeIntoField(PASSWORD, password);
    typeIntoField(CONFIRM_PASSWORD, confirmPassword);
    click(SUBMIT);
  }

  public boolean hasErrorMessage() {
    return count(ERROR) > 0;
  }

  public String errorMessage() {
    return text(ERROR);
  }

  public boolean hasSuccessMessage() {
    return count(SUCCESS) > 0;
  }

  public String successMessage() {
    return text(SUCCESS);
  }

  private void typeIntoField(By locator, String value) {
    WebElement field = waitForClickable(locator);
    field.click();
    field.sendKeys(value);
  }
}
