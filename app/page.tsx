"use client";

import { useState, useEffect, useMemo } from "react";

export default function DocumentAuditDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentAudit, setCurrentAudit] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Editable form state for Human-in-the-Loop
  const [formData, setFormData] = useState<any>({
    vendorName: "",
    invoiceNumber: "",
    date: "",
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    taxId: "",
    lineItems: [],
  });

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/review");
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error("Failed to load audit trail:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcessDocument = async () => {
    if (!file) return alert("Please select an invoice image or PDF.");

    setLoading(true);
    setCopied(false);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(",")[1];

      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Image: base64String,
            mimeType: file.type || "application/pdf",
          }),
        });

        const result = await res.json();

        if (result.success) {
          setCurrentAudit(result);
          setFormData(result.data);
          fetchHistory();
        } else {
          alert(`Audit Failed: ${result.error}`);
        }
      } catch (err) {
        alert("Network error processing document");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleHumanOverride = async () => {
    if (!currentAudit?._id) return;

    try {
      const res = await fetch("/api/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentAudit._id,
          updatedData: formData,
        }),
      });

      const result = await res.json();
      if (result.success) {
        alert("Record verified and saved to MongoDB!");
        fetchHistory();
        setCurrentAudit((prev: any) => ({
          ...prev,
          audit: {
            ...prev.audit,
            status: "APPROVED_BY_HUMAN",
            isValid: true,
          },
        }));
      }
    } catch (err) {
      alert("Failed to update record");
    }
  };

  const copyEmailNotice = () => {
    if (currentAudit?.audit?.draftEmail) {
      navigator.clipboard.writeText(currentAudit.audit.draftEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // --- FEATURE 3: SPEND ANALYTICS & VENDOR RISK COMPUTATION ---
  const analytics = useMemo(() => {
    let totalSpend = 0;
    let interceptedValue = 0;
    let compliantCount = 0;
    const vendorMap: Record<string, { total: number; flaggedOrDuplicate: number; count: number }> = {};

    history.forEach((record) => {
      const amount = Number(record.data?.totalAmount) || 0;
      const status = record.audit?.status;
      const vendor = (record.data?.vendorName || "Unknown Vendor").trim();

      totalSpend += amount;

      if (status === "DUPLICATE_REJECTED" || status === "FLAGGED") {
        interceptedValue += amount;
      }

      if (status === "PASSED" || status === "APPROVED_BY_HUMAN") {
        compliantCount += 1;
      }

      if (!vendorMap[vendor]) {
        vendorMap[vendor] = { total: 0, flaggedOrDuplicate: 0, count: 0 };
      }
      vendorMap[vendor].total += amount;
      vendorMap[vendor].count += 1;
      if (status === "DUPLICATE_REJECTED" || status === "FLAGGED") {
        vendorMap[vendor].flaggedOrDuplicate += 1;
      }
    });

    const complianceRate = history.length > 0 ? ((compliantCount / history.length) * 100).toFixed(0) : "100";

    const vendorRiskList = Object.entries(vendorMap)
      .map(([name, stats]) => ({
        name,
        total: stats.total.toFixed(2),
        count: stats.count,
        riskScore: Math.round((stats.flaggedOrDuplicate / stats.count) * 100),
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 4);

    return {
      totalSpend: totalSpend.toFixed(2),
      interceptedValue: interceptedValue.toFixed(2),
      complianceRate,
      vendorRiskList,
    };
  }, [history]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        item.data?.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.data?.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || item.audit?.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [history, searchTerm, statusFilter]);

  const exportToCSV = () => {
    if (history.length === 0) return alert("No records to export.");

    const headers = [
      "ID",
      "Vendor Name",
      "Invoice Number",
      "Date",
      "Tax ID",
      "Subtotal",
      "Tax Amount",
      "Total Amount",
      "Status",
      "Created At",
    ];

    const rows = history.map((record) => [
      `"${record._id}"`,
      `"${record.data?.vendorName || ""}"`,
      `"${record.data?.invoiceNumber || ""}"`,
      `"${record.data?.date || ""}"`,
      `"${record.data?.taxId || ""}"`,
      record.data?.subtotal || 0,
      record.data?.taxAmount || 0,
      record.data?.totalAmount || 0,
      `"${record.audit?.status || ""}"`,
      `"${new Date(record.createdAt).toLocaleString()}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    if (status === "PASSED" || status === "APPROVED_BY_HUMAN") {
      return "bg-green-100 text-green-800 border-green-300";
    }
    if (status === "DUPLICATE_REJECTED") {
      return "bg-purple-100 text-purple-900 border-purple-300 font-extrabold";
    }
    return "bg-red-100 text-red-800 border-red-300";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-800">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-white border rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Accounts Payable Auditor</h1>
            <p className="text-sm text-gray-500">
              Autonomous line-item arithmetic, duplicate fraud prevention, and vendor risk intelligence.
            </p>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full border border-green-200">
            MongoDB Atlas Connected
          </span>
        </div>

        {/* Feature 3: Executive Spend Analytics KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Spend Audited</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">₹{analytics.totalSpend}</p>
            <p className="text-xs text-gray-400 mt-1">Across all historical vendor ledgers</p>
          </div>

          <div className="bg-white border border-purple-200 rounded-xl p-5 shadow-sm bg-purple-50/20">
            <p className="text-xs font-semibold text-purple-700 uppercase">Intercepted Discrepancy Value</p>
            <p className="text-2xl font-extrabold text-purple-900 mt-1">₹{analytics.interceptedValue}</p>
            <p className="text-xs text-purple-600 mt-1">Flagged anomalies & blocked double payments</p>
          </div>

          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Compliance Pass Rate</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{analytics.complianceRate}%</p>
            <p className="text-xs text-gray-400 mt-1">Documents verified without compliance dispute</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Document Inspection & Action Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Upload Invoice (Image or PDF)</label>
              <div className="flex gap-4 items-center">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <button
                  onClick={handleProcessDocument}
                  disabled={loading || !file}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors shrink-0"
                >
                  {loading ? "Auditing..." : "Audit Document"}
                </button>
              </div>
            </div>

            {currentAudit && (
              <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center pb-4 border-b">
                  <h2 className="text-lg font-bold text-gray-900">Audit Reconciliation Result</h2>
                  <span
                    className={`px-3 py-1 text-xs border rounded-full ${getStatusBadge(
                      currentAudit.audit.status
                    )}`}
                  >
                    STATUS: {currentAudit.audit.status}
                  </span>
                </div>

                {/* Issues Box */}
                {currentAudit.audit.issues?.length > 0 && (
                  <div
                    className={`p-4 border rounded-lg space-y-2 ${
                      currentAudit.audit.isDuplicate
                        ? "bg-purple-50 border-purple-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <h3
                      className={`text-sm font-semibold ${
                        currentAudit.audit.isDuplicate ? "text-purple-900" : "text-red-800"
                      }`}
                    >
                      {currentAudit.audit.isDuplicate
                        ? "🚨 Fraud & Compliance Alert (Duplicate Detected):"
                        : "Compliance & Reconciliation Alerts:"}
                    </h3>
                    <ul
                      className={`list-disc pl-5 text-sm space-y-1 ${
                        currentAudit.audit.isDuplicate ? "text-purple-800" : "text-red-700"
                      }`}
                    >
                      {currentAudit.audit.issues.map((issue: string, idx: number) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Line Item Breakdown Table */}
                {formData.lineItems?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-900">Line-Item Ledger Verification</h3>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                          <tr>
                            <th className="px-3 py-2">Item Description</th>
                            <th className="px-3 py-2 text-center">Qty</th>
                            <th className="px-3 py-2 text-right">Unit Price</th>
                            <th className="px-3 py-2 text-right">Billed Amount</th>
                            <th className="px-3 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {formData.lineItems.map((item: any, idx: number) => (
                            <tr
                              key={idx}
                              className={item.hasMathMismatch ? "bg-red-50/70" : "hover:bg-gray-50"}
                            >
                              <td className="px-3 py-2 font-medium text-gray-800">{item.description}</td>
                              <td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td>
                              <td className="px-3 py-2 text-right text-gray-600">₹{item.unitPrice}</td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-900">₹{item.amount}</td>
                              <td className="px-3 py-2 text-center">
                                {item.hasMathMismatch ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold">
                                    Expected ₹{item.expectedAmount}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-medium">
                                    Verified
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Auto Draft Email */}
                {currentAudit.audit.draftEmail && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                        Auto-Drafted Vendor Notice
                      </span>
                      <button
                        onClick={copyEmailNotice}
                        className="text-xs bg-white border border-amber-300 text-amber-900 font-semibold px-2.5 py-1 rounded shadow-sm hover:bg-amber-100"
                      >
                        {copied ? "Copied to Clipboard!" : "Copy Notice"}
                      </button>
                    </div>
                    <pre className="text-xs text-amber-950 font-mono whitespace-pre-wrap bg-white/70 p-3 rounded border border-amber-200/50">
                      {currentAudit.audit.draftEmail}
                    </pre>
                  </div>
                )}

                {/* Human Review Form */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-bold text-gray-900">Reconciled Document Data (Editable)</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Vendor Name</label>
                      <input
                        type="text"
                        value={formData.vendorName}
                        onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                        className="w-full border rounded-md p-2 bg-gray-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Invoice Number</label>
                      <input
                        type="text"
                        value={formData.invoiceNumber}
                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                        className="w-full border rounded-md p-2 bg-gray-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tax ID / GSTIN</label>
                      <input
                        type="text"
                        value={formData.taxId || ""}
                        placeholder="Enter if verified"
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        className="w-full border rounded-md p-2 bg-gray-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Invoice Date</label>
                      <input
                        type="text"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full border rounded-md p-2 bg-gray-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Subtotal</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.subtotal}
                        onChange={(e) => setFormData({ ...formData, subtotal: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded-md p-2 bg-gray-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tax Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.taxAmount}
                        onChange={(e) => setFormData({ ...formData, taxAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded-md p-2 bg-gray-50 focus:bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Total Amount Claimed</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.totalAmount}
                        onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded-md p-2 bg-gray-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleHumanOverride}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    Save & Approve Override to MongoDB
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Vendor Risk Intelligence + History */}
          <div className="space-y-6">
            {/* Feature 3: Vendor Risk Intelligence Widget */}
            <div className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center justify-between">
                <span>Vendor Risk Intelligence</span>
                <span className="text-[10px] uppercase font-semibold text-gray-400">Top Audited</span>
              </h2>
              {analytics.vendorRiskList.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No vendor risk profiles yet.</p>
              ) : (
                <div className="space-y-2">
                  {analytics.vendorRiskList.map((v, i) => (
                    <div key={i} className="p-2.5 bg-gray-50 rounded-lg border text-xs flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-800 truncate max-w-[140px]">{v.name}</p>
                        <p className="text-[11px] text-gray-500">₹{v.total} • {v.count} inv</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.riskScore > 50
                              ? "bg-red-100 text-red-700"
                              : v.riskScore > 0
                              ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {v.riskScore}% Discrepancy Risk
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MongoDB Audit Trail Panel */}
            <div className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h2 className="text-base font-bold text-gray-900">Audit Trail</h2>
                <button
                  onClick={exportToCSV}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-2.5 py-1.5 rounded border transition-colors"
                >
                  Export CSV
                </button>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search vendor or invoice #..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border rounded-md px-3 py-1.5 text-xs bg-gray-50 focus:bg-white"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border rounded-md px-3 py-1.5 text-xs bg-gray-50 focus:bg-white text-gray-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PASSED">Passed</option>
                  <option value="FLAGGED">Flagged</option>
                  <option value="DUPLICATE_REJECTED">Duplicate Rejected</option>
                  <option value="APPROVED_BY_HUMAN">Approved by Human</option>
                </select>
              </div>

              {filteredHistory.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">No matching audits found.</p>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pt-1">
                  {filteredHistory.map((record) => (
                    <div key={record._id} className="p-3 bg-gray-50 border rounded-lg text-xs space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span className="text-gray-800">{record.data?.vendorName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] border ${getStatusBadge(
                            record.audit?.status
                          )}`}
                        >
                          {record.audit?.status}
                        </span>
                      </div>
                      <div className="text-gray-500">Inv #{record.data?.invoiceNumber}</div>
                      <div className="flex justify-between text-gray-600 font-medium">
                        <span>Total: ₹{record.data?.totalAmount}</span>
                        <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// [milestone]: feat: implement multi-tier zod validation gates for data integrity
