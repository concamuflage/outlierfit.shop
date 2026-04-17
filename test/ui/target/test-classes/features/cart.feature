Feature: Cart

#   Scenario: place an order without login


   Scenario: Add an item to cart and update quantity from the drawer
     Given I open the products page
     When I open the first product from the grid
     And I add the product to the cart
     Then the cart drawer should be visible
     And the cart drawer should contain at least 1 item
     When I increase the quantity of the first cart item
     Then the first cart item quantity should be 2

   Scenario: Remove an item from the cart drawer
     Given I open the products page
     When I open the first product from the grid
     And I add the product to the cart
     Then the cart drawer should contain at least 1 item
     When I remove the first cart item
     Then the cart drawer should contain 0 items

   Scenario: Clear the cart drawer
     Given I open the products page
     When I open the first product from the grid
     And I add the product to the cart
     Then the cart drawer should contain at least 1 item
     When I clear the cart drawer
     Then the cart drawer should contain 0 items

   Scenario: Subtotal updates when item quantity changes
     Given I open the products page
     When I open the first product from the grid
     And I add the product to the cart
     And I note the cart drawer subtotal
     When I increase the quantity of the first cart item
     Then the cart drawer subtotal should change

  Scenario: Login-required cart flow
    Given I open the protected cart page
    Then I should be on the login page
    When I sign in with the configured test account
    Then I should land on the cart page

  Scenario: Manually verify a generated account before signing in
    Given I open the signup page
    Then I should be on the signup page
    When I sign up with a generated account
    Then the signup page should show a verification success message
    When I wait 10 seconds before signing in
    Given I open the login page
    When I sign in with the generated account
    Then the login page should not show an authentication error
