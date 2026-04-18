
@Login
Feature: Login

  Scenario: Authorized user can sign in from the login page and see the products page
    Given I open the login page
    Then I should be on the login page
    When I sign in with the configured test account
    Then I should land on the products page

  Scenario: User cannot sign in with an unverified email address
    Given I open the login page
    Then I should be on the login page
    When I sign in with the unverified test account
    Then the login page should show the email verification error
