require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const productsRouter = require("./routes/products");
const authRouter = require("./routes/auth");
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

// Only requests coming from a page loaded at CLIENT_ORIGIN(the frontend)
// are allowed to read the response in the browser.
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// The paths

app.use("/products", productsRouter);
app.use("/auth", authRouter);

const PORT = process.env.PORT;
const HOST = process.env.HOST;
app.listen(PORT, () => {
  console.log(`Backend running on ${HOST}:${PORT}`);
});
