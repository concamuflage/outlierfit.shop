package com.asianfit.api.support;

import com.asianfit.ui.utils.TestConfig;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.http.Cookies;
import io.restassured.response.Response;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import org.testng.Assert;

public final class OrdersApiSupport {
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
      .get("/api/auth/csrf");

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
      .post("/api/auth/callback/credentials");

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
      .get("/api/auth/session");

    sessionResponse.then().statusCode(200);
    Assert.assertEquals(sessionResponse.jsonPath().getString("user.email"), TestConfig.testUserEmail());
    return sessionCookies;
  }

  public static Response retrieveAllOrders(Cookies cookies) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get("/api/profile/orders");
  }

  public static Response retrieveSingleOrder(Cookies cookies, long orderId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get("/api/profile/orders/" + orderId);
  }

  public static Response retrieveInvoicePayload(Cookies cookies, long orderId) {
    return RestAssured
      .given()
      .cookies(cookies)
      .accept(ContentType.JSON)
      .get("/api/profile/orders/" + orderId + "/invoice");
  }

  public static OrderFixture insertOrderFixture() throws SQLException {
    try (
      Connection connection = DriverManager.getConnection(
        TestConfig.databaseUrl(),
        TestConfig.databaseUser(),
        TestConfig.databasePassword()
      )
    ) {
      long userId = getRequiredLong(
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
      int chosenBillingAddressId = billingAddressId != null ? billingAddressId : shippingAddressId;
      ShippingRow shipping = getShippingRow(connection);
      VariantRow variant = getVariantRow(connection);
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
        insertOrder.setLong(1, userId);
        insertOrder.setString(2, "rest-assured-" + System.currentTimeMillis());
        insertOrder.setTimestamp(3, now);
        insertOrder.setBigDecimal(4, variant.subtotalUsd());
        insertOrder.setBigDecimal(5, shipping.shippingUsd());
        insertOrder.setBigDecimal(6, variant.subtotalUsd().add(shipping.shippingUsd()));
        insertOrder.setBigDecimal(7, variant.clothesWeightKg());
        insertOrder.setBigDecimal(8, shipping.boxWeightKg());
        insertOrder.setBigDecimal(9, shipping.shippingWeightKg(variant.clothesWeightKg()));
        insertOrder.setInt(10, shipping.id());
        insertOrder.setString(11, invoiceNumber);
        insertOrder.setTimestamp(12, now);
        insertOrder.setTimestamp(13, now);
        insertOrder.setTimestamp(14, now);
        insertOrder.setInt(15, shippingAddressId);
        insertOrder.setInt(16, chosenBillingAddressId);
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
        insertOrderVariant.setInt(2, variant.id());
        insertOrderVariant.setInt(3, variant.quantity());
        insertOrderVariant.setBigDecimal(4, variant.unitPriceUsd());
        insertOrderVariant.executeUpdate();
      }

      return new OrderFixture(
        orderId,
        invoiceNumber,
        shipping.mode(),
        shipping.deliveryTime(),
        variant.productId(),
        variant.id(),
        variant.quantity(),
        variant.productName(),
        variant.color(),
        variant.size(),
        variant.unitPriceUsd(),
        TestConfig.testUserEmail()
      );
    }
  }

  public static void deleteOrderFixture(OrderFixture fixture) throws SQLException {
    if (fixture == null) {
      return;
    }

    try (
      Connection connection = DriverManager.getConnection(
        TestConfig.databaseUrl(),
        TestConfig.databaseUser(),
        TestConfig.databasePassword()
      );
      PreparedStatement deleteOrder = connection.prepareStatement("DELETE FROM orders WHERE id = ?")
    ) {
      deleteOrder.setLong(1, fixture.orderId());
      deleteOrder.executeUpdate();
    }
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
          SELECT id, mode, delivery_time
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
        resultSet.getString("delivery_time")
      );
    }
  }

  private static VariantRow getVariantRow(Connection connection) throws SQLException {
    try (
      PreparedStatement statement = connection.prepareStatement(
        """
          SELECT
            p.id AS product_id,
            pv.id,
            pv.cost_rmb,
            p.name AS product_name,
            c.color,
            s.size,
            COALESCE(st.weight_kg, 0) AS style_weight_kg
          FROM product_variants pv
          JOIN products p
            ON p.id = pv.product_id
          JOIN colors c
            ON c.id = pv.color_id
          LEFT JOIN sizes s
            ON s.id = pv.size_id
          JOIN styles st
            ON st.id = p.style_id
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
      return new VariantRow(
        resultSet.getInt("product_id"),
        resultSet.getInt("id"),
        quantity,
        resultSet.getString("product_name"),
        resultSet.getString("color"),
        resultSet.getString("size"),
        unitPriceUsd,
        unitPriceUsd.multiply(BigDecimal.valueOf(quantity)),
        resultSet.getBigDecimal("style_weight_kg")
      );
    }
  }

  private static void bindParams(PreparedStatement statement, Object... params) throws SQLException {
    for (int index = 0; index < params.length; index++) {
      statement.setObject(index + 1, params[index]);
    }
  }

  private static BigDecimal toUsd(BigDecimal rmb) {
    return rmb.multiply(BigDecimal.valueOf(0.14)).setScale(2, java.math.RoundingMode.HALF_UP);
  }

  private record ShippingRow(int id, String mode, String deliveryTime) {
    private BigDecimal shippingUsd() {
      return BigDecimal.valueOf(20.30).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private BigDecimal boxWeightKg() {
      return BigDecimal.valueOf(0.25).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private BigDecimal shippingWeightKg(BigDecimal clothesWeightKg) {
      return clothesWeightKg.add(boxWeightKg()).setScale(2, java.math.RoundingMode.HALF_UP);
    }
  }

  private record VariantRow(
    int productId,
    int id,
    int quantity,
    String productName,
    String color,
    String size,
    BigDecimal unitPriceUsd,
    BigDecimal subtotalUsd,
    BigDecimal clothesWeightKg
  ) {}

  public record OrderFixture(
    long orderId,
    String invoiceNumber,
    String shippingMode,
    String shippingDeliveryTime,
    int productId,
    int variantId,
    int quantity,
    String productName,
    String color,
    String size,
    BigDecimal unitPriceUsd,
    String customerEmail
  ) {}
}
