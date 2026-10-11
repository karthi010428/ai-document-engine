# AI Invoice Audit Engine

Upload an invoice (PDF or image). Gemini extracts structured data, and multi-tier Zod rules audit it for duplicate bills, line-item arithmetic mismatches, and tax discrepancies.

**Live demo:** https://ai-document-engine-nu.vercel.app/

## Key Features
- **Multimodal Extraction:** Extracts vendor, invoice ID, line items, and tax breakdown using Google Gemini.
- **Arithmetic Gates:** Validates `quantity × unit_price == line_total` and checks computed tax against invoice totals.
- **Integrity Validation:** Detects duplicate invoice numbers against MongoDB Atlas records.
- **Review Dashboard:** Provides interactive spend charts, vendor risk score metrics, and automated dispute notices.

## Tech Stack
Next.js (App Router), TypeScript, Tailwind CSS, Google Gemini API, MongoDB Atlas, Zod

## Local Setup
1. Clone the repo:
   ```bash
   git clone [https://github.com/karthi010428/ai-document-engine.git](https://github.com/karthi010428/ai-document-engine.git)
   cd ai-document-engine
