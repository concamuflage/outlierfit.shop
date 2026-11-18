package com.asianfit.api.support;

import com.asianfit.ui.utils.TestConfig;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.http.Cookies;
import io.restassured.response.Response;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.mindrot.jbcrypt.BCrypt;
import org.testng.Assert;

/**
 * Shared API and database helpers for order-related UI/API integration tests.
 *
 * <p>This class centralizes authentication, profile/cart/order API calls, Stripe webhook fixtures,
 * and direct database fixture setup/cleanup used by RestAssured tests.
 * Domestic delivery adds one flat $8.95 fee without a shipping-rate table.
 * Retail fixtures use recorded USD prices, e.g. two $49.90 shirts subtotal $99.80.
 */
public final class OrdersApiSupport {

  private OrdersApiSupport() {}

  /** Configures RestAssured to target the application under test. */
  public static void configureBaseUri() {
    RestAssured.baseURI = TestConfig.baseUrl();
  }

  /**
   * Logs in the configured test user through NextAuth and returns the session cookies needed for
   * authenticated API requests.
   */
  public static Cookies authenticate() {
    return authenticate(TestConfig.testUserEmail(), TestConfig.testUserPassword());
  }

  /**
   * Logs in a specific user through NextAuth and returns authenticated session cookies.
   */
  public static Cookies authenticate(String email, String password) {
    // Ask NextAuth for a CSRF token before submitting credentials.
    Response csrfResponse = RestAssured
      .given()
      // Do not automatically follow HTTP redirects. Why?
      .redirects()
      .follow(false)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("auth.csrf"));

    // The CSRF endpoint must be reachable before login can proceed.
    csrfResponse.then().statusCode(200);

    // Extract and validate the token that must be echoed back in the credentials request.
    String csrfToken = csrfResponse.jsonPath().getString("csrfToken");
    Assert.assertTrue(csrfToken != null && !csrfToken.isBlank(), "Expected a CSRF token from NextAuth");

    // Preserve cookies from the CSRF response because NextAuth expects them on the login request.
    // NextAuth needs both the CSRF token in the request body and the matching CSRF cookie to validate the login attempt,
    Cookies cookies = csrfResponse.getDetailedCookies();

    // Submit the configured test user's email/password to the credentials provider.
    Response loginResponse = RestAssured
      .given()
      .cookies(cookies)
      .contentType("application/x-www-form-urlencoded; charset=UTF-8")
      .accept(ContentType.JSON)
      .formParam("csrfToken", csrfToken)
      .formParam("email", email)
      .formParam("password", password)
      .formParam("callbackUrl", TestConfig.baseUrl() + "/products")
      .formParam("json", "true")
      .post(ApiEndpoints.path("auth.credentials"));

    // NextAuth can respond with either JSON success or a redirect depending on configuration.
    int loginStatus = loginResponse.statusCode();
    Assert.assertTrue(
      loginStatus == 200 || loginStatus == 302,
      "Expected NextAuth login to succeed, but got status " + loginStatus
    );

    // Capture the authenticated session cookies returned by the login response.
    Cookies sessionCookies = loginResponse.getDetailedCookies();

    // Verify the returned cookies really represent a logged-in session for the expected test user.
    Response sessionResponse = RestAssured
      .given()
      .cookies(sessionCookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("auth.session"));

    sessionResponse.then().statusCode(200);
    Assert.assertEquals(sessionResponse.jsonPath().getString("user.email").toLowerCase(), email.toLowerCase());
    // Return only the authenticated cookies so callers can reuse them for protected API calls.
    return sessionCookies;
  }

  public static Response deleteCurrentAccountWithoutAuthentication(String password) {
    return RestAssured
      .given()
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of("password", password))
      .delete(ApiEndpoints.path("account.current"));
  }

  public static Response deleteCurrentAccount(Cookies cookies, String password) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of("password", password))
      .delete(ApiEndpoints.path("account.current"));
  }

  public static Response loginThroughBackend(String email, String password) {
    return RestAssured
      .given()
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of("email", email, "password", password))
      .post("/backend/auth/login");
  }

  public static DisposableAccount createVerifiedDisposableAccount() throws SQLException {
    long suffix = System.currentTimeMillis();
    String email = "api-delete-" + suffix + "@example.com";
    String password = "StrongPass123A";
    String passwordHash = BCrypt.hashpw(password, BCrypt.gensalt(10));

    try (
      Connection connection = openConnection();
      PreparedStatement deleteExisting = connection.prepareStatement("DELETE FROM users WHERE email = ?");
      PreparedStatement insertUser = connection.prepareStatement(
        """
          INSERT INTO users (
            email,
            password_hash,
            first_name,
            last_name,
            email_verified,
            email_verification_token,
            email_verification_expires
          )
          VALUES (?, ?, 'API', 'Delete', TRUE, NULL, NULL)
          RETURNING id
        """
      )
    ) {
      deleteExisting.setString(1, email);
      deleteExisting.executeUpdate();

      insertUser.setString(1, email);
      insertUser.setString(2, passwordHash);
      try (ResultSet resultSet = insertUser.executeQuery()) {
        if (!resultSet.next()) {
          throw new IllegalStateException("Failed to create disposable account.");
        }
        return new DisposableAccount(resultSet.getInt("id"), email, password);
      }
    }
  }

  /** Retrieves the current authenticated user's profile payload. */
  public static Response retrieveProfile(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("profile.current"));
  }

  /** Saves the measurement section of the current user's profile. */
  public static Response saveMeasurement(Cookies cookies, MeasurementSnapshot measurement) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of(
        "section", "measurement",
        "measurement", Map.of(
          "heightCm", measurement.heightCm() == null ? "" : measurement.heightCm().toPlainString(),
          "chestCm", measurement.chestCm() == null ? "" : measurement.chestCm().toPlainString(),
          "sleeveLengthCm", measurement.sleeveLengthCm() == null ? "" : measurement.sleeveLengthCm().toPlainString()
        )
      ))
      .post(ApiEndpoints.path("profile.current"));
  }

  /** Copies the user's default shipping address into the billing address section. */
  public static Response copyDefaultShippingAddressToBilling(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of("section", "billing-from-shipping"))
      .post(ApiEndpoints.path("profile.current"));
  }

  /** Creates or updates a profile address for the supplied address type. */
  public static Response saveAddress(Cookies cookies, String addressType, AddressPayload address) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of(
        "section", "address",
        "addressType", addressType,
        "address", Map.of(
          "name", address.name(),
          "street", address.street(),
          "city", address.city(),
          "state", address.state(),
          "zipCode", address.zipCode(),
          "country", address.country(),
          "phone", address.phone()
        )
      ))
      .post(ApiEndpoints.path("profile.current"));
  }

  /** Deletes an address from the current user's profile. */
  public static Response deleteAddress(Cookies cookies, int addressId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of("addressId", addressId))
      .delete(ApiEndpoints.path("profile.current"));
  }

  /** Retrieves the current user's cart. */
  public static Response retrieveCart(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("cart.current"));
  }

  /** Replaces the current user's cart with the product, shipping, and address data from the fixture. */
  public static Response saveCart(Cookies cookies, CheckoutFixture fixture) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of(
        "items", new Object[] {
          Map.of("id", fixture.variant().cartItemId(), "qty", fixture.variant().quantity())
        },
        "shippingAddressId", fixture.shippingAddressId(),
        "billingAddressId", fixture.billingAddressId()
      ))
      .put(ApiEndpoints.path("cart.current"));
  }

  /** Clears all cart items for the current user through the cart API. */
  public static Response clearCart(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of("items", new Object[0]))
      .put(ApiEndpoints.path("cart.current"));
  }

  /** Submits the domestic mock payload, e.g. shippingMethod="USPS" and shippingUsd=8.95. */
  public static Response submitMockPayment(Cookies cookies, CheckoutFixture fixture) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of(
        "subtotalUsd", fixture.variant().subtotalUsd(),
        "shippingUsd", fixture.shipping().shippingUsd(),
        "shippingMethod", fixture.shipping().mode(),
        "totalUsd", fixture.variant().subtotalUsd().add(fixture.shipping().shippingUsd()),
        "shippingAddressId", fixture.shippingAddressId(),
        "billingAddressId", fixture.billingAddressId(),
        "items", new Object[] {
          Map.of(
            "cartItemId", fixture.variant().cartItemId(),
            "quantity", fixture.variant().quantity(),
            "unitPriceUsd", fixture.variant().unitPriceUsd()
          )
        }
      ))
      .post(ApiEndpoints.path("orders.mockPayment"));
  }

  /** Retrieves all orders visible to the current user. */
  public static Response retrieveAllOrders(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("orders.list"));
  }

  /** Retrieves a single order by id for the current user. */
  public static Response retrieveSingleOrder(Cookies cookies, long orderId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("orders.single", Map.of("orderId", String.valueOf(orderId))));
  }

  /** Retrieves the JSON payload used to generate an invoice for an order. */
  public static Response retrieveInvoicePayload(Cookies cookies, long orderId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("orders.invoicePayload", Map.of("orderId", String.valueOf(orderId))));
  }

  /** Retrieves a previously generated invoice PDF for an order. */
  public static Response retrieveInvoicePdf(Cookies cookies, long orderId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept("*/*")
      .get(ApiEndpoints.path("orders.invoicePdf", Map.of("orderId", String.valueOf(orderId))));
  }

  /** Generates an invoice PDF from the invoice payload response body. */
  public static Response generateInvoicePdf(Cookies cookies, Response invoicePayloadResponse) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept("*/*")
      .body(invoicePayloadResponse.asString())
      .post(ApiEndpoints.path("invoice.generatePdf"));
  }

  /** Posts a Stripe webhook payload signed with the configured test webhook secret. */
  public static Response postSignedStripeWebhook(String payload) {
    long timestamp = Instant.now().getEpochSecond();
    String signature = signStripeWebhookPayload(timestamp, payload);
    return RestAssured
      .given()
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .header("stripe-signature", "t=" + timestamp + ",v1=" + signature)
      .body(payload)
      .post(ApiEndpoints.path("stripe.webhook"));
  }

  /**
   * Loads the database-backed checkout fixture used by order and payment tests.
   *
   * <p>The fixture contains the test user, default addresses, first shipping row, and first
   * invoice-ready product variant.
   */
  public static CheckoutFixture loadCheckoutFixture() throws SQLException {
    // Open one database connection for all fixture lookups so the returned data is internally consistent.
    try (Connection connection = openConnection()) {
      // Resolve the configured test user's database id from their email address.
      int userId = getRequiredInt(
        connection,
        "SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1",
        TestConfig.testUserEmail()
      );
      // Use the user's default shipping address, falling back to the lowest address id when needed.
      int shippingAddressId = getRequiredInt(
        connection,
        """
          SELECT address_id
          FROM user_addresses
          WHERE user_id = ?
            AND address_type = 'shipping'
          ORDER BY is_default DESC, address_id ASC
          LIMIT 1
        """,
        userId
      );
      // Billing address is optional for some test profiles, so load it only when present.
      Integer billingAddressId = getOptionalInt(
        connection,
        """
          SELECT address_id
          FROM user_addresses
          WHERE user_id = ?
            AND address_type = 'billing'
          ORDER BY is_default DESC, address_id ASC
          LIMIT 1
        """,
        userId
      );

      // Build a complete checkout fixture; when billing is missing, reuse shipping as the billing address.
      return new CheckoutFixture(
        userId,
        TestConfig.testUserEmail(),
        shippingAddressId,
        billingAddressId != null ? billingAddressId : shippingAddressId,
        getShippingRow(connection),
        getVariantRow(connection)
      );
    }
  }

  /** Inserts a paid order fixture directly into the database and returns its expected values. */
  public static OrderFixture insertOrderFixture() throws SQLException {
    CheckoutFixture checkoutFixture = loadCheckoutFixture();
    try (Connection connection = openConnection()) {
      String invoiceNumber = "API-TEST-" + System.currentTimeMillis();
      Timestamp now = Timestamp.from(Instant.now());

      long orderId;
      try (
        PreparedStatement insertOrder = connection.prepareStatement(
          """
            INSERT INTO orders (
              user_id,
              shipment_status,
              payment_status,
              payment_provider,
              payment_reference,
              paid_at,
              currency_code,
              subtotal_usd,
              shipping_usd,
              total_usd,
              shipping_method,
              invoice_number,
              invoice_generated_at,
              created_at,
              updated_at,
              shipping_address_id,
              billing_address_id
            )
            VALUES (?, 'unshipped', 'paid', 'rest-assured', ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          """,
          Statement.RETURN_GENERATED_KEYS
        )
      ) {
        insertOrder.setInt(1, checkoutFixture.userId());
        insertOrder.setString(2, "rest-assured-" + System.currentTimeMillis());
        insertOrder.setTimestamp(3, now);
        insertOrder.setBigDecimal(4, checkoutFixture.variant().subtotalUsd());
        insertOrder.setBigDecimal(5, checkoutFixture.shipping().shippingUsd());
        insertOrder.setBigDecimal(
          6,
          checkoutFixture.variant().subtotalUsd().add(
            checkoutFixture.shipping().shippingUsd()
          )
        );
        insertOrder.setString(7, "USPS");
        insertOrder.setString(8, invoiceNumber);
        insertOrder.setTimestamp(9, now);
        insertOrder.setTimestamp(10, now);
        insertOrder.setTimestamp(11, now);
        insertOrder.setInt(12, checkoutFixture.shippingAddressId());
        insertOrder.setInt(13, checkoutFixture.billingAddressId());
        insertOrder.executeUpdate();

        try (ResultSet generatedKeys = insertOrder.getGeneratedKeys()) {
          if (!generatedKeys.next()) {
            throw new IllegalStateException("Expected generated order id");
          }
          orderId = generatedKeys.getLong(1);
        }
      }

      try (
        PreparedStatement insertOrderVariant = connection.prepareStatement(
          """
            INSERT INTO orders_variants (order_id, variant_id, quantity, snapshot_price)
            VALUES (?, ?, ?, ?)
          """
        )
      ) {
        insertOrderVariant.setLong(1, orderId);
        insertOrderVariant.setInt(2, checkoutFixture.variant().variantId());
        insertOrderVariant.setInt(3, checkoutFixture.variant().quantity());
        insertOrderVariant.setBigDecimal(4, checkoutFixture.variant().unitPriceUsd());
        insertOrderVariant.executeUpdate();
      }

      return createOrderFixture(orderId, invoiceNumber, checkoutFixture);
    }
  }

  /** Deletes an order fixture when one was created. */
  public static void deleteOrderFixture(OrderFixture fixture) throws SQLException {
    if (fixture != null) {
      deleteOrderById(fixture.orderId());
    }
  }

  /** Deletes an order by id from the database. */
  public static void deleteOrderById(long orderId) throws SQLException {
    try (
      Connection connection = openConnection();
      PreparedStatement deleteOrder = connection.prepareStatement("DELETE FROM orders WHERE id = ?")
    ) {
      deleteOrder.setLong(1, orderId);
      deleteOrder.executeUpdate();
    }
  }

  /** Captures the current user's measurement state so tests can restore it later. */
  public static MeasurementSnapshot loadMeasurementSnapshot() throws SQLException {
    try (Connection connection = openConnection()) {
      int userId = getRequiredInt(
        connection,
        "SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1",
        TestConfig.testUserEmail()
      );

      try (
        PreparedStatement statement = connection.prepareStatement(
          """
            SELECT m.id, m.height_cm, m.chest_cm, m.sleeve_length_cm
            FROM user_measurement um
            JOIN measurements m ON m.id = um.measurement_id
            WHERE um.user_id = ?
            ORDER BY um.is_default DESC, m.id ASC
            LIMIT 1
          """
        )
      ) {
        statement.setInt(1, userId);
        try (ResultSet resultSet = statement.executeQuery()) {
          if (!resultSet.next()) {
            return new MeasurementSnapshot(null, null, null, null, false);
          }

          return new MeasurementSnapshot(
            resultSet.getInt("id"),
            resultSet.getBigDecimal("height_cm"),
            resultSet.getBigDecimal("chest_cm"),
            resultSet.getBigDecimal("sleeve_length_cm"),
            true
          );
        }
      }
    }
  }

  /** Restores the current user's measurement state from a previously captured snapshot. */
  public static void restoreMeasurementSnapshot(MeasurementSnapshot snapshot) throws SQLException {
    if (snapshot == null) {
      return;
    }

    try (Connection connection = openConnection()) {
      int userId = getRequiredInt(
        connection,
        "SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1",
        TestConfig.testUserEmail()
      );

      Integer currentMeasurementId = getOptionalInt(
        connection,
        """
          SELECT measurement_id
          FROM user_measurement
          WHERE user_id = ?
          ORDER BY is_default DESC, measurement_id ASC
          LIMIT 1
        """,
        userId
      );

      if (!snapshot.existed()) {
        if (currentMeasurementId != null) {
          try (PreparedStatement deleteLink = connection.prepareStatement(
              "DELETE FROM user_measurement WHERE user_id = ? AND measurement_id = ?"
            );
            PreparedStatement deleteMeasurement = connection.prepareStatement(
              "DELETE FROM measurements WHERE id = ?"
            )
          ) {
            deleteLink.setInt(1, userId);
            deleteLink.setInt(2, currentMeasurementId);
            deleteLink.executeUpdate();
            deleteMeasurement.setInt(1, currentMeasurementId);
            deleteMeasurement.executeUpdate();
          }
        }
        return;
      }

      if (currentMeasurementId != null) {
        try (PreparedStatement updateMeasurement = connection.prepareStatement(
            """
              UPDATE measurements
              SET height_cm = ?, chest_cm = ?, sleeve_length_cm = ?
              WHERE id = ?
            """
          )
        ) {
          updateMeasurement.setBigDecimal(1, snapshot.heightCm());
          updateMeasurement.setBigDecimal(2, snapshot.chestCm());
          updateMeasurement.setBigDecimal(3, snapshot.sleeveLengthCm());
          updateMeasurement.setInt(4, currentMeasurementId);
          updateMeasurement.executeUpdate();
        }
      } else {
        int newMeasurementId;
        try (
          PreparedStatement insertMeasurement = connection.prepareStatement(
            """
              INSERT INTO measurements (height_cm, chest_cm, sleeve_length_cm)
              VALUES (?, ?, ?)
            """,
            Statement.RETURN_GENERATED_KEYS
          )
        ) {
          insertMeasurement.setBigDecimal(1, snapshot.heightCm());
          insertMeasurement.setBigDecimal(2, snapshot.chestCm());
          insertMeasurement.setBigDecimal(3, snapshot.sleeveLengthCm());
          insertMeasurement.executeUpdate();
          try (ResultSet generatedKeys = insertMeasurement.getGeneratedKeys()) {
            if (!generatedKeys.next()) {
              throw new IllegalStateException("Expected generated measurement id");
            }
            newMeasurementId = generatedKeys.getInt(1);
          }
        }

        try (PreparedStatement insertLink = connection.prepareStatement(
            """
              INSERT INTO user_measurement (user_id, measurement_id, is_default)
              VALUES (?, ?, true)
            """
          )
        ) {
          insertLink.setInt(1, userId);
          insertLink.setInt(2, newMeasurementId);
          insertLink.executeUpdate();
        }
      }
    }
  }

  /** Deletes an address fixture and its user-address link when an address id is available. */
  public static void deleteAddressFixture(Integer addressId) throws SQLException {
    if (addressId == null) {
      return;
    }

    try (Connection connection = openConnection()) {
      int userId = getRequiredInt(
        connection,
        "SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1",
        TestConfig.testUserEmail()
      );

      try (
        PreparedStatement deleteLink = connection.prepareStatement(
          "DELETE FROM user_addresses WHERE user_id = ? AND address_id = ?"
        );
        PreparedStatement deleteAddress = connection.prepareStatement(
          "DELETE FROM addresses WHERE id = ?"
        )
      ) {
        deleteLink.setInt(1, userId);
        deleteLink.setInt(2, addressId);
        deleteLink.executeUpdate();
        deleteAddress.setInt(1, addressId);
        deleteAddress.executeUpdate();
      }
    }
  }

  /** Clears the current test user's cart directly in the database. */
  public static void clearCartForCurrentUser() throws SQLException {
    try (Connection connection = openConnection()) {
      int userId = getRequiredInt(
        connection,
        "SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1",
        TestConfig.testUserEmail()
      );
      try (PreparedStatement deleteCart = connection.prepareStatement("DELETE FROM carts WHERE user_id = ?")) {
        deleteCart.setInt(1, userId);
        deleteCart.executeUpdate();
      }
    }
  }

  /** Builds an expected order fixture from a successful mock-payment response. */
  public static OrderFixture createOrderFixtureFromMockPayment(
    CheckoutFixture checkoutFixture,
    long orderId,
    String invoiceNumber
  ) {
    return createOrderFixture(orderId, invoiceNumber, checkoutFixture);
  }

  /** Creates the expected order values shared by direct DB and mock-payment fixtures. */
  private static OrderFixture createOrderFixture(long orderId, String invoiceNumber, CheckoutFixture fixture) {
    BigDecimal shippingUsd = fixture.shipping().shippingUsd();
    BigDecimal totalUsd = fixture.variant().subtotalUsd().add(shippingUsd);
    return new OrderFixture(
      orderId,
      invoiceNumber,
      fixture.shipping().mode(),
      fixture.shippingAddressId(),
      fixture.billingAddressId(),
      fixture.variant().productId(),
      fixture.variant().variantId(),
      fixture.variant().quantity(),
      fixture.variant().productName(),
      fixture.variant().color(),
      fixture.variant().size(),
      fixture.variant().unitPriceUsd(),
      fixture.variant().subtotalUsd(),
      shippingUsd,
      totalUsd,
      fixture.customerEmail()
    );
  }

  /** Inserts a Stripe Checkout Session fixture with the checkout payload your webhook handler expects. */
  public static void createStripeCheckoutSessionFixture(String stripeSessionId, CheckoutFixture fixture) throws SQLException {
    try (Connection connection = openConnection()) {
      try (PreparedStatement deleteExisting = connection.prepareStatement(
          "DELETE FROM stripe_checkout_sessions WHERE stripe_session_id = ?"
        );
        PreparedStatement insertSession = connection.prepareStatement(
          """
            INSERT INTO stripe_checkout_sessions (
              stripe_session_id,
              user_id,
              payload,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?::jsonb, NOW(), NOW())
          """
        )
      ) {
        deleteExisting.setString(1, stripeSessionId);
        deleteExisting.executeUpdate();
        insertSession.setString(1, stripeSessionId);
        insertSession.setInt(2, fixture.userId());
        insertSession.setString(3, checkoutPayloadJson(fixture));
        insertSession.executeUpdate();
      }
    }
  }

  /** Finds the order id linked to a Stripe Checkout Session fixture, if one exists. */
  public static Long findOrderIdForStripeCheckoutSession(String stripeSessionId) throws SQLException {
    try (Connection connection = openConnection()) {
      try (PreparedStatement statement = connection.prepareStatement(
          "SELECT order_id FROM stripe_checkout_sessions WHERE stripe_session_id = ? LIMIT 1"
        )
      ) {
        statement.setString(1, stripeSessionId);
        try (ResultSet resultSet = statement.executeQuery()) {
          if (!resultSet.next()) {
            return null;
          }
          long orderId = resultSet.getLong(1);
          return resultSet.wasNull() ? null : orderId;
        }
      }
    }
  }

  /** Counts orders created for a Stripe Checkout Session payment reference. */
  public static int countOrdersForStripeCheckoutSession(String stripeSessionId) throws SQLException {
    try (Connection connection = openConnection()) {
      try (PreparedStatement statement = connection.prepareStatement(
          "SELECT COUNT(*) FROM orders WHERE payment_provider = 'stripe' AND payment_reference = ?"
        )
      ) {
        statement.setString(1, stripeSessionId);
        try (ResultSet resultSet = statement.executeQuery()) {
          resultSet.next();
          return resultSet.getInt(1);
        }
      }
    }
  }

  /** Retrieves the stored payment status for a Stripe PaymentIntent id. */
  public static String getStripePaymentStatus(String stripePaymentIntentId) throws SQLException {
    try (Connection connection = openConnection()) {
      try (PreparedStatement statement = connection.prepareStatement(
          "SELECT status FROM payments WHERE stripe_payment_intent_id = ? LIMIT 1"
        )
      ) {
        statement.setString(1, stripePaymentIntentId);
        try (ResultSet resultSet = statement.executeQuery()) {
          if (!resultSet.next()) {
            return null;
          }
          return resultSet.getString(1);
        }
      }
    }
  }

  /** Counts stored Stripe webhook event rows for idempotency assertions. */
  public static int countStripeWebhookEvents(String stripeEventId) throws SQLException {
    try (Connection connection = openConnection()) {
      try (PreparedStatement statement = connection.prepareStatement(
          "SELECT COUNT(*) FROM stripe_webhook_events WHERE stripe_event_id = ?"
        )
      ) {
        statement.setString(1, stripeEventId);
        try (ResultSet resultSet = statement.executeQuery()) {
          resultSet.next();
          return resultSet.getInt(1);
        }
      }
    }
  }

  /** Retrieves an order's invoice number from the database. */
  public static String getOrderInvoiceNumber(long orderId) throws SQLException {
    try (Connection connection = openConnection()) {
      try (PreparedStatement statement = connection.prepareStatement(
          "SELECT invoice_number FROM orders WHERE id = ? LIMIT 1"
        )
      ) {
        statement.setLong(1, orderId);
        try (ResultSet resultSet = statement.executeQuery()) {
          if (!resultSet.next()) {
            return null;
          }
          return resultSet.getString(1);
        }
      }
    }
  }

  /** Returns whether a stored Stripe webhook event has been marked as processed. */
  public static boolean stripeWebhookEventProcessed(String stripeEventId) throws SQLException {
    try (Connection connection = openConnection()) {
      try (PreparedStatement statement = connection.prepareStatement(
          "SELECT processed_at IS NOT NULL FROM stripe_webhook_events WHERE stripe_event_id = ? LIMIT 1"
        )
      ) {
        statement.setString(1, stripeEventId);
        try (ResultSet resultSet = statement.executeQuery()) {
          if (!resultSet.next()) {
            return false;
          }
          return resultSet.getBoolean(1);
        }
      }
    }
  }

  /** Cleans up Stripe webhook, payment, and checkout-session fixture data from the database. */
  public static void deleteStripeWebhookFixture(
    String stripeSessionId,
    String stripePaymentIntentId,
    String... stripeEventIds
  ) throws SQLException {
    try (Connection connection = openConnection()) {
      if (stripeEventIds != null) {
        for (String stripeEventId : stripeEventIds) {
          if (stripeEventId == null || stripeEventId.isBlank()) {
            continue;
          }
          try (PreparedStatement deleteEvent = connection.prepareStatement(
              "DELETE FROM stripe_webhook_events WHERE stripe_event_id = ?"
            )
          ) {
            deleteEvent.setString(1, stripeEventId);
            deleteEvent.executeUpdate();
          }
        }
      }

      if (stripePaymentIntentId != null && !stripePaymentIntentId.isBlank()) {
        try (PreparedStatement deletePayment = connection.prepareStatement(
            "DELETE FROM payments WHERE stripe_payment_intent_id = ?"
          )
        ) {
          deletePayment.setString(1, stripePaymentIntentId);
          deletePayment.executeUpdate();
        }
      }

      if (stripeSessionId != null && !stripeSessionId.isBlank()) {
        try (PreparedStatement clearOrderLink = connection.prepareStatement(
            "UPDATE stripe_checkout_sessions SET order_id = NULL, completed_at = NULL, updated_at = NOW() WHERE stripe_session_id = ?"
          );
          PreparedStatement deleteSession = connection.prepareStatement(
            "DELETE FROM stripe_checkout_sessions WHERE stripe_session_id = ?"
          )
        ) {
          clearOrderLink.setString(1, stripeSessionId);
          clearOrderLink.executeUpdate();
          deleteSession.setString(1, stripeSessionId);
          deleteSession.executeUpdate();
        }
      }
    }
  }

  /** Opens a JDBC connection using the configured test database credentials. */
  private static Connection openConnection() throws SQLException {
    return DriverManager.getConnection(
      TestConfig.databaseUrl(),
      TestConfig.databaseUser(),
      TestConfig.databasePassword()
    );
  }

  /** Runs a scalar query that must return a long-compatible value. */
  private static long getRequiredLong(Connection connection, String sql, Object... params) throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement(sql)) {
      bindParams(statement, params);
      try (ResultSet resultSet = statement.executeQuery()) {
        if (!resultSet.next()) {
          throw new IllegalStateException("Required test data is missing for query: " + sql);
        }
        return resultSet.getLong(1);
      }
    }
  }

  /** Runs a scalar query that must return an int-compatible value. */
  private static int getRequiredInt(Connection connection, String sql, Object... params) throws SQLException {
    return Math.toIntExact(getRequiredLong(connection, sql, params));
  }

  /** Runs a scalar query that may return an int-compatible value. */
  private static Integer getOptionalInt(Connection connection, String sql, Object... params) throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement(sql)) {
      bindParams(statement, params);
      try (ResultSet resultSet = statement.executeQuery()) {
        if (!resultSet.next()) {
          return null;
        }
        return resultSet.getInt(1);
      }
    }
  }

  /** Supplies the domestic delivery fixture without reading a retired rate table. */
  private static ShippingRow getShippingRow(Connection connection) {
    return new ShippingRow("USPS");
  }

  /** Loads recorded USD prices for domestic checkout, e.g. $49.90 for SKU 9653. */
  private static VariantFixture getVariantRow(Connection connection) throws SQLException {
    try (
      PreparedStatement statement = connection.prepareStatement(
        """
          SELECT
            p.id AS product_id,
            pv.id AS variant_id,
            pv.price_usd,
            p.name AS product_name,
            c.color,
            s.size,
            pvi.image_link
          FROM product_variants pv
          JOIN products p
            ON p.id = pv.product_id
          JOIN colors c
            ON c.id = pv.color_id
          LEFT JOIN sizes s
            ON s.id = pv.size_id
          LEFT JOIN LATERAL (
            SELECT image_link
            FROM product_variant_images
            WHERE product_variant_id = pv.id
            ORDER BY id ASC
            LIMIT 1
          ) pvi ON true
          WHERE pv.price_usd > 0
          ORDER BY pv.id ASC
          LIMIT 1
        """
      );
      ResultSet resultSet = statement.executeQuery()
    ) {
      if (!resultSet.next()) {
        throw new IllegalStateException("No invoice-ready product variant rows exist for the API test fixture");
      }

      int quantity = 2;
      BigDecimal unitPriceUsd = resultSet.getBigDecimal("price_usd");
      int productId = resultSet.getInt("product_id");
      int variantId = resultSet.getInt("variant_id");
      return new VariantFixture(
        productId,
        variantId,
        productId + "-" + variantId,
        quantity,
        resultSet.getString("product_name"),
        resultSet.getString("color"),
        resultSet.getString("size"),
        unitPriceUsd,
        unitPriceUsd.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP),
        resultSet.getString("image_link")
      );
    }
  }

  /** Binds positional parameters to a prepared statement. */
  private static void bindParams(PreparedStatement statement, Object... params) throws SQLException {
    for (int index = 0; index < params.length; index++) {
      statement.setObject(index + 1, params[index]);
    }
  }


  /** Creates the HMAC-SHA256 signature Stripe expects in test webhook requests. */
  private static String signStripeWebhookPayload(long timestamp, String payload) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(TestConfig.stripeWebhookSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] digest = mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (Exception error) {
      throw new IllegalStateException("Unable to sign Stripe webhook payload.", error);
    }
  }

  /** Serializes the checkout fixture into the JSON payload stored with a Stripe Checkout Session. */
  private static String checkoutPayloadJson(CheckoutFixture fixture) {
    BigDecimal shippingUsd = fixture.shipping().shippingUsd();
    BigDecimal totalUsd = fixture.variant().subtotalUsd().add(shippingUsd);
    return """
      {
        "subtotalUsd": %s,
        "shippingUsd": %s,
        "totalUsd": %s,
        "shippingMethod": "USPS",
        "shippingAddressId": %d,
        "billingAddressId": %d,
        "items": [
          {
            "cartItemId": "%s",
            "quantity": %d,
            "unitPriceUsd": %s
          }
        ]
      }
      """
      .formatted(
        fixture.variant().subtotalUsd().toPlainString(),
        shippingUsd.toPlainString(),
        totalUsd.toPlainString(),
        fixture.shippingAddressId(),
        fixture.billingAddressId(),
        jsonEscape(fixture.variant().cartItemId()),
        fixture.variant().quantity(),
        fixture.variant().unitPriceUsd().toPlainString()
      );
  }

  /** Escapes a Java string for safe insertion into the small hand-built JSON fixture. */
  private static String jsonEscape(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  /** Domestic shipping fixture: one $8.95 fee per order, independent of item weight. */
  public record ShippingRow(String mode) {
    /** Returns the provisional flat US fee, e.g. 8.95 for one or several items. */
    public BigDecimal shippingUsd() {
      return new BigDecimal("8.95");
    }
  }

  /** Product variant fixture data used to populate carts, orders, and invoice expectations. */
  public record VariantFixture(
    int productId,
    int variantId,
    String cartItemId,
    int quantity,
    String productName,
    String color,
    String size,
    BigDecimal unitPriceUsd,
    BigDecimal subtotalUsd,
    String imageUrl
  ) {}

  /** Complete checkout fixture combining user, address, shipping, and product variant data. */
  public record CheckoutFixture(
    int userId,
    String customerEmail,
    int shippingAddressId,
    int billingAddressId,
    ShippingRow shipping,
    VariantFixture variant
  ) {}

  /** Expected persisted order values used by order and invoice assertions. */
  public record OrderFixture(
    long orderId,
    String invoiceNumber,
    String shippingMode,
    int shippingAddressId,
    int billingAddressId,
    int productId,
    int variantId,
    int quantity,
    String productName,
    String color,
    String size,
    BigDecimal unitPriceUsd,
    BigDecimal subtotalUsd,
    BigDecimal shippingUsd,
    BigDecimal totalUsd,
    String customerEmail
  ) {}

  /** Address request payload used by profile-address API helpers. */
  public record AddressPayload(
    String name,
    String street,
    String city,
    String state,
    String zipCode,
    String country,
    String phone
  ) {}

  /** Snapshot of measurement data so tests can restore pre-existing user state. */
  public record MeasurementSnapshot(
    Integer measurementId,
    BigDecimal heightCm,
    BigDecimal chestCm,
    BigDecimal sleeveLengthCm,
    boolean existed
  ) {}

  public record DisposableAccount(
    int userId,
    String email,
    String password
  ) {}
}
