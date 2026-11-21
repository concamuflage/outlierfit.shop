package com.asianfit.ui.runner;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;
import org.testng.annotations.DataProvider;

/** Runs signup/login email smoke serially after deployment, e.g. one Gmail lookup at a time. */
@CucumberOptions(
  features = "src/test/resources/features/signup_login.feature",
  glue = {"com.asianfit.ui.steps", "com.asianfit.ui.hooks"},
  plugin = {"pretty", "html:target/deployment-auth-report.html"}
)
public class DeploymentAuthRunner extends AbstractTestNGCucumberTests {
  /** Avoids concurrent Gmail polling and cleanup across the eight signup/login smoke scenarios. */
  @Override
  @DataProvider(parallel = false)
  public Object[][] scenarios() {
    return super.scenarios();
  }
}
