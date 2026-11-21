package com.asianfit.ui.hooks;

import com.asianfit.ui.utils.DriverFactory;
import com.asianfit.ui.utils.DatabaseCleanup;
import com.asianfit.ui.utils.SignupTestState;
import io.cucumber.java.After;
import io.cucumber.java.AfterStep;
import io.cucumber.java.Before;

/** Isolates browser scenarios and cleans generated accounts, e.g. signup/login smoke users after CI runs. */
public class Hooks {
  private static final long STEP_PAUSE_MS = 1200;

  // Runs before each scenario starts.
  @Before
  public void setUp() {
    // Each scenario gets its own browser session to avoid cross-test state bleed.
    DriverFactory.createDriver();
  }

  /** Starts cart-based scenarios empty, including @Checkout tests that share the configured CI user. */
  @Before("@Cart or @CartAndDrawerSync or @Checkout")
  public void cleanCartBeforeScenario() {
    DatabaseCleanup.deleteTestUserCart();
  }

  // Runs after every individual step in a scenario.
  @AfterStep
  public void pauseAfterEachStep() {
    try {
      // Slow the UI flow down so step-by-step execution is visible during runs.
      Thread.sleep(STEP_PAUSE_MS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while pausing after step", e);
    }
  }

  // Runs after each scenario finishes, whether it passed or failed.
  @After
  public void tearDown() {
    // Always close the driver so parallel scenarios do not leak browser processes.
    DriverFactory.quitDriver();
  }

  /** Deletes generated accounts after both legacy @Signup and current @SignupLogin scenarios. */
  @After("@Signup or @SignupLogin or @ResetPassword")
  public void cleanSignupUserAfterScenario() {
    String signupEmail = SignupTestState.signupEmail();
    try {
      if (signupEmail != null && !signupEmail.isBlank()) {
        DatabaseCleanup.deleteUserByEmail(signupEmail);
      }
    } finally {
      SignupTestState.clear();
    }
  }

  @After("@Payment")
  public void cleanPaymentUserAfterScenario() {
    String signupEmail = SignupTestState.signupEmail();
    try {
      if (signupEmail != null && !signupEmail.isBlank()) {
        DatabaseCleanup.deletePaymentUserDataByEmail(signupEmail);
      }
    } finally {
      SignupTestState.clear();
    }
  }

  /** Removes cart fixtures after pass or failure, e.g. a cancelled checkout must not affect the next scenario. */
  @After("@Cart or @CartAndDrawerSync or @Checkout")
  public void cleanCartAfterScenario() {
    DatabaseCleanup.deleteTestUserCart();
  }
}
