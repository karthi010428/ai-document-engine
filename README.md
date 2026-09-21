Step 1: Update your local README.md
In your VS Code terminal, open or create README.md at the project root and replace its contents entirely with the text below:

Markdown
# Autonomous AI Accounts Payable (AP) Auditor & Risk Engine

An autonomous, full-stack Accounts Payable auditing platform built with Next.js, Google Gemini Flash, and MongoDB Atlas. The engine automates invoice ingestion, line-item arithmetic verification, duplicate-invoice fraud detection, and vendor risk profiling.

- **Live Application:** [https://ai-document-engine-nu.vercel.app/](https://ai-document-engine-nu.vercel.app/)
- **Repository:** [https://github.com/karthi010428/ai-document-engine](https://github.com/karthi010428/ai-document-engine)

---

## 🛠️ Architecture & Tech Stack

- **Frontend & App Layer:** Next.js (App Router), React, Tailwind CSS, TypeScript
- **AI / Multimodal OCR Engine:** Google Gemini 2.5 Flash (`@google/genai` SDK)
- **Database Layer:** MongoDB Atlas (Global Serverless Cluster via native Node driver)
- **Deployment & Edge Infrastructure:** Vercel (CI/CD connected to GitHub `main`)

---

## 📋 Complete Setup & Replication Guide (Click-by-Click)

Follow these exact steps to recreate, configure, run, and deploy this system from a blank machine.

---

### Part 1: Google Gemini API Provisioning

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google Account.
3. In the top-left navigation, click **Get API key**.
4. Click **Create API key** -> select or create a Google Cloud Project -> confirm.
5. Copy the generated API key string (starts with `AIzaSy...`).
6. Store this temporarily in a safe scratchpad; this will be your `GEMINI_API_KEY`.

---

### Part 2: MongoDB Atlas Setup & Network Whitelisting

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in or create an account.
2. **Create a Free Cluster:**
   - Click **Create Deployment** -> select the **M0 Free** tier.
   - Choose your nearest cloud region (e.g., AWS / Mumbai or N. Virginia).
   - Name the cluster (e.g., `Cluster0`) and click **Create**.
3. **Configure Database User Credentials:**
   - Under the **Security** tab on the left sidebar, click **Database Access**.
   - Click **Add New Database User**.
   - Set **Authentication Method** to `Password`.
   - Create a username (e.g., `db_user`) and a secure password.
   - Set user privileges to **Read and write to any database**.
   - Click **Add User**.
4. **Configure Network Whitelist (Crucial for Vercel):**
   - On the left sidebar, click **Network Access**.
   - Click **Add IP Address**.
   - Click **Allow Access from Anywhere** (adds `0.0.0.0/0`).
     > *Why `0.0.0.0/0` is required:* Serverless hosts like Vercel spin up dynamic execution containers with non-static IP addresses. Restricting to a local residential IP will cause production API routes to hang and fail with network timeouts.
   - Click **Confirm**.
5. **Obtain Connection String:**
   - Navigate to **Database** -> click **Connect** on your cluster.
   - Select **Drivers** -> Driver: `Node.js`, Version: `6.7 or later`.
   - Copy the connection URI:
     ```text
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
     ```
   - Replace `<username>` and `<password>` with the actual database credentials you created in Step 3.

---

### Part 3: Local Repository Configuration & Dependencies

1. Open your terminal in the directory where you want the project:
   ```bash
   git clone [https://github.com/karthi010428/ai-document-engine.git](https://github.com/karthi010428/ai-document-engine.git)
   cd ai-document-engine
Install all pinned dependencies:

Bash
npm install
Create your local environment file:

Create a file named .env.local in the project root:

Code snippet
GEMINI_API_KEY=your_gemini_api_key_here
MONGODB_URI=your_mongodb_atlas_connection_string_here
Part 4: Secret Hygiene & Git Protection
To prevent exposing database credentials and API tokens to public version control:

Confirm .gitignore includes all environment variations:

Code snippet
.env
.env*.local
.env.local
Check your staging status before every commit:

Bash
git status
Verification: Ensure .env or .env.local never appear under Changes to be committed.

Part 5: Local Testing & Model Verification
Start the local Next.js development server:

Bash
npm run dev
Open your browser and navigate to:

Plaintext
http://localhost:3000
Confirm the status badge displays "MongoDB Atlas Connected".

Upload an invoice image or PDF to verify the model extracts line items, validates tax calculations, and logs the transaction.

Part 6: Production Deployment to Vercel
Push your latest code to GitHub:

Bash
git add .
git commit -m "feat: complete project documentation"
git push origin main
Log into Vercel using your GitHub credentials.

Click Add New... -> Project -> locate ai-document-engine -> click Import.

Keep the Framework Preset as Next.js and leave the Root Directory as ./.

Expand the Environment Variables panel:

Name: GEMINI_API_KEY | Value: (Paste your Google AI Studio Key) -> Click Add

Name: MONGODB_URI | Value: (Paste your MongoDB Atlas URI) -> Click Add

Click Deploy.

Once build processes complete, Vercel provides the live production domain.

🔒 Security & Data Integrity
Credential Isolation: No tokens or connection strings are stored in code repositories. Environment variables are injected exclusively via runtime secrets.

Sanitized Parsing: Invoice data extraction adheres to structured JSON schemas with fallback error-handling for malformed inputs.

Idempotency & Fraud Guard: Ingestion pipelines verify vendor IDs and invoice serial numbers against historical ledgers to prevent double-payment vulnerabilities.


---

### Step 2: Commit and Push the README to GitHub

Run these commands in your VS Code terminal to update GitHub:

<Steps>
  <Step title="Stage and Commit">
    Save the `README.md` file in VS Code, then run:
    ```powershell
    git add README.md
    git commit -m "docs: add comprehensive replication and setup guide to README"
    ```
    *Verification:* Git should confirm `1 file changed` with additions.
  </Step>

  <Step title="Push to Remote">
    Push the commit to your GitHub repository:
    ```powershell
    git push origin main
    ```
    *Verification:* Refresh `[https://github.com/karthi010428/ai-document-engine](https://github.com/karthi010428/ai-document-engine)` in your browser to verify the fully rendered README is displayed on the main page.
  </Step>
</Steps>

<Elicitations message="What would you like to review next?">
  <Elicitation label="Review resume bullets" query="Can you help me write 3 strong resume bullet points for this project?"/>
  <Elicitation label="Check GitHub display" query="How can I verify that my GitHub repository looks clean and recruiter-ready?"/>
</Elicitations>
