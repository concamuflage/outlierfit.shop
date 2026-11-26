@OrdersApi @api @regression
Feature: Orders API
  Scenario: Authenticated user can retrieve all orders and a single order
    Given I am authenticated for the API as a disposable customer
    And a private checkout fixture exists
    And a paid order exists for the disposable customer
    When I retrieve the customer's order list
    Then the order list and single order should match the fixture
