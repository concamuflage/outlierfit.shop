@OrdersInvoiceApi @api @regression
Feature: Orders invoice API
  Scenario: Authenticated user can retrieve invoice-ready data for an order
    Given I am authenticated for the API as a disposable customer
    And a private checkout fixture exists
    And a paid order exists for the disposable customer
    Then the invoice payload should include complete order information
