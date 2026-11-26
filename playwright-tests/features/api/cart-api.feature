@CartApi @api @regression
Feature: Cart API
  Scenario: Authenticated user can persist and retrieve the current cart
    Given I am authenticated for the API as a disposable customer
    And a private checkout fixture exists
    When I save the private cart and address selections
    Then the cart response should preserve the fixture and selections
    When I retrieve the private cart
    Then the cart response should preserve the fixture and selections
    When I clear the private cart
    Then the cart response should be empty
