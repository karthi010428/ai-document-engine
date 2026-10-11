# AI Invoice Audit Engine

[![CI](https://github.com/karthi010428/ai-document-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/karthi010428/ai-document-engine/actions)

Upload an invoice (PDF or image). Gemini extracts structured data, and multi-tier Zod rules audit it for duplicate bills, line-item arithmetic mismatches, and tax discrepancies.

**Live demo:** [https://ai-document-engine-nu.vercel.app/](https://ai-document-engine-nu.vercel.app/)

![AI Invoice Audit Engine Dashboard](https://raw.githubusercontent.com/karthi010428/karthi010428/main/aidoc.png)

## Key Features

* **Multimodal Extraction:** Extracts vendor, invoice ID, line items, and tax breakdown using Google Gemini.
* **Arithmetic Gates:** Validates quantity × unit price == line total and checks computed tax against invoice totals.
* **Integrity Validation:** Detects duplicate invoice numbers against MongoDB Atlas records.
* **Review Dashboard:** Provides interactive spend charts, vendor risk score metrics, and automated dispute notices.

## Tech Stack

Next.js (App Router), TypeScript, Tailwind CSS, Google Gemini API, MongoDB Atlas, Zod

## Local Setup

1. Clone the repo:
git clone [https://github.com/karthi010428/ai-document-engine.git](https://github.com/karthi010428/ai-document-engine.git)
cd ai-document-engine
2. Install dependencies:
npm install
3. Create .env.local with your credentials:
GEMINI_API_KEY=your_gemini_key
MONGODB_URI=your_mongodb_uri
4. Run development server:
npm run dev
5. Open http://localhost:3000 in your browser.

## License

MIT
