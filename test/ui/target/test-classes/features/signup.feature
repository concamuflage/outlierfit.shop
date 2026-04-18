@Signup
Feature: Signup

  Scenario: User can create an account and is prompted to verify the email address
    Given I open the signup page
    Then I should be on the signup page
    When I sign up with a specified email address and password
    Then the signup should be successful and ask the user to verify their email address

  Scenario: User cannot sign up twice with the same email address
    Given I open the signup page
    Then I should be on the signup page
    When I sign up with a specified email address and password
    Then the signup should be successful and ask the user to verify their email address
    Given I open the signup page
    Then I should be on the signup page
    When I sign up with the configured existing account email
    Then the signup page should show a validation error

  Scenario Outline: User cannot sign up with a password that violates the password policy
    Given I open the signup page
    Then I should be on the signup page
    When I sign up with a generated account using password "<password>"
    Then the signup page should show the password requirements error

    Examples:
      | password         |
      | Short1!         |
      | lowercase123!   |
      | UPPERCASE123!   |
      | NoDigitsHere!   |
      | NoSpecial123    |
      | Has Space123!   |
