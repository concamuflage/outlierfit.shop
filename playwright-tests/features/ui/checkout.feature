@Checkout @regression
Feature: Checkout
  Scenario: A returning user can review checkout details with saved addresses
    Given I am a returning disposable customer with saved addresses
    When I add a "Shirts" product to the cart
    And I view the cart from the drawer
    And I review checkout
    Then the essential order details should be visible
    When I choose another shipping and billing address
    Then I can edit the selected shipping and billing addresses

  Scenario: A new user can start checkout without saved addresses
    Given I am a verified disposable customer
    When I add a "Shirts" product to the cart
    And I view the cart from the drawer
    And I review checkout
    Then the essential order details should be visible
    And checkout should ask for new shipping and billing information
    When I add new shipping and separate billing addresses
    Then card checkout should be enabled
