package com.asianfit.ui.utils;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.openqa.selenium.TimeoutException;
import org.testng.Assert;
import org.testng.annotations.Test;

/** Tests delivery polling without sending mail, e.g. two empty lookups followed by a reset link. */
public class GmailVerificationClientTest {
  /** Delayed delivery succeeds on the third lookup rather than failing on the first empty result. */
  @Test
  public void waitsForDelayedEmail() {
    AtomicInteger attempts = new AtomicInteger();
    String link = "http://localhost:3000/reset-password?email=test@example.invalid&token=test-only";
    String result = GmailVerificationClient.waitForPasswordResetLink(
      "test@example.invalid", () -> attempts.incrementAndGet() < 3 ? null : link,
      Duration.ofSeconds(2), Duration.ofMillis(1)
    );
    Assert.assertEquals(result, link);
    Assert.assertEquals(attempts.get(), 3);
  }

  /** Missing mail stops after a bounded wait and identifies the recipient in its diagnostic. */
  @Test
  public void timesOutWhenEmailNeverArrives() {
    TimeoutException error = Assert.expectThrows(TimeoutException.class, () ->
      GmailVerificationClient.waitForPasswordResetLink(
        "test@example.invalid", () -> null, Duration.ofMillis(20), Duration.ofMillis(1)
      )
    );
    Assert.assertTrue(error.getMessage().contains("test@example.invalid"));
  }

  /** OAuth/API errors remain immediate failures, e.g. invalid_grant is not treated as undelivered mail. */
  @Test
  public void doesNotRetryAuthenticationFailures() {
    AtomicInteger attempts = new AtomicInteger();
    IllegalStateException original = new IllegalStateException("invalid_grant");
    IllegalStateException error = Assert.expectThrows(IllegalStateException.class, () ->
      GmailVerificationClient.waitForPasswordResetLink("test@example.invalid", () -> {
        attempts.incrementAndGet();
        throw original;
      }, Duration.ofSeconds(2), Duration.ofMillis(1))
    );
    Assert.assertSame(error, original);
    Assert.assertEquals(attempts.get(), 1);
  }
}
