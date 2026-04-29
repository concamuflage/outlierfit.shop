@ProfileApi@Regression
Feature: Profile API

  Scenario: Authenticated user can retrieve and update profile information
    Given I am authenticated for the orders API
    And I remember the current default measurement
    And a checkout fixture is available
    When I retrieve the current profile
    Then the profile response should include the current user
    When I save a new default measurement
    Then the profile response should include the saved measurement
    When I copy the default shipping address to billing
    Then the profile response should include at least one billing address
    When I save a new billing address
    Then the profile response should include the new billing address
    When I delete the new billing address
    Then the profile response should no longer include the deleted billing address
