@smoke @production-safe
Feature: Production storefront smoke
  Background:
    Given I browse the public product catalog

  Scenario: Customers can browse the catalog and its product photos
    Then the catalog should display products with loaded photos

  Scenario: Customers can inspect a listed product
    When I open a listed product
    Then the product detail should display its name and generic brand

  Scenario: Customers can read shipping and returns terms
    When I open the shipping and returns policy
    Then the shipping and returns policy should be available
