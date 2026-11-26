@PaymentDev @regression @payment
Feature: Stripe payment
  @mail
  Scenario: A new user can complete a successful card payment through Stripe Checkout
    Given I open the signup page
    When I sign up with a unique email and password "StrongPass123A"
    Then signup should ask me to verify my email
    When I verify the generated email through the delivered message
    And I log in with the generated email and password "StrongPass123A"
    Then I should be authenticated on the products page
    When I add a "Shirts" product to the cart
    And I view the cart from the drawer
    Then the cart should show the correct subtotal and flat shipping fee
    When I review checkout
    And I add the new customer's shipping address
    And I start a verified test-mode Stripe Checkout session
    And I pay using the successful Stripe test card
    Then the webhook should create a paid order and invoice link
    And the delivered invoice should match the order and its PDF

  @BrowserbackCancel
  Scenario: A user can cancel Stripe Checkout through Browser Back button and return to the cart review
    Given I am a verified disposable customer
    And I have a saved shipping address
    When I add a "Shirts" product to the cart
    And I view the cart from the drawer
    Then the cart should show the correct subtotal and flat shipping fee
    When I review checkout
    And I start a verified test-mode Stripe Checkout session
    And I cancel Stripe using "Browser Back"
    Then I should return to the unchanged cart without a payment

  @OnpagebackCancel
  Scenario: A user can cancel Stripe Checkout through Back button on the Stripe Checkout page and return to the cart review
    Given I am a verified disposable customer
    And I have a saved shipping address
    When I add a "Shirts" product to the cart
    And I view the cart from the drawer
    Then the cart should show the correct subtotal and flat shipping fee
    When I review checkout
    And I start a verified test-mode Stripe Checkout session
    And I cancel Stripe using "Stripe Back"
    Then I should return to the unchanged cart without a payment
