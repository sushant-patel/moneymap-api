import "dotenv/config";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import groupRoutes from "./routes/group.routes.js"
import { prisma } from "./lib/prisma.js";
import express from "express";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the MoneyMap API" });
});

app.get("/users/count", async (req, res) => {
  const count = await prisma.user.count();
  res.json({ count });
});

app.use("/auth", authRoutes);

app.use("/groups", groupRoutes)

// 404: no route matched
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler: catches anything that crashes
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? "Something went wrong" : err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));