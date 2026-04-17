package com.asianfit.ui.hooks;

import com.asianfit.ui.utils.DriverFactory;
import io.cucumber.java.After;
import io.cucumber.java.Before;

public class Hooks {
  @Before
  public void setUp() {
    DriverFactory.createDriver();
  }

  @After
  public void tearDown() {
    DriverFactory.quitDriver();
  }
}
