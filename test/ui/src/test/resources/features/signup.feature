@Signup @Regression
Feature: Signup
  too complicated to test, leave for future

  Scenario Outline: User cannot login without verifying their email address
    Given I open the signup page
    Then I should be on the signup page
    When I sign up with email "<email>" and password
    Then the signup should be successful and ask the user to verify their email address
    When I log in with the unverified account credentials
    Then the login should fail with an error message about email verification
    And Wait 10 Seconds before login and look for verification email
    And I log into its email account through the API and find the verification email
    And the verification email sender should be correct
    And I click the link in the verification email
    Then the email verification should be successful
    And the user should be able to log in
    And delete the account through the API

    Examples:
      # This inbox must be accessible through the Gmail API credentials used by the test.
      | email                  |
      | concamuflage@gmail.com |
      
  # Scenario: User cannot sign up twice with the same email address
  #   # register for the first time
  #   Given I open the signup page
  #   Then I should be on the signup page
  #   When I sign up with a specified email address and password
  #   Then the signup should be successful and ask the user to verify their email address
  #   # register for the second time with the same email
  #   Given I open the signup page
  #   Then I should be on the signup page
  #   When I sign up with the configured existing account email
  #   Then the signup page should show a validation error
  #   Then I delete the account
  # Scenario Outline: User cannot sign up with a password that violates the password policy
  #   # Minimum length: 12
  #   # Must include lowercase: [a-z]
  #   # Must include uppercase: [A-Z]
  #   # Must include a digit: \d
  #   # Must not contain whitespace: \s
  #   # Special characters are allowed but not required
  #   Given I open the signup page
  #   Then I should be on the signup page
  #   When I sign up with a generated account using password "<password>"
  #   Then the signup page should show the password requirements error
  #   Examples:
  #     | password         |
  #     # Too short
  #     | Short1!         |
  #     # Missing uppercase letter
  #     | lowercase123!   |
  #     # Missing lowercase letter
  #     | UPPERCASE123!   |
  #     # Missing digit
  #     | NoDigitsHere!   |
  #     # Contains whitespace
  #     | Has Space123!   |
