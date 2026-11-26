@ProfileApi @api @regression
Feature: Profile API
  Scenario: Account deletion requires authentication and password confirmation
    When I delete an account without authentication
    Then account deletion should return unauthorized
    Given I am authenticated for the API as a disposable customer
    When I delete the account using the wrong password
    Then account deletion should reject password confirmation
    When I delete the account using the correct password
    Then the account should be deleted and unable to log in
