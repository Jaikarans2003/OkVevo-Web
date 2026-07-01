import express from "express";
import cors from "cors";
import router from "./app.js";
import { checkDeps } from "./lib/checkDeps.js";

const PORT = Number(process.env.PORT || 3031);

const app = express();
app.use(cors());
app.use(express.json());
app.use(router);

checkDeps();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OkVevo Manim Renderer running on port ${PORT}`);
});
