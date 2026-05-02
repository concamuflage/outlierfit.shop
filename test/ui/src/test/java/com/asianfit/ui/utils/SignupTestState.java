package com.asianfit.ui.utils;

public final class SignupTestState {
  private static final ThreadLocal<String> SIGNUP_EMAIL = new ThreadLocal<>();

  private SignupTestState() {}

  public static void rememberSignupEmail(String email) {
    if (email != null && !email.isBlank()) {
      SIGNUP_EMAIL.set(email.trim().toLowerCase());
    }
  }

  public static String signupEmail() {
    return SIGNUP_EMAIL.get();
  }

  public static void clear() {
    SIGNUP_EMAIL.remove();
  }
}
