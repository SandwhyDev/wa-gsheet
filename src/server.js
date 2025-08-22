import express from "express";
import cors from "cors";
import path from "path";
import LoadEnv from "./libs/LoadENv";
import { initializeWaBot } from "./libs/wa";
import send_message_controllers from "./controllers/WaControllers";
import { ReadGoogleSheet } from "./libs/GetGoogleSheet";

LoadEnv();

const app = express();
const PORT = process.env.PORT || 8000;

//MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "../public")));

// INIT WA
async function initwa() {
  const test = await initializeWaBot();
  console.log(test);

  // const batchDelayMinutes = Math.floor(Math.random()); // 10–15 menit

  // const oi = await ReadGoogleSheet();
  // console.log(batchDelayMinutes);
}

initwa();

//ROUTES
app.use("/api", send_message_controllers);

//LISTENER
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
    SERVER RUNNING TO PORT ${PORT}
    `);
});
