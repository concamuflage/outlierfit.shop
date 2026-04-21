package com.asianfit.api.steps;

import com.asianfit.api.support.OrdersApiContext;
import com.asianfit.api.support.OrdersApiSupport;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.response.Response;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.testng.Assert;

public class OrdersApiSteps {
  private String formatShippingMode(String mode) {
    if ("hybrid".equals(mode)) {
      return "Air Sea Land";
    }
    if ("sea_land".equals(mode)) {
      return "Sea Land";
    }
    if (mode == null || mode.isBlank()) {
      return "";
    }
    return Character.toUpperCase(mode.charAt(0)) + mode.substring(1);
  }

  @Given("I am authenticated for the orders API")
  public void iAmAuthenticatedForTheOrdersApi() {
    OrdersApiContext.setAuthCookies(OrdersApiSupport.authenticate());
  }

  @Given("an order exists for the current user")
  public void anOrderExistsForTheCurrentUser() throws Exception {
    OrdersApiContext.setFixture(OrdersApiSupport.insertOrderFixture());
  }

  @When("I retrieve all orders for the current user")
  public void iRetrieveAllOrdersForTheCurrentUser() {
    OrdersApiContext.setAllOrdersResponse(
      OrdersApiSupport.retrieveAllOrders(OrdersApiContext.authCookies())
    );
  }

  @Then("the orders response should include the created order")
  public void theOrdersResponseShouldIncludeTheCreatedOrder() {
    Response response = OrdersApiContext.allOrdersResponse();
    response.then().statusCode(200);

    List<Map<String, Object>> orders = response.jsonPath().getList("$");
    Assert.assertNotNull(orders, "Orders payload should be a list");

    Map<String, Object> insertedOrder = orders
      .stream()
      .filter((order) -> OrdersApiContext.fixture().invoiceNumber().equals(order.get("invoiceNumber")))
      .findFirst()
      .orElseThrow(() -> new AssertionError("Expected the inserted order to be returned by /api/profile/orders"));

    long retrievedOrderId = ((Number) insertedOrder.get("id")).longValue();
    OrdersApiContext.setRetrievedOrderId(retrievedOrderId);

    Assert.assertEquals(retrievedOrderId, OrdersApiContext.fixture().orderId());
    Assert.assertEquals(insertedOrder.get("paymentStatus"), "paid");
    Assert.assertEquals(insertedOrder.get("shipmentStatus"), "unshipped");
  }

  @When("I retrieve that single order")
  public void iRetrieveThatSingleOrder() {
    OrdersApiContext.setSingleOrderResponse(
      OrdersApiSupport.retrieveSingleOrder(
        OrdersApiContext.authCookies(),
        OrdersApiContext.retrievedOrderId()
      )
    );
  }

  @Then("the single order response should match the created order")
  public void theSingleOrderResponseShouldMatchTheCreatedOrder() {
    Response response = OrdersApiContext.singleOrderResponse();
    response.then().statusCode(200);

    Assert.assertEquals(response.jsonPath().getLong("id"), OrdersApiContext.fixture().orderId());
    Assert.assertEquals(response.jsonPath().getString("invoiceNumber"), OrdersApiContext.fixture().invoiceNumber());
    Assert.assertEquals(response.jsonPath().getString("paymentStatus"), "paid");
    Assert.assertEquals(response.jsonPath().getString("shipmentStatus"), "unshipped");
    Assert.assertEquals(response.jsonPath().getString("shipping.mode"), OrdersApiContext.fixture().shippingMode());
    Assert.assertEquals(response.jsonPath().getInt("items.size()"), 1);
    Assert.assertEquals(response.jsonPath().getInt("items[0].productId"), OrdersApiContext.fixture().productId());
    Assert.assertEquals(response.jsonPath().getInt("items[0].variantId"), OrdersApiContext.fixture().variantId());
    Assert.assertEquals(response.jsonPath().getInt("items[0].quantity"), OrdersApiContext.fixture().quantity());
    Assert.assertEquals(
      BigDecimal.valueOf(response.jsonPath().getDouble("items[0].unitPriceUsd")).setScale(2, java.math.RoundingMode.HALF_UP),
      OrdersApiContext.fixture().unitPriceUsd().setScale(2, java.math.RoundingMode.HALF_UP)
    );
    Assert.assertEquals(response.jsonPath().getString("items[0].productName"), OrdersApiContext.fixture().productName());
    Assert.assertEquals(response.jsonPath().getString("items[0].color"), OrdersApiContext.fixture().color());
    Assert.assertEquals(response.jsonPath().getString("items[0].size"), OrdersApiContext.fixture().size());
    Assert.assertEquals(response.jsonPath().getBoolean("items[0].variantExists"), true);
  }

  @When("I retrieve the invoice payload for that order")
  public void iRetrieveTheInvoicePayloadForThatOrder() {
    OrdersApiContext.setInvoicePayloadResponse(
      OrdersApiSupport.retrieveInvoicePayload(
        OrdersApiContext.authCookies(),
        OrdersApiContext.fixture().orderId()
      )
    );
  }

  @Then("the invoice payload response should include the complete order information")
  public void theInvoicePayloadResponseShouldIncludeTheCompleteOrderInformation() {
    Response response = OrdersApiContext.invoicePayloadResponse();
    response.then().statusCode(200);

    Assert.assertEquals(response.jsonPath().getString("invoiceNumber"), OrdersApiContext.fixture().invoiceNumber());
    Assert.assertNotNull(response.jsonPath().getString("paidAt"));
    Assert.assertEquals(response.jsonPath().getString("customerEmail"), OrdersApiContext.fixture().customerEmail());

    String expectedShippingModeLabel = formatShippingMode(OrdersApiContext.fixture().shippingMode());
    if (OrdersApiContext.fixture().shippingDeliveryTime() != null && !OrdersApiContext.fixture().shippingDeliveryTime().isBlank()) {
      expectedShippingModeLabel += " " + OrdersApiContext.fixture().shippingDeliveryTime();
    }
    Assert.assertEquals(response.jsonPath().getString("shippingModeLabel"), expectedShippingModeLabel);

    Assert.assertTrue(response.jsonPath().getDouble("subtotalUsd") > 0);
    Assert.assertTrue(response.jsonPath().getDouble("shippingUsd") >= 0);
    Assert.assertTrue(response.jsonPath().getDouble("totalUsd") > 0);

    Assert.assertNotNull(response.jsonPath().getString("shippingAddress.name"));
    Assert.assertNotNull(response.jsonPath().getString("shippingAddress.street"));
    Assert.assertNotNull(response.jsonPath().getString("shippingAddress.city"));
    Assert.assertNotNull(response.jsonPath().getString("shippingAddress.state"));
    Assert.assertNotNull(response.jsonPath().getString("shippingAddress.zipCode"));
    Assert.assertNotNull(response.jsonPath().getString("shippingAddress.country"));
    Assert.assertNotNull(response.jsonPath().getString("shippingAddress.phone"));

    Assert.assertNotNull(response.jsonPath().getString("billingAddress.name"));
    Assert.assertNotNull(response.jsonPath().getString("billingAddress.street"));
    Assert.assertNotNull(response.jsonPath().getString("billingAddress.city"));
    Assert.assertNotNull(response.jsonPath().getString("billingAddress.state"));
    Assert.assertNotNull(response.jsonPath().getString("billingAddress.zipCode"));
    Assert.assertNotNull(response.jsonPath().getString("billingAddress.country"));
    Assert.assertNotNull(response.jsonPath().getString("billingAddress.phone"));

    Assert.assertEquals(response.jsonPath().getInt("items.size()"), 1);
    Assert.assertEquals(response.jsonPath().getString("items[0].name"), OrdersApiContext.fixture().productName());
    Assert.assertEquals(response.jsonPath().getString("items[0].color"), OrdersApiContext.fixture().color());
    Assert.assertEquals(response.jsonPath().getString("items[0].size"), OrdersApiContext.fixture().size());
    Assert.assertEquals(response.jsonPath().getInt("items[0].quantity"), OrdersApiContext.fixture().quantity());
    Assert.assertEquals(
      BigDecimal.valueOf(response.jsonPath().getDouble("items[0].unitPriceUsd")).setScale(2, java.math.RoundingMode.HALF_UP),
      OrdersApiContext.fixture().unitPriceUsd().setScale(2, java.math.RoundingMode.HALF_UP)
    );
  }
}
