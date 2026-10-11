import { describe, it, expect } from "vitest";
import { InvoiceSchema, auditInvoiceData } from "../lib/audit-validator";

describe("Invoice Audit Engine - Unit Tests", () => {
  it("passes validation for an accurate, compliant invoice", () => {
    const validInvoice = {
      vendorName: "Acme Logistics",
      taxId: "GSTIN-12345ABC",
      invoiceNumber: "INV-2026-001",
      date: "2026-10-10",
      subtotal: 200,
      taxAmount: 36,
      totalAmount: 236,
      lineItems: [
        { description: "Freight Courier", quantity: 2, unitPrice: 100, amount: 200 },
      ],
    };

    const parsed = InvoiceSchema.parse(validInvoice);
    const result = auditInvoiceData(parsed, false);

    expect(result.isValid).toBe(true);
    expect(result.status).toBe("PASSED");
    expect(result.issues).toHaveLength(0);
  });

  it("detects and flags line-item math discrepancies", () => {
    const mismatchedLineItem = {
      vendorName: "Acme Logistics",
      taxId: "GSTIN-12345ABC",
      invoiceNumber: "INV-2026-002",
      date: "2026-10-10",
      subtotal: 250,
      taxAmount: 45,
      totalAmount: 295,
      lineItems: [
        { description: "Server Rack", quantity: 2, unitPrice: 100, amount: 250 },
      ],
    };

    const parsed = InvoiceSchema.parse(mismatchedLineItem);
    const result = auditInvoiceData(parsed, false);

    expect(result.isValid).toBe(false);
    expect(result.status).toBe("FLAGGED");
    expect(result.issues.some((msg) => msg.includes("Math Error"))).toBe(true);
  });

  it("detects and flags document arithmetic errors (subtotal + tax != total)", () => {
    const wrongTotal = {
      vendorName: "Acme Logistics",
      taxId: "GSTIN-12345ABC",
      invoiceNumber: "INV-2026-003",
      date: "2026-10-10",
      subtotal: 100,
      taxAmount: 18,
      totalAmount: 150,
      lineItems: [
        { description: "Consulting", quantity: 1, unitPrice: 100, amount: 100 },
      ],
    };

    const parsed = InvoiceSchema.parse(wrongTotal);
    const result = auditInvoiceData(parsed, false);

    expect(result.isValid).toBe(false);
    expect(result.status).toBe("FLAGGED");
    expect(result.issues.some((msg) => msg.includes("Arithmetic Error"))).toBe(true);
  });

  it("flags missing registered tax IDs for compliance", () => {
    const missingTaxId = {
      vendorName: "Acme Logistics",
      taxId: null,
      invoiceNumber: "INV-2026-004",
      date: "2026-10-10",
      subtotal: 100,
      taxAmount: 18,
      totalAmount: 118,
      lineItems: [
        { description: "Domain Registration", quantity: 1, unitPrice: 100, amount: 100 },
      ],
    };

    const parsed = InvoiceSchema.parse(missingTaxId);
    const result = auditInvoiceData(parsed, false);

    expect(result.isValid).toBe(false);
    expect(result.issues.some((msg) => msg.includes("Tax ID / GSTIN"))).toBe(true);
  });

  it("rejects duplicates with DUPLICATE_REJECTED status", () => {
    const duplicateInvoice = {
      vendorName: "Acme Logistics",
      taxId: "GSTIN-12345ABC",
      invoiceNumber: "INV-2026-001",
      date: "2026-10-10",
      subtotal: 100,
      taxAmount: 18,
      totalAmount: 118,
      lineItems: [
        { description: "Standard Support", quantity: 1, unitPrice: 100, amount: 100 },
      ],
    };

    const parsed = InvoiceSchema.parse(duplicateInvoice);
    const result = auditInvoiceData(parsed, true);

    expect(result.isDuplicate).toBe(true);
    expect(result.status).toBe("DUPLICATE_REJECTED");
    expect(result.issues.some((msg) => msg.includes("DUPLICATE INVOICE ALERT"))).toBe(true);
  });

  it("rejects invalid or corrupted payload schemas", () => {
    const malformedPayload = {
      vendorName: 12345,
      lineItems: "not-an-array",
    };

    expect(() => InvoiceSchema.parse(malformedPayload)).toThrow();
  });
});