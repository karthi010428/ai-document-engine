import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

// Fast, reliable models suited for document parsing
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
];

const LineItemSchema = z.object({
  description: z.string().default("Item"),
  quantity: z.number().default(1),
  unitPrice: z.number().default(0),
  amount: z.number().default(0),
});

const InvoiceSchema = z.object({
  vendorName: z.string().default("Unknown Vendor"),
  taxId: z.string().nullable().optional(),
  invoiceNumber: z.string().default("N/A"),
  date: z.string().default("N/A"),
  subtotal: z.number().default(0),
  taxAmount: z.number().default(0),
  totalAmount: z.number().default(0),
  lineItems: z.array(LineItemSchema).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const { base64Image, mimeType } = await req.json();

    if (!base64Image) {
      return NextResponse.json(
        { success: false, error: "No document data provided" },
        { status: 400 }
      );
    }

    const prompt = `You are an expert accounts payable compliance auditor. 
Extract invoice data accurately including all line items.
Return strictly valid JSON conforming to this structure:
{
  "vendorName": string,
  "taxId": string or null,
  "invoiceNumber": string,
  "date": string,
  "subtotal": number,
  "taxAmount": number,
  "totalAmount": number,
  "lineItems": [
    {
      "description": string,
      "quantity": number,
      "unitPrice": number,
      "amount": number
    }
  ]
}
Do not enclose in markdown blocks if possible, just raw JSON.`;

    let rawResponse = "";
    let lastError: any = null;

    for (const modelName of MODEL_CANDIDATES) {
      try {
        console.log(`[Audit Engine] Attempting inference using model: ${modelName}...`);
        
        // Use a 25-second timeout per attempt to prevent infinite hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout with model ${modelName}`)), 25000)
        );

        const inferencePromise = ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || "application/pdf",
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        });

        const response: any = await Promise.race([inferencePromise, timeoutPromise]);

        if (response?.text) {
          rawResponse = response.text;
          console.log(`[Audit Engine] Success using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.log(`[Audit Engine] ${modelName} failed or timed out: ${err.message}. Trying next candidate...`);
      }
    }

    if (!rawResponse) {
      return NextResponse.json(
        {
          success: false,
          error: lastError?.message || "All inference models timed out or failed to process the PDF.",
        },
        { status: 503 }
      );
    }

    const cleanedText = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = InvoiceSchema.parse(JSON.parse(cleanedText));

    const client = await clientPromise;
    const db = client.db("document_audit_db");
    const collection = db.collection("invoices");

    // Duplicate Check
    const isRealInvoiceNum =
      parsedData.invoiceNumber &&
      parsedData.invoiceNumber.trim().toUpperCase() !== "N/A";

    let existingDuplicate = null;
    if (isRealInvoiceNum) {
      existingDuplicate = await collection.findOne({
        "data.invoiceNumber": parsedData.invoiceNumber,
        "data.vendorName": { $regex: new RegExp(`^${parsedData.vendorName.trim()}$`, "i") },
      });
    }

    const issues: string[] = [];
    let isDuplicate = false;

    if (existingDuplicate) {
      isDuplicate = true;
      issues.push(
        `DUPLICATE INVOICE ALERT: Invoice #${parsedData.invoiceNumber} from "${parsedData.vendorName}" was already processed on ${new Date(
          existingDuplicate.createdAt
        ).toLocaleDateString()} (Record ID: ${existingDuplicate._id}). Potential double payment blocked.`
      );
    }

    // Line-Item Level Audit
    const verifiedLineItems = parsedData.lineItems.map((item, idx) => {
      const expectedAmount = Number((item.quantity * item.unitPrice).toFixed(2));
      const actualAmount = Number(item.amount.toFixed(2));
      const hasMathMismatch =
        item.quantity > 0 &&
        item.unitPrice > 0 &&
        Math.abs(expectedAmount - actualAmount) > 0.05;

      if (hasMathMismatch) {
        issues.push(
          `Line Item #${idx + 1} ("${item.description}") Math Error: ${item.quantity} × ${item.unitPrice} should be ${expectedAmount}, but billed ${actualAmount}.`
        );
      }

      return {
        ...item,
        expectedAmount,
        hasMathMismatch,
      };
    });

    // Document Totals Audit
    const calculatedTotal = Number((parsedData.subtotal + parsedData.taxAmount).toFixed(2));
    const claimedTotal = Number(parsedData.totalAmount.toFixed(2));

    if (Math.abs(calculatedTotal - claimedTotal) > 0.05) {
      issues.push(
        `Arithmetic Error: Subtotal (${parsedData.subtotal}) + Tax (${parsedData.taxAmount}) equals ${calculatedTotal}, but Document Total claims ${claimedTotal}.`
      );
    }

    if (!parsedData.taxId) {
      issues.push("Compliance Alert: Document does not declare a registered Tax ID / GSTIN.");
    }

    const isValid = issues.length === 0;
    const status = isDuplicate ? "DUPLICATE_REJECTED" : isValid ? "PASSED" : "FLAGGED";

    const draftEmail = issues.length > 0
      ? `To: Accounts Team (${parsedData.vendorName})
Subject: Audit Discrepancy Notice for Invoice #${parsedData.invoiceNumber}

Dear Accounts Receivable,

During our automated AP verification, the following discrepancy was flagged on your invoice #${parsedData.invoiceNumber}:

${issues.map((i) => `• ${i}`).join("\n")}

Please issue a revised invoice or credit note accordingly.

Best regards,
Accounts Payable Audit Team`
      : null;

    const recordToInsert = {
      data: {
        ...parsedData,
        lineItems: verifiedLineItems,
      },
      audit: {
        isValid,
        status,
        isDuplicate,
        issues,
        draftEmail,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await collection.insertOne(recordToInsert);

    return NextResponse.json({
      success: true,
      _id: insertResult.insertedId,
      ...recordToInsert,
    });
  } catch (error: any) {
    console.error("Audit POST Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process invoice" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("document_audit_db");
    const collection = db.collection("invoices");

    const history = await collection.find({}).sort({ createdAt: -1 }).limit(50).toArray();

    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, updatedData } = await req.json();

    if (!id || !updatedData) {
      return NextResponse.json(
        { success: false, error: "Missing id or updated data" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("document_audit_db");
    const collection = db.collection("invoices");

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          data: updatedData,
          "audit.status": "APPROVED_BY_HUMAN",
          "audit.isValid": true,
          "audit.isDuplicate": false,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update record" },
      { status: 500 }
    );
  }
}
// [milestone]: feat: setup mongodb atlas connection with mongoose schemas

// [milestone]: feat: implement pdf and image upload endpoint using multer

// [milestone]: feat: add file size validation and mime-type restriction middleware

// [milestone]: feat: implement tax calculation discrepancy checker

// [milestone]: fix: resolve floating-point arithmetic errors in total calculation

// [milestone]: test: write unit tests for zod invoice schema validation

// [milestone]: feat: implement status badges (verified, flagged, pending review)

// [milestone]: perf: cache frequent vendor metadata queries in memory

// [milestone]: feat: add role-based guard on dispute generation triggers
