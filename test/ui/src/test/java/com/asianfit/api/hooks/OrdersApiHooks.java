package com.asianfit.api.hooks;

import com.asianfit.api.support.OrdersApiContext;
import com.asianfit.api.support.OrdersApiSupport;
import io.cucumber.java.After;
import io.cucumber.java.Before;

public class OrdersApiHooks {
  @Before("@OrdersApi or @OrdersInvoiceApi or @ProfileApi or @CartApi or @CheckoutApi")
  public void setUpApiScenario() throws Exception {
    OrdersApiSupport.configureBaseUri();
    OrdersApiContext.clear();
    OrdersApiSupport.clearCartForCurrentUser();
  }

  @After("@OrdersApi or @OrdersInvoiceApi or @ProfileApi or @CartApi or @CheckoutApi")
  public void tearDownApiScenario() throws Exception {
    OrdersApiSupport.restoreMeasurementSnapshot(OrdersApiContext.originalMeasurement());
    OrdersApiSupport.deleteAddressFixture(OrdersApiContext.targetAddressId());
    OrdersApiSupport.deleteOrderFixture(OrdersApiContext.fixture());
    OrdersApiSupport.clearCartForCurrentUser();
    OrdersApiContext.clear();
  }
}
