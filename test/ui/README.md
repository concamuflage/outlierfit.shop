# UI Tests

This folder contains Selenium + TestNG + Cucumber UI tests for the cart flow.

## Prerequisites

1. Start the app:

```bash
npm run dev:full
```

2. Make sure the site is reachable at `http://localhost:3000`.

## Run tests

From `test/ui`:

```bash
mvn test
```

To run against a different base URL:

```bash
mvn test -DbaseUrl=http://localhost:3000
```

To run with the browser visible:

```bash
mvn test -Dheadless=false
```

## Login-required scenario

The protected-cart scenario needs a valid test account:

```bash
mvn test \
  -DtestUserEmail=your-email@example.com \
  -DtestUserPassword=your-password
```

Or export environment variables once and reuse them:

```bash
export TEST_USER_EMAIL=your-email@example.com
export TEST_USER_PASSWORD=your-password
mvn test
```

Or store them locally in `test/ui/.env.local`:

```bash
TEST_USER_EMAIL=your-email@example.com
TEST_USER_PASSWORD=your-password
```

Then you can run the login scenario without extra flags:

```bash
mvn test -Dcucumber.filter.name="Login-required cart flow"
```
