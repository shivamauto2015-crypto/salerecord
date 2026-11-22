const STORE_KEY = "autoparts_sales_v1";
let challans = loadData();
let itemCounter = 0;
let modalConfirmHandler = null;

const $ = (id) => document.getElementById(id);

const money = (n) =>
  "₹" +
  (Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const todayISO = () => new Date().toISOString().slice(0, 10);

function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(d) ? d : [];
  } catch (e) {
    return [];
  }
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(challans));
  renderAll();
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function openConfirm({ title, message, confirmText = "Confirm", destructive = false, onConfirm }) {
  $("modal-title").textContent = title;
  $("modal-message").textContent = message;
  const confirmBtn = $("modal-confirm");
  confirmBtn.textContent = confirmText;
  confirmBtn.className = destructive ? "btn btn-danger" : "btn btn-primary";
  modalConfirmHandler = onConfirm;
  $("confirm-modal").classList.add("open");
  $("confirm-modal").setAttribute("aria-hidden", "false");
}

function closeConfirm() {
  $("confirm-modal").classList.remove("open");
  $("confirm-modal").setAttribute("aria-hidden", "true");
  modalConfirmHandler = null;
}

$("modal-cancel").addEventListener("click", closeConfirm);
$("modal-confirm").addEventListener("click", () => {
  const handler = modalConfirmHandler;
  closeConfirm();
  if (typeof handler === "function") handler();
});

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $(name + "-view").classList.add("active");
  document
    .querySelectorAll(".nav-link[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $("page-title").textContent = {
    dashboard: "Dashboard",
    "new-sale": $("editing-id").value ? "Edit Challan" : "New Challan",
    records: "Sale Records",
    backup: "Backup & Export",
  }[name];

  if (name === "records") renderRecords();
  if (name === "backup") $("backup-count").textContent = challans.length;
  window.scrollTo(0, 0);
}

document
  .querySelectorAll("[data-view]")
  .forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.view === "new-sale") {
      openNew();
    } else {
      showView(b.dataset.view);
    }
  }));

document
  .querySelectorAll("[data-go]")
  .forEach((b) => b.addEventListener("click", () => showView(b.dataset.go)));

function blankItem() {
  return {
    partName: "",
    partNumber: "",
    qty: 1,
    rate: 0,
    discountType: "rupees",
    discount: 0,
  };
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );
}

function addItem(item = blankItem()) {
  const id = ++itemCounter;
  const tr = document.createElement("tr");
  tr.dataset.itemId = id;
  tr.innerHTML = `
    <td><input class="part-name" placeholder="Part name" value="${escapeAttr(item.partName)}" required></td>
    <td><input class="part-no" placeholder="Part number" value="${escapeAttr(item.partNumber)}"></td>
    <td><input class="qty" type="number" min="1" step="1" value="${item.qty || 1}"></td>
    <td><input class="rate" type="number" min="0" step="0.01" value="${item.rate || 0}"></td>
    <td>
      <select class="discount-type">
        <option value="rupees">₹ Amount</option>
        <option value="percentage">Percent %</option>
      </select>
    </td>
    <td><input class="discount" type="number" min="0" step="0.01" value="${item.discount || 0}"></td>
    <td class="calc-cell">₹0.00</td>
    <td>
      <button type="button" class="remove-item" title="Delete part" aria-label="Delete part">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18"></path>
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
          <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
        </svg>
      </button>
    </td>
  `;
  $("items-body").appendChild(tr);
  tr.querySelector(".discount-type").value = item.discountType || "rupees";
  tr.querySelectorAll("input,select").forEach((el) =>
    el.addEventListener("input", updateTotals)
  );
  tr.querySelector(".remove-item").addEventListener("click", () => {
    if ($("items-body").children.length === 1) {
      toast("At least one part is required");
      return;
    }
    tr.remove();
    updateTotals();
  });
  updateTotals();
  return tr;
}

function readItems() {
  return [...$("items-body").querySelectorAll("tr")].map((tr) => {
    const qty = Math.max(1, Number(tr.querySelector(".qty").value) || 1);
    const rate = Math.max(0, Number(tr.querySelector(".rate").value) || 0);
    const gross = qty * rate;
    const type = tr.querySelector(".discount-type").value;
    const raw = Math.max(0, Number(tr.querySelector(".discount").value) || 0);
    const discount = Math.min(
      gross,
      type === "percentage" ? (gross * raw) / 100 : raw
    );

    return {
      partName: tr.querySelector(".part-name").value.trim(),
      partNumber: tr.querySelector(".part-no").value.trim(),
      qty,
      rate,
      discountType: type,
      discountInput: raw,
      subtotal: gross,
      discount,
      total: gross - discount,
    };
  });
}

function updateTotals() {
  let sub = 0;
  let disc = 0;
  [...$("items-body").querySelectorAll("tr")].forEach((tr) => {
    const qty = Math.max(1, Number(tr.querySelector(".qty").value) || 1);
    const rate = Math.max(0, Number(tr.querySelector(".rate").value) || 0);
    const gross = qty * rate;
    const type = tr.querySelector(".discount-type").value;
    const raw = Math.max(0, Number(tr.querySelector(".discount").value) || 0);
    const d = Math.min(gross, type === "percentage" ? (gross * raw) / 100 : raw);
    sub += gross;
    disc += d;
    tr.querySelector(".calc-cell").textContent = money(gross - d);
  });
  $("subtotal").textContent = money(sub);
  $("discount-total").textContent = money(disc);
  $("net-total").textContent = money(sub - disc);
}

function nextChallanNo() {
  let max = 0;
  challans.forEach((c) => {
    const m = String(c.challanNo || "").match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return "CH-" + String(max + 1).padStart(3, "0");
}

function resetForm() {
  $("sale-form").reset();
  $("editing-id").value = "";
  $("form-heading").textContent = "Create new challan";
  $("form-mode-label").textContent = "New sale entry";
  $("save-btn").textContent = "Save Challan";
  $("challan-no").value = nextChallanNo();
  $("sale-date").value = todayISO();
  $("items-body").innerHTML = "";
  addItem();
  updateTotals();
}

function focusField(el, selectText = false) {
  if (!el) return;
  el.focus();
  if (selectText && typeof el.select === "function") {
    el.select();
  }
}

function openNew() {
  resetForm();
  showView("new-sale");
  requestAnimationFrame(() => focusField($("challan-no"), true));
}

$("add-item").addEventListener("click", () => {
  const newRow = addItem();
  const firstInput = newRow?.querySelector("input");
  if (firstInput) {
    firstInput.scrollIntoView({ block: "nearest", behavior: "smooth" });
    focusField(firstInput);
  }
});
$("header-add").addEventListener("click", openNew);
$("records-add").addEventListener("click", openNew);
$("cancel-form").addEventListener("click", () => showView("dashboard"));

$("sale-form").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.isComposing) return;
  const target = e.target;
  if (!target || target.tagName === "BUTTON") return;
  if (!target.matches("input, select")) return;

  e.preventDefault();

  if (target.id === "challan-no") {
    focusField($("sale-date"));
    return;
  }
  if (target.id === "sale-date") {
    focusField($("customer"));
    return;
  }
  if (target.id === "customer") {
    focusField($("remarks"));
    return;
  }
  if (target.id === "remarks") {
    focusField($("items-body").querySelector("tr .part-name"));
    return;
  }

  const row = target.closest("#items-body tr");
  if (!row) return;

  if (target.classList.contains("part-name")) {
    focusField(row.querySelector(".part-no"));
    return;
  }
  if (target.classList.contains("part-no")) {
    focusField(row.querySelector(".qty"), true);
    return;
  }
  if (target.classList.contains("qty")) {
    focusField(row.querySelector(".rate"), true);
    return;
  }
  if (
    target.classList.contains("rate") ||
    target.classList.contains("discount-type") ||
    target.classList.contains("discount")
  ) {
    const nextRow = row.nextElementSibling;
    if (nextRow) {
      focusField(nextRow.querySelector(".part-name"));
    } else {
      const form = $("sale-form");
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        $("save-btn").click();
      }
    }
  }
});

$("sale-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const items = readItems();
  if (!items.length || items.some((i) => !i.partName)) {
    toast("Please enter a part name for every item");
    return;
  }
  const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
  const discount = items.reduce((a, i) => a + i.discount, 0);
  const editingId = $("editing-id").value;

  const record = {
    id: editingId || "sale_" + Date.now(),
    challanNo: $("challan-no").value.trim(),
    date: $("sale-date").value,
    customer: $("customer").value.trim(),
    remarks: $("remarks").value.trim(),
    items,
    subtotal,
    discount,
    netTotal: subtotal - discount,
    updatedAt: new Date().toISOString(),
  };

  if (!record.challanNo) {
    toast("Please enter challan number");
    return;
  }

  const duplicate = challans.some(
    (c) =>
      c.challanNo.toLowerCase() === record.challanNo.toLowerCase() &&
      c.id !== editingId
  );
  if (duplicate) {
    toast("This challan number already exists");
    return;
  }

  if (editingId) {
    const existing = challans.find((c) => c.id === editingId);
    record.createdAt = existing?.createdAt || record.updatedAt;
    challans = challans.map((c) => (c.id === editingId ? record : c));
    toast("Challan updated successfully");
  } else {
    record.createdAt = record.updatedAt;
    challans.unshift(record);
    toast("Challan saved successfully");
  }

  $("editing-id").value = "";
  saveData();
  showView("records");
});

function formatDate(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  const [y, m, day] = parts;
  return `${day}/${m}/${y}`;
}

function renderAll() {
  renderDashboard();
  renderRecords();
  $("backup-count").textContent = challans.length;
}

function renderDashboard() {
  const total = challans.reduce((a, c) => a + c.netTotal, 0);
  const disc = challans.reduce((a, c) => a + c.discount, 0);
  const qty = challans.reduce(
    (a, c) => a + c.items.reduce((s, i) => s + i.qty, 0),
    0
  );
  $("stat-sales").textContent = money(total);
  $("stat-challans").textContent = challans.length;
  $("stat-discount").textContent = money(disc);
  $("stat-qty").textContent = qty;

  const recent = challans
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  $("recent-table").innerHTML = recent
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.challanNo)}</td>
        <td>${formatDate(c.date)}</td>
        <td>${escapeHtml(c.customer || "—")}</td>
        <td>${c.items.length} item(s)</td>
        <td class="num amount">${money(c.netTotal)}</td>
        <td class="num"><span class="status-saved">Saved</span></td>
      </tr>`
    )
    .join("");

  $("recent-empty").style.display = recent.length ? "none" : "block";
}

function renderRecords() {
  const q = $("search-records").value.toLowerCase();
  const from = $("filter-from").value;
  const to = $("filter-to").value;

  const rows = challans
    .filter(
      (c) =>
        (!from || c.date >= from) &&
        (!to || c.date <= to) &&
        (!q ||
          [
            c.challanNo,
            c.customer,
            ...c.items.flatMap((i) => [i.partName, i.partNumber]),
          ]
            .join(" ")
            .toLowerCase()
            .includes(q))
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  $("records-table").innerHTML = rows
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.challanNo)}</td>
        <td>${formatDate(c.date)}</td>
        <td>${escapeHtml(c.customer || "—")}</td>
        <td class="num">${c.items.length}</td>
        <td class="num">${money(c.subtotal)}</td>
        <td class="num">${money(c.discount)}</td>
        <td class="num amount">${money(c.netTotal)}</td>
        <td class="num">
          <button type="button" class="action-btn" data-edit="${c.id}">Edit</button>
          <button type="button" class="action-btn delete" data-delete="${c.id}">Delete</button>
        </td>
      </tr>`
    )
    .join("");

  $("records-empty").style.display = rows.length ? "none" : "block";

  $("records-table")
    .querySelectorAll("[data-edit]")
    .forEach((b) => b.addEventListener("click", () => editRecord(b.dataset.edit)));

  $("records-table")
    .querySelectorAll("[data-delete]")
    .forEach((b) =>
      b.addEventListener("click", () => deleteRecord(b.dataset.delete))
    );
}

function editRecord(id) {
  const c = challans.find((x) => x.id === id);
  if (!c) return;
  resetForm();
  $("editing-id").value = c.id;
  $("form-heading").textContent = "Edit challan";
  $("form-mode-label").textContent = "Editing existing record";
  $("save-btn").textContent = "Update Challan";
  $("challan-no").value = c.challanNo;
  $("sale-date").value = c.date;
  $("customer").value = c.customer || "";
  $("remarks").value = c.remarks || "";
  $("items-body").innerHTML = "";
  c.items.forEach((i) =>
    addItem({
      partName: i.partName,
      partNumber: i.partNumber,
      qty: i.qty,
      rate: i.rate,
      discountType: i.discountType,
      discount: i.discountInput ?? i.discount,
    })
  );
  updateTotals();
  showView("new-sale");
}

function deleteRecord(id) {
  const c = challans.find((x) => x.id === id);
  if (!c) return;
  openConfirm({
    title: "Delete challan",
    message: `Delete challan ${c.challanNo}? This cannot be undone.`,
    confirmText: "Delete Challan",
    destructive: true,
    onConfirm: () => {
      challans = challans.filter((x) => x.id !== id);
      saveData();
      toast("Challan deleted");
    },
  });
}

["search-records", "filter-from", "filter-to"].forEach((id) =>
  $(id).addEventListener("input", renderRecords)
);

$("clear-filters").addEventListener("click", () => {
  $("search-records").value = "";
  $("filter-from").value = "";
  $("filter-to").value = "";
  renderRecords();
});

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

$("export-json").addEventListener("click", () => {
  downloadBlob(
    new Blob(
      [
        JSON.stringify(
          {
            app: "AutoParts Sales Manager",
            version: 1,
            exportedAt: new Date().toISOString(),
            challans,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    ),
    `autoparts-backup-${todayISO()}.json`
  );
  toast("JSON backup downloaded");
});

$("import-json").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.challans;
    if (!Array.isArray(incoming)) throw new Error("Invalid backup format");
    openConfirm({
      title: "Restore JSON backup",
      message: `Import ${incoming.length} challans? This will replace the current data.`,
      confirmText: "Restore Backup",
      destructive: false,
      onConfirm: () => {
        challans = incoming;
        saveData();
        toast("Backup restored successfully");
      },
    });
  } catch (err) {
    toast("Could not import this JSON file. Select a valid AutoParts backup.");
  }
});

$("export-excel").addEventListener("click", () => {
  if (!challans.length) {
    toast("There are no records to export");
    return;
  }
  if (typeof XLSX === "undefined") {
    toast("Excel library unavailable. Reload and try again.");
    return;
  }

  const summary = challans.map((c) => ({
    "Challan Number": c.challanNo,
    Date: c.date,
    Customer: c.customer || "",
    Items: c.items.length,
    Subtotal: c.subtotal,
    Discount: c.discount,
    "Net Amount": c.netTotal,
    Remarks: c.remarks || "",
  }));

  const details = [];
  challans.forEach((c) =>
    c.items.forEach((i) =>
      details.push({
        "Challan Number": c.challanNo,
        Date: c.date,
        Customer: c.customer || "",
        "Part Name": i.partName,
        "Part Number": i.partNumber,
        Quantity: i.qty,
        Rate: i.rate,
        "Gross Amount": i.subtotal,
        "Discount Type": i.discountType,
        "Discount Amount": i.discount,
        "Net Amount": i.total,
      })
    )
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summary),
    "Challan Summary"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(details),
    "Part Details"
  );
  XLSX.writeFile(wb, `autoparts-sales-${todayISO()}.xlsx`);
  toast("Excel file exported");
});

function buildPrintableChallanHtml(challan) {
  const rowsHtml = challan.items
    .map((item, index) => {
      const discountLabel =
        item.discountType === "percentage" && item.discountInput > 0
          ? `${money(item.discount)} (${item.discountInput}%)`
          : money(item.discount);
      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(item.partName || "—")}</td>
          <td class="mono">${escapeHtml(item.partNumber || "—")}</td>
          <td class="num">${item.qty}</td>
          <td class="num">${money(item.rate)}</td>
          <td class="num">${discountLabel}</td>
          <td class="num strong">${money(item.total)}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Challan ${escapeHtml(challan.challanNo || "")}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #f3f4f6;
      font-size: 13px;
      line-height: 1.45;
    }
    .toolbar {
      max-width: 820px;
      margin: 0 auto 14px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .toolbar button {
      border: 1px solid #d1d5db;
      background: #fff;
      color: #111827;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .toolbar button.primary {
      background: #17243b;
      border-color: #17243b;
      color: #fff;
    }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #d1d5db;
      padding: 28px 32px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #111827;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand h1 {
      margin: 0;
      font-size: 20px;
      letter-spacing: 0.2px;
    }
    .brand p {
      margin: 3px 0 0;
      color: #4b5563;
      font-size: 12px;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-meta .title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #4b5563;
    }
    .doc-meta .no {
      font-size: 17px;
      font-weight: 700;
      margin: 2px 0;
    }
    .doc-meta .date {
      font-size: 12px;
      color: #374151;
    }
    .party-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
      margin-bottom: 18px;
      padding: 10px 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
    }
    .party-grid span {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      font-weight: 700;
    }
    .party-grid strong {
      display: block;
      margin-top: 2px;
      font-size: 13px;
      color: #111827;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 10px;
      font-size: 12px;
      text-align: left;
      font-variant-numeric: tabular-nums;
    }
    th {
      background: #f3f4f6;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #374151;
    }
    .num { text-align: right; }
    .center { text-align: center; width: 40px; }
    .mono { font-family: monospace; }
    .strong { font-weight: 700; }
    .summary-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 34px;
    }
    .summary {
      width: 260px;
      border: 1px solid #d1d5db;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .summary-row.total {
      border-bottom: 0;
      background: #f9fafb;
      font-size: 14px;
      font-weight: 700;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 42px;
      padding-top: 10px;
      font-size: 11px;
      color: #4b5563;
    }
    .sig-line {
      width: 180px;
      border-top: 1px solid #9ca3af;
      padding-top: 5px;
      text-align: center;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .sheet {
        border: 0;
        padding: 0;
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.close()">Close</button>
    <button type="button" class="primary" onclick="window.print()">Print Challan</button>
  </div>

  <div class="sheet">
    <div class="header">
      <div class="brand">
        <h1>AutoParts</h1>
        <p>Spare Parts Sale Challan</p>
      </div>
      <div class="doc-meta">
        <div class="title">Delivery / Sale Challan</div>
        <div class="no">${escapeHtml(challan.challanNo || "—")}</div>
        <div class="date">Date: ${escapeHtml(formatDate(challan.date))}</div>
      </div>
    </div>

    <div class="party-grid">
      <div>
        <span>Customer / Party</span>
        <strong>${escapeHtml(challan.customer || "Walk-in Customer")}</strong>
      </div>
      <div>
        <span>Remarks</span>
        <strong>${escapeHtml(challan.remarks || "—")}</strong>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Part Name</th>
          <th>Part Number</th>
          <th class="num">Qty</th>
          <th class="num">Rate (₹)</th>
          <th class="num">Discount</th>
          <th class="num">Net Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="summary-wrap">
      <div class="summary">
        <div class="summary-row">
          <span>Subtotal</span>
          <strong>${money(challan.subtotal)}</strong>
        </div>
        <div class="summary-row">
          <span>Total Discount</span>
          <strong>${money(challan.discount)}</strong>
        </div>
        <div class="summary-row total">
          <span>Net Payable</span>
          <strong>${money(challan.netTotal)}</strong>
        </div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-line">Receiver's Signature</div>
      <div class="sig-line">Authorized Signatory</div>
    </div>
  </div>

  <script>
    window.addEventListener("load", function () {
      setTimeout(function () {
        window.print();
      }, 200);
    });
  </script>
</body>
</html>`;
}

$("print-challan").addEventListener("click", () => {
  const items = readItems();
  const hasContent = items.some(
    (i) => i.partName || i.partNumber || i.rate > 0
  );
  if (!hasContent) {
    toast("Please enter at least one part before printing");
    return;
  }

  const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
  const discount = items.reduce((a, i) => a + i.discount, 0);
  const challan = {
    challanNo: $("challan-no").value.trim() || "DRAFT",
    date: $("sale-date").value || todayISO(),
    customer: $("customer").value.trim(),
    remarks: $("remarks").value.trim(),
    items: items.filter((i) => i.partName || i.partNumber || i.rate > 0),
    subtotal,
    discount,
    netTotal: subtotal - discount,
  };

  const html = buildPrintableChallanHtml(challan);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});

if (window.location.protocol === "file:") {
  const zipPanel = $("zip-download-panel");
  if (zipPanel) zipPanel.style.display = "none";
}

$("today-label").textContent = new Date().toLocaleDateString("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
$("sale-date").value = todayISO();
resetForm();
renderAll();
