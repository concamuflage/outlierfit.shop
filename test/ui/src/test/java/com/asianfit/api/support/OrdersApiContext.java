package com.asianfit.api.support;

import io.restassured.http.Cookies;
import io.restassured.response.Response;

public final class OrdersApiContext {
  private static final ThreadLocal<Cookies> AUTH_COOKIES = new ThreadLocal<>();
  private static final ThreadLocal<OrdersApiSupport.OrderFixture> FIXTURE = new ThreadLocal<>();
  private static final ThreadLocal<Response> ALL_ORDERS_RESPONSE = new ThreadLocal<>();
  private static final ThreadLocal<Response> SINGLE_ORDER_RESPONSE = new ThreadLocal<>();
  private static final ThreadLocal<Response> INVOICE_PAYLOAD_RESPONSE = new ThreadLocal<>();
  private static final ThreadLocal<Long> RETRIEVED_ORDER_ID = new ThreadLocal<>();

  private OrdersApiContext() {}

  public static Cookies authCookies() {
    return AUTH_COOKIES.get();
  }

  public static void setAuthCookies(Cookies cookies) {
    AUTH_COOKIES.set(cookies);
  }

  public static OrdersApiSupport.OrderFixture fixture() {
    return FIXTURE.get();
  }

  public static void setFixture(OrdersApiSupport.OrderFixture fixture) {
    FIXTURE.set(fixture);
  }

  public static Response allOrdersResponse() {
    return ALL_ORDERS_RESPONSE.get();
  }

  public static void setAllOrdersResponse(Response response) {
    ALL_ORDERS_RESPONSE.set(response);
  }

  public static Response singleOrderResponse() {
    return SINGLE_ORDER_RESPONSE.get();
  }

  public static void setSingleOrderResponse(Response response) {
    SINGLE_ORDER_RESPONSE.set(response);
  }

  public static Response invoicePayloadResponse() {
    return INVOICE_PAYLOAD_RESPONSE.get();
  }

  public static void setInvoicePayloadResponse(Response response) {
    INVOICE_PAYLOAD_RESPONSE.set(response);
  }

  public static Long retrievedOrderId() {
    return RETRIEVED_ORDER_ID.get();
  }

  public static void setRetrievedOrderId(long orderId) {
    RETRIEVED_ORDER_ID.set(orderId);
  }

  public static void clear() {
    AUTH_COOKIES.remove();
    FIXTURE.remove();
    ALL_ORDERS_RESPONSE.remove();
    SINGLE_ORDER_RESPONSE.remove();
    INVOICE_PAYLOAD_RESPONSE.remove();
    RETRIEVED_ORDER_ID.remove();
  }
}
