require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const productsRouter = require("./routes/products");
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// The paths

app.use("/products", productsRouter);

const PORT = process.env.PORT;
const HOST = process.env.HOST;
app.listen(PORT, () => {
  console.log(`Backend running on ${HOST}:${PORT}`);
});