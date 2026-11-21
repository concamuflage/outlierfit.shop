package com.asianfit.ui.runner;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;
import org.testng.annotations.DataProvider;

/** Runs staging's non-payment UI features serially; real-payment and synthetic API suites are separate jobs. */
@CucumberOptions(
  features = {
    "src/test/resources/features/signup_login.feature", "src/test/resources/features/ResetPassword.feature",
    "src/test/resources/features/modal.feature", "src/test/resources/features/cart.feature",
    "src/test/resources/features/CartAndDrawerSyn.feature", "src/test/resources/features/checkout.feature"
  },
  glue = {"com.asianfit.ui.steps", "com.asianfit.ui.hooks"},
  plugin = {"pretty", "html:target/deployment-regression-report.html"}
)
public class DeploymentRegressionRunner extends AbstractTestNGCucumberTests {
  /** Keeps shared staging cart fixtures isolated, e.g. one cart test finishes cleanup before the next starts. */
  @Override
  @DataProvider(parallel = false)
  public Object[][] scenarios() {
    return super.scenarios();
  }
}
