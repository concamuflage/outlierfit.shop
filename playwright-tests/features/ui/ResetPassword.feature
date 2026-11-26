@ResetPassword @mail @regression
Feature: Reset Password Feature
  Background:
    Given I open the signup page
    When I sign up with a unique email and password "StrongPass123A"
    Then signup should ask me to verify my email

  Scenario: verified user can reset the password
    When I verify the generated email through the delivered message
    And I request a password reset for the generated email
    And I open the delivered password reset link
    And I reset and confirm the password as "StrongPass123New"
    And I log in with the generated email and password "StrongPass123New"
    Then I should be authenticated on the products page

  Scenario: unverified user can reset the password
    When I keep the original verification message without opening its link
    And I request a password reset for the generated email
    And I open the delivered password reset link
    And I reset and confirm the password as "StrongPass123New"
    And I log in with the generated email and password "StrongPass123New"
    Then I should be authenticated on the products page
    And the original verification link should say the email is already verified
