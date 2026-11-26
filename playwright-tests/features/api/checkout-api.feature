@CheckoutApi @api @regression @dev-only
Feature: Checkout API
  Scenario: Authenticated user can submit mock payment and retrieve invoice PDFs
    Given I am authenticated for the API as a disposable customer
    And a private checkout fixture exists
    When I save the private cart and address selections
    Then the cart response should preserve the fixture and selections
    When I submit a mock payment for the private cart
    Then the mock response should create a paid order
    When I retrieve the customer's order list
    Then the order list and single order should match the fixture
    And the invoice payload should include complete order information
    And both invoice PDF endpoints should return downloadable PDFs
