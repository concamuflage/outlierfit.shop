@SignupLogin @smoke @regression
Feature: Signup and Login
  Background:
    Given I open the signup page

  @mail
  Scenario: User cannot login without verifying their email address
    When I sign up with a unique email and password "StrongPass123A"
    Then signup should ask me to verify my email
    When I log in with the generated email and password "StrongPass123A"
    Then login should fail because of "verification"
    When I verify the generated email through the delivered message
    And I log in with the generated email and password "StrongPass123B"
    Then login should fail because of "password"
    When I log in with the generated email and password "StrongPass123A"
    Then I should be authenticated on the products page

  @mail
  Scenario: User can request a new verification email if they haven't received the original one
    When I sign up with a unique email and password "StrongPass123A"
    Then signup should ask me to verify my email
    When I request a new verification email
    And I verify the generated email through the delivered message
    And I log in with the generated email and password "StrongPass123A"
    Then I should be authenticated on the products page

  @mail
  Scenario: User cannot sign up twice with the same email address
    When I sign up with a unique email and password "StrongPass123A"
    Then signup should ask me to verify my email
    When I sign up again with the same email
    Then signup should show a validation error

  Scenario Outline: User cannot sign up with a password that violates the password policy
    When I sign up using invalid password "<password>"
    Then signup should show the password requirements
    Examples:
      | password      |
      | Short1!       |
      | lowercase123! |
      | UPPERCASE123! |
      | NoDigitsHere! |
      | Has Space123! |
