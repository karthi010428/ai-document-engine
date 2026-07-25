import { MongoClient } from "mongodb";

const uri = (process.env.MONGODB_URI || "").trim();
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!uri) {
  throw new Error("Please add your MONGODB_URI to .env.local");
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
// [milestone]: feat: define invoice document schema with nested line-item types

// [milestone]: feat: configure gemini structured output parser using zod schema

// [milestone]: refactor: modularize document parsing engine into dedicated services

// [milestone]: feat: create extracted data review dashboard layout

// [milestone]: feat: add vendor spend analytics chart using tailwind and recharts

// [milestone]: feat: add dispute email template drafting with auto-filled values

// [milestone]: refactor: improve gemini api error handling and rate-limit retries

// [milestone]: test: add jest tests for line-item arithmetic verification

// [milestone]: refactor: extract gemini prompt engineering into config directory

// [milestone]: fix: handle edge cases with multi-currency invoice symbols

// [milestone]: test: add integration test for full extraction to mongodb save flow

// [milestone]: feat: add dark mode support to invoice inspection table

// [milestone]: fix: correct date timezone parsing for foreign invoice formats

// [milestone]: perf: reduce cold start latency on api serverless functions
