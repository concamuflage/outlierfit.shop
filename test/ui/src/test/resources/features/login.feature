Feature: Login

  Scenario: User can sign in from the login page and access the protected cart
    Given I open the protected cart page
    Then I should be on the login page
    When I sign in with the configured test account
    Then the login page should not show an authentication error
    When I open the protected cart page
    Then I should land on the cart page
