import { z } from "zod";

export const LineItemSchema = z.object({
  description: z.string().default("Item"),
  quantity: z.number().default(1),
  unitPrice: z.number().default(0),
  amount: z.number().default(0),
});

export const InvoiceSchema = z.object({
  vendorName: z.string().default("Unknown Vendor"),
  taxId: z.string().nullable().optional(),
  invoiceNumber: z.string().default("N/A"),
  date: z.string().default("N/A"),
  subtotal: z.number().default(0),
  taxAmount: z.number().default(0),
  totalAmount: z.number().default(0),
  lineItems: z.array(LineItemSchema).default([]),
});

export type InvoiceData = z.infer<typeof InvoiceSchema>;

export interface AuditVerificationResult {
  isValid: boolean;
  issues: string[];
  isDuplicate: boolean;
  status: "PASSED" | "FLAGGED" | "DUPLICATE_REJECTED";
  verifiedLineItems: Array<
    z.infer<typeof LineItemSchema> & {
      expectedAmount: number;
      hasMathMismatch: boolean;
    }
  >;
}

export function auditInvoiceData(
  parsedData: InvoiceData,
  hasExistingDuplicate = false
): AuditVerificationResult {
  const issues: string[] = [];
  let isDuplicate = false;

  if (hasExistingDuplicate) {
    isDuplicate = true;
    issues.push(
      `DUPLICATE INVOICE ALERT: Invoice #${parsedData.invoiceNumber} from "${parsedData.vendorName}" was already processed.`
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

  return {
    isValid,
    issues,
    isDuplicate,
    status,
    verifiedLineItems,
  };
}