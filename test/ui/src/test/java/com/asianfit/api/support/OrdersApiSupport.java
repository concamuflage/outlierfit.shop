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
import org.testng.Assert;

public final class OrdersApiSupport {
  private static final BigDecimal RMB_TO_USD = BigDecimal.valueOf(0.14);

  private OrdersApiSupport() {}

  public static void configureBaseUri() {
    RestAssured.baseURI = TestConfig.baseUrl();
  }

  public static Cookies authenticate() {
    Response csrfResponse = RestAssured
      .given()
      .redirects()
      .follow(false)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("auth.csrf"));

    csrfResponse.then().statusCode(200);

    String csrfToken = csrfResponse.jsonPath().getString("csrfToken");
    Assert.assertTrue(csrfToken != null && !csrfToken.isBlank(), "Expected a CSRF token from NextAuth");

    Cookies cookies = csrfResponse.getDetailedCookies();

    Response loginResponse = RestAssured
      .given()
      .cookies(cookies)
      .contentType("application/x-www-form-urlencoded; charset=UTF-8")
      .accept(ContentType.JSON)
      .formParam("csrfToken", csrfToken)
      .formParam("email", TestConfig.testUserEmail())
      .formParam("password", TestConfig.testUserPassword())
      .formParam("callbackUrl", TestConfig.baseUrl() + "/products")
      .formParam("json", "true")
      .post(ApiEndpoints.path("auth.credentials"));

    int loginStatus = loginResponse.statusCode();
    Assert.assertTrue(
      loginStatus == 200 || loginStatus == 302,
      "Expected NextAuth login to succeed, but got status " + loginStatus
    );

    Cookies sessionCookies = loginResponse.getDetailedCookies();

    Response sessionResponse = RestAssured
      .given()
      .cookies(sessionCookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("auth.session"));

    sessionResponse.then().statusCode(200);
    Assert.assertEquals(sessionResponse.jsonPath().getString("user.email"), TestConfig.testUserEmail());
    return sessionCookies;
  }

  public static Response retrieveProfile(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("profile.current"));
  }

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

  public static Response copyDefaultShippingAddressToBilling(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of("section", "billing-from-shipping"))
      .post(ApiEndpoints.path("profile.current"));
  }

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

  public static Response deleteAddress(Cookies cookies, int addressId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of("addressId", addressId))
      .delete(ApiEndpoints.path("profile.current"));
  }

  public static Response retrieveCart(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("cart.current"));
  }

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
        "billingAddressId", fixture.billingAddressId(),
        "shippingId", fixture.shipping().id()
      ))
      .put(ApiEndpoints.path("cart.current"));
  }

  public static Response clearCart(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of("items", new Object[0]))
      .put(ApiEndpoints.path("cart.current"));
  }

  public static Response submitMockPayment(Cookies cookies, CheckoutFixture fixture) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept(ContentType.JSON)
      .body(Map.of(
        "subtotalUsd", fixture.variant().subtotalUsd(),
        "shippingUsd", fixture.shipping().shippingUsd(fixture.variant().clothesWeightKg()),
        "totalUsd", fixture.variant().subtotalUsd().add(fixture.shipping().shippingUsd(fixture.variant().clothesWeightKg())),
        "clothesWeightKg", fixture.variant().clothesWeightKg(),
        "boxWeightKg", fixture.shipping().boxWeightKg(fixture.variant().clothesWeightKg()),
        "shippingWeightKg", fixture.shipping().shippingWeightKg(fixture.variant().clothesWeightKg()),
        "shippingId", fixture.shipping().id(),
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

  public static Response retrieveAllOrders(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("orders.list"));
  }

  public static Response retrieveSingleOrder(Cookies cookies, long orderId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("orders.single", Map.of("orderId", String.valueOf(orderId))));
  }

  public static Response retrieveInvoicePayload(Cookies cookies, long orderId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get(ApiEndpoints.path("orders.invoicePayload", Map.of("orderId", String.valueOf(orderId))));
  }

  public static Response retrieveInvoicePdf(Cookies cookies, long orderId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept("*/*")
      .get(ApiEndpoints.path("orders.invoicePdf", Map.of("orderId", String.valueOf(orderId))));
  }

  public static Response generateInvoicePdf(Cookies cookies, Response invoicePayloadResponse) {
    return RestAssured
      .given()
      .cookies(cookies)
      .contentType(ContentType.JSON)
      .accept("*/*")
      .body(invoicePayloadResponse.asString())
      .post(ApiEndpoints.path("invoice.generatePdf"));
  }

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

  public static CheckoutFixture loadCheckoutFixture() throws SQLException {
    try (Connection connection = openConnection()) {
      int userId = getRequiredInt(
        connection,
        "SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1",
        TestConfig.testUserEmail()
      );
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
              clothes_weight_kg,
              box_weight_kg,
              shipping_weight_kg,
              shipping_id,
              invoice_number,
              invoice_generated_at,
              created_at,
              updated_at,
              shipping_address_id,
              billing_address_id
            )
            VALUES (?, 'unshipped', 'paid', 'rest-assured', ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          """,
          Statement.RETURN_GENERATED_KEYS
        )
      ) {
        insertOrder.setInt(1, checkoutFixture.userId());
        insertOrder.setString(2, "rest-assured-" + System.currentTimeMillis());
        insertOrder.setTimestamp(3, now);
        insertOrder.setBigDecimal(4, checkoutFixture.variant().subtotalUsd());
        insertOrder.setBigDecimal(5, checkoutFixture.shipping().shippingUsd(checkoutFixture.variant().clothesWeightKg()));
        insertOrder.setBigDecimal(
          6,
          checkoutFixture.variant().subtotalUsd().add(
            checkoutFixture.shipping().shippingUsd(checkoutFixture.variant().clothesWeightKg())
          )
        );
        insertOrder.setBigDecimal(7, checkoutFixture.variant().clothesWeightKg());
        insertOrder.setBigDecimal(8, checkoutFixture.shipping().boxWeightKg(checkoutFixture.variant().clothesWeightKg()));
        insertOrder.setBigDecimal(9, checkoutFixture.shipping().shippingWeightKg(checkoutFixture.variant().clothesWeightKg()));
        insertOrder.setInt(10, checkoutFixture.shipping().id());
        insertOrder.setString(11, invoiceNumber);
        insertOrder.setTimestamp(12, now);
        insertOrder.setTimestamp(13, now);
        insertOrder.setTimestamp(14, now);
        insertOrder.setInt(15, checkoutFixture.shippingAddressId());
        insertOrder.setInt(16, checkoutFixture.billingAddressId());
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

  public static void deleteOrderFixture(OrderFixture fixture) throws SQLException {
    if (fixture != null) {
      deleteOrderById(fixture.orderId());
    }
  }

  public static void deleteOrderById(long orderId) throws SQLException {
    try (
      Connection connection = openConnection();
      PreparedStatement deleteOrder = connection.prepareStatement("DELETE FROM orders WHERE id = ?")
    ) {
      deleteOrder.setLong(1, orderId);
      deleteOrder.executeUpdate();
    }
  }

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

  public static OrderFixture createOrderFixtureFromMockPayment(
    CheckoutFixture checkoutFixture,
    long orderId,
    String invoiceNumber
  ) {
    return createOrderFixture(orderId, invoiceNumber, checkoutFixture);
  }

  private static OrderFixture createOrderFixture(long orderId, String invoiceNumber, CheckoutFixture fixture) {
    BigDecimal shippingUsd = fixture.shipping().shippingUsd(fixture.variant().clothesWeightKg());
    BigDecimal totalUsd = fixture.variant().subtotalUsd().add(shippingUsd);
    return new OrderFixture(
      orderId,
      invoiceNumber,
      fixture.shipping().id(),
      fixture.shipping().mode(),
      fixture.shipping().deliveryTime(),
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

  private static Connection openConnection() throws SQLException {
    return DriverManager.getConnection(
      TestConfig.databaseUrl(),
      TestConfig.databaseUser(),
      TestConfig.databasePassword()
    );
  }

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

  private static int getRequiredInt(Connection connection, String sql, Object... params) throws SQLException {
    return Math.toIntExact(getRequiredLong(connection, sql, params));
  }

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

  private static ShippingRow getShippingRow(Connection connection) throws SQLException {
    try (
      PreparedStatement statement = connection.prepareStatement(
        """
          SELECT id, mode, delivery_time, first_kg_cost_rmb, additional_kg_cost_rmb
          FROM shipping_cost
          ORDER BY id ASC
          LIMIT 1
        """
      );
      ResultSet resultSet = statement.executeQuery()
    ) {
      if (!resultSet.next()) {
        throw new IllegalStateException("No shipping_cost rows exist for the API test fixture");
      }
      return new ShippingRow(
        resultSet.getInt("id"),
        resultSet.getString("mode"),
        resultSet.getString("delivery_time"),
        resultSet.getBigDecimal("first_kg_cost_rmb"),
        resultSet.getBigDecimal("additional_kg_cost_rmb")
      );
    }
  }

  private static VariantFixture getVariantRow(Connection connection) throws SQLException {
    try (
      PreparedStatement statement = connection.prepareStatement(
        """
          SELECT
            p.id AS product_id,
            pv.id AS variant_id,
            pv.cost_rmb,
            p.name AS product_name,
            c.color,
            s.size,
            COALESCE(st.weight_kg, 0) AS style_weight_kg,
            pvi.image_link
          FROM product_variants pv
          JOIN products p
            ON p.id = pv.product_id
          JOIN colors c
            ON c.id = pv.color_id
          LEFT JOIN sizes s
            ON s.id = pv.size_id
          JOIN styles st
            ON st.id = p.style_id
          LEFT JOIN LATERAL (
            SELECT image_link
            FROM product_variant_images
            WHERE product_variant_id = pv.id
            ORDER BY id ASC
            LIMIT 1
          ) pvi ON true
          WHERE pv.cost_rmb IS NOT NULL
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
      BigDecimal unitPriceUsd = toUsd(resultSet.getBigDecimal("cost_rmb"));
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
        resultSet.getBigDecimal("style_weight_kg").multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP),
        resultSet.getString("image_link")
      );
    }
  }

  private static void bindParams(PreparedStatement statement, Object... params) throws SQLException {
    for (int index = 0; index < params.length; index++) {
      statement.setObject(index + 1, params[index]);
    }
  }

  private static BigDecimal toUsd(BigDecimal rmb) {
    return rmb.multiply(RMB_TO_USD).setScale(2, RoundingMode.HALF_UP);
  }

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

  private static String checkoutPayloadJson(CheckoutFixture fixture) {
    BigDecimal shippingUsd = fixture.shipping().shippingUsd(fixture.variant().clothesWeightKg());
    BigDecimal totalUsd = fixture.variant().subtotalUsd().add(shippingUsd);
    return """
      {
        "subtotalUsd": %s,
        "shippingUsd": %s,
        "totalUsd": %s,
        "clothesWeightKg": %s,
        "boxWeightKg": %s,
        "shippingWeightKg": %s,
        "shippingId": %d,
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
        fixture.variant().clothesWeightKg().toPlainString(),
        fixture.shipping().boxWeightKg(fixture.variant().clothesWeightKg()).toPlainString(),
        fixture.shipping().shippingWeightKg(fixture.variant().clothesWeightKg()).toPlainString(),
        fixture.shipping().id(),
        fixture.shippingAddressId(),
        fixture.billingAddressId(),
        jsonEscape(fixture.variant().cartItemId()),
        fixture.variant().quantity(),
        fixture.variant().unitPriceUsd().toPlainString()
      );
  }

  private static String jsonEscape(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private static BigDecimal getBoxWeightKg(BigDecimal clothesWeightKg) {
    if (clothesWeightKg.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    if (clothesWeightKg.compareTo(BigDecimal.ONE) <= 0) return BigDecimal.valueOf(0.25).setScale(2, RoundingMode.HALF_UP);
    if (clothesWeightKg.compareTo(BigDecimal.valueOf(2)) <= 0) return BigDecimal.valueOf(0.30).setScale(2, RoundingMode.HALF_UP);
    if (clothesWeightKg.compareTo(BigDecimal.valueOf(3)) <= 0) return BigDecimal.valueOf(0.35).setScale(2, RoundingMode.HALF_UP);
    if (clothesWeightKg.compareTo(BigDecimal.valueOf(4)) <= 0) return BigDecimal.valueOf(0.40).setScale(2, RoundingMode.HALF_UP);
    if (clothesWeightKg.compareTo(BigDecimal.valueOf(5)) <= 0) return BigDecimal.valueOf(0.45).setScale(2, RoundingMode.HALF_UP);

    int extraKgSteps = clothesWeightKg.setScale(0, RoundingMode.CEILING).intValue() - 5;
    return BigDecimal.valueOf(0.45 + extraKgSteps * 0.05).setScale(2, RoundingMode.HALF_UP);
  }

  private static BigDecimal calculateShippingCostRmb(BigDecimal totalWeightKg, ShippingRow mode) {
    if (totalWeightKg.compareTo(BigDecimal.ZERO) <= 0) {
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    BigDecimal firstKgCost = mode.firstKgCostRmb() == null
      ? BigDecimal.ZERO
      : mode.firstKgCostRmb();
    BigDecimal additionalKgCost = mode.additionalKgCostRmb() == null
      ? BigDecimal.ZERO
      : mode.additionalKgCostRmb();
    BigDecimal extraWeightKg = totalWeightKg.subtract(BigDecimal.ONE).max(BigDecimal.ZERO);
    int billedAdditionalKg = extraWeightKg.compareTo(BigDecimal.ZERO) > 0
      ? extraWeightKg.setScale(0, RoundingMode.CEILING).intValue()
      : 0;

    return firstKgCost.add(additionalKgCost.multiply(BigDecimal.valueOf(billedAdditionalKg))).setScale(2, RoundingMode.HALF_UP);
  }

  public record ShippingRow(
    int id,
    String mode,
    String deliveryTime,
    BigDecimal firstKgCostRmb,
    BigDecimal additionalKgCostRmb
  ) {
    public BigDecimal boxWeightKg(BigDecimal clothesWeightKg) {
      return getBoxWeightKg(clothesWeightKg);
    }

    public BigDecimal shippingWeightKg(BigDecimal clothesWeightKg) {
      return clothesWeightKg.add(boxWeightKg(clothesWeightKg)).setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal shippingUsd(BigDecimal clothesWeightKg) {
      return toUsd(calculateShippingCostRmb(shippingWeightKg(clothesWeightKg), this));
    }
  }

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
    BigDecimal clothesWeightKg,
    String imageUrl
  ) {}

  public record CheckoutFixture(
    int userId,
    String customerEmail,
    int shippingAddressId,
    int billingAddressId,
    ShippingRow shipping,
    VariantFixture variant
  ) {}

  public record OrderFixture(
    long orderId,
    String invoiceNumber,
    int shippingId,
    String shippingMode,
    String shippingDeliveryTime,
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

  public record AddressPayload(
    String name,
    String street,
    String city,
    String state,
    String zipCode,
    String country,
    String phone
  ) {}

  public record MeasurementSnapshot(
    Integer measurementId,
    BigDecimal heightCm,
    BigDecimal chestCm,
    BigDecimal sleeveLengthCm,
    boolean existed
  ) {}
}
