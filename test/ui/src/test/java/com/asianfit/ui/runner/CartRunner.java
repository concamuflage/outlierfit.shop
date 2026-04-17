package com.asianfit.ui.runner;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

@CucumberOptions(
  features = "src/test/resources/features",
  glue = {"com.asianfit.ui.steps", "com.asianfit.ui.hooks"},
  plugin = {"pretty", "html:target/cucumber-report.html"}
)
public class CartRunner extends AbstractTestNGCucumberTests {}
