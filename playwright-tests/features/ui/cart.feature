@Cart @regression
Feature: Cart
  Scenario: the carts should display the correct subtotal and flat shipping fee
    Given I am a verified disposable customer
    When I add a "Shirts" product to the cart
    And I add a "T-shirts" product to the cart
    And I view the cart from the drawer
    Then the cart should show the correct subtotal and flat shipping fee
    When I increase the quantity of cart item 1
    And I increase the quantity of cart item 2
    Then the cart should show the correct subtotal and flat shipping fee
