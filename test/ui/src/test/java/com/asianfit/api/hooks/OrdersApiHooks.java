package com.asianfit.api.hooks;

import com.asianfit.api.support.OrdersApiContext;
import com.asianfit.api.support.OrdersApiSupport;
import io.cucumber.java.After;
import io.cucumber.java.Before;

public class OrdersApiHooks {
  @Before("@OrdersApi or @OrdersInvoiceApi")
  public void setUpApiScenario() {
    OrdersApiSupport.configureBaseUri();
    OrdersApiContext.clear();
  }

  @After("@OrdersApi or @OrdersInvoiceApi")
  public void tearDownApiScenario() throws Exception {
    OrdersApiSupport.deleteOrderFixture(OrdersApiContext.fixture());
    OrdersApiContext.clear();
  }
}
