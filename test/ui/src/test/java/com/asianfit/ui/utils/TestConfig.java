package com.asianfit.ui.utils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class TestConfig {
  private static final List<Path> LOCAL_ENV_PATHS = List.of(
    Path.of(".env"),
    Path.of(".env.local"),
    Path.of("test/ui/.env"),
    Path.of("test/ui/.env.local")
  );
  private static final Map<String, String> LOCAL_ENV = loadLocalEnv();

  private TestConfig() {}

  public static String baseUrl() {
    String value = System.getProperty("baseUrl");
    if (value == null || value.isBlank()) {
      return "http://localhost:3000";
    }
    return value;
  }

  public static boolean headless() {
    String value = System.getProperty("headless");
    if (value == null || value.isBlank()) {
      return true;
    }
    return Boolean.parseBoolean(value);
  }

  public static String testUserEmail() {
    String value = System.getProperty("testUserEmail");
    if (value == null || value.isBlank()) {
      value = System.getenv("TEST_USER_EMAIL");
    }
    if (value == null || value.isBlank()) {
      value = LOCAL_ENV.get("TEST_USER_EMAIL");
    }
    if (value == null || value.isBlank()) {
      throw new IllegalStateException(
        "Missing test user email. Set -DtestUserEmail, TEST_USER_EMAIL, or test/ui/.env.local for login-required UI tests"
      );
    }
    return value;
  }

  public static String signupUserEmail() {
    String value = System.getProperty("testSignupEmail");
    if (value == null || value.isBlank()) {
      value = System.getenv("TEST_SIGNUP_EMAIL");
    }
    if (value == null || value.isBlank()) {
      value = LOCAL_ENV.get("TEST_SIGNUP_EMAIL");
    }
    return value;
  }

  public static String signupUserPassword() {
    String value = System.getProperty("testSignupPassword");
    if (value == null || value.isBlank()) {
      value = System.getenv("TEST_SIGNUP_PASSWORD");
    }
    if (value == null || value.isBlank()) {
      value = LOCAL_ENV.get("TEST_SIGNUP_PASSWORD");
    }
    if (value == null || value.isBlank()) {
      value = "StrongPass123A!";
    }
    return value;
  }

  public static String testUserPassword() {
    String value = System.getProperty("testUserPassword");
    if (value == null || value.isBlank()) {
      value = System.getenv("TEST_USER_PASSWORD");
    }
    if (value == null || value.isBlank()) {
      value = LOCAL_ENV.get("TEST_USER_PASSWORD");
    }
    if (value == null || value.isBlank()) {
      throw new IllegalStateException(
        "Missing test user password. Set -DtestUserPassword, TEST_USER_PASSWORD, or test/ui/.env.local for login-required UI tests"
      );
    }
    return value;
  }

  public static String unverifiedTestUserEmail() {
    String value = System.getProperty("unverifiedTestUserEmail");
    if (value == null || value.isBlank()) {
      value = System.getenv("TEST_UNVERIFIED_USER_EMAIL");
    }
    if (value == null || value.isBlank()) {
      value = LOCAL_ENV.get("TEST_UNVERIFIED_USER_EMAIL");
    }
    if (value == null || value.isBlank()) {
      throw new IllegalStateException(
        "Missing unverified test user email. Set -DunverifiedTestUserEmail, TEST_UNVERIFIED_USER_EMAIL, or test/ui/.env.local"
      );
    }
    return value;
  }

  public static String unverifiedTestUserPassword() {
    String value = System.getProperty("unverifiedTestUserPassword");
    if (value == null || value.isBlank()) {
      value = System.getenv("TEST_UNVERIFIED_USER_PASSWORD");
    }
    if (value == null || value.isBlank()) {
      value = LOCAL_ENV.get("TEST_UNVERIFIED_USER_PASSWORD");
    }
    if (value == null || value.isBlank()) {
      throw new IllegalStateException(
        "Missing unverified test user password. Set -DunverifiedTestUserPassword, TEST_UNVERIFIED_USER_PASSWORD, or test/ui/.env.local"
      );
    }
    return value;
  }

  private static Map<String, String> loadLocalEnv() {
    Map<String, String> values = new HashMap<>();
    Path localEnvPath = resolveLocalEnvPath();
    if (localEnvPath == null) {
      return values;
    }

    try {
      List<String> lines = Files.readAllLines(localEnvPath);
      for (String rawLine : lines) {
        String line = rawLine.trim();
        if (line.isEmpty() || line.startsWith("#")) {
          continue;
        }

        int separatorIndex = line.indexOf('=');
        if (separatorIndex <= 0) {
          continue;
        }

        String key = line.substring(0, separatorIndex).trim();
        String value = line.substring(separatorIndex + 1).trim();
        values.put(key, stripWrappingQuotes(value));
      }
    } catch (IOException e) {
      throw new IllegalStateException("Failed to read " + localEnvPath, e);
    }

    return values;
  }

  private static Path resolveLocalEnvPath() {
    for (Path candidate : LOCAL_ENV_PATHS) {
      if (Files.exists(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private static String stripWrappingQuotes(String value) {
    if (value.length() >= 2) {
      boolean wrappedInDoubleQuotes = value.startsWith("\"") && value.endsWith("\"");
      boolean wrappedInSingleQuotes = value.startsWith("'") && value.endsWith("'");
      if (wrappedInDoubleQuotes || wrappedInSingleQuotes) {
        return value.substring(1, value.length() - 1);
      }
    }
    return value;
  }
}
