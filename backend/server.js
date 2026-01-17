const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/products", (req, res) => {
  res.json([
    { id: 1, name: "Long-Sleeve Tee", price: 29 },
    { id: 2, name: "Short Bomber Jacket", price: 89 },
  ]);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});