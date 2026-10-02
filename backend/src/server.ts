import path from "path";
import fs from "fs";
import { openDatabase } from "./db/database.js";
import { seedDatabase } from "./db/seed.js";
import { createApp } from "./app.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const DATABASE_PATH =
  process.env.DATABASE_PATH ??
  path.join(__dirname, "../data/events.db");

// Ensure target directory exists before opening database file
fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

const db = openDatabase(DATABASE_PATH);

// Seed synthetic event data if dataset is uninitialized
const eventCount = (
  db.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number }
).count;

if (eventCount === 0) {
  console.log("Events table is empty — seeding synthetic data...");
  seedDatabase(db);
}

const app = createApp(db);

app.listen(PORT, () => {
  console.log(`Mable Audience Builder API listening on http://localhost:${PORT}`);
});
