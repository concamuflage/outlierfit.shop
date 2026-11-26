@CartAndDrawerSync @regression
Feature: Cart and drawer stay in sync
  Scenario: changing the item quantity in the cart drawer updates the cart page
    Given I am a verified disposable customer
    When I add a "Shirts" product to the cart
    And I increase the first cart drawer item quantity
    And I remember the drawer items and totals
    And I view the cart from the drawer
    Then the page should match the remembered items and totals

  Scenario: changing the item quantity on the cart page updates the cart drawer
    Given I am a verified disposable customer
    When I add a "Shirts" product to the cart
    And I view the cart from the drawer
    And I increase the quantity of cart item 1
    And I remember the page items and totals
    And I open the cart drawer
    Then the drawer should match the remembered items and totals
