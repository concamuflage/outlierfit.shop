package com.asianfit.ui.runner;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;
import org.testng.annotations.DataProvider;

@CucumberOptions(
  features = "src/test/resources/features",
  glue = {"com.asianfit.ui.steps", "com.asianfit.ui.hooks"},
  plugin = {"pretty", "html:target/payment-cucumber-report.html"},
  tags = "@PaymentDev"
)
public class PaymentDevRunner extends AbstractTestNGCucumberTests {
  @Override
  @DataProvider(parallel = false)
  public Object[][] scenarios() {
    return super.scenarios();
  }
}
