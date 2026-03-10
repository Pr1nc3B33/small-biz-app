let currentAdjustProductId = null;
let adjustType = 'add';
let allProducts = [];

// ── INIT ──────────────────────────────────────────────
async function init() {
  await loadInventory();
  setupModals();
}

// ── LOAD INVENTORY ────────────────────────────────────
async function loadInventory() {
  allProducts = await ipcRenderer.invoke('inventory:get-all');

  const total = allProducts.length;
  const lowStock = allProducts.filter(p =>
    p.quantity > 0 && p.quantity <= p.low_stock_alert
  ).length;
  const outOfStock = allProducts.filter(p => p.quantity === 0).length;

  document.getElementById('totalProducts').textContent = total;
  document.getElementById('lowStockCount').textContent = lowStock;
  document.getElementById('outOfStockCount').textContent = outOfStock;

  const grid = document.getElementById('productGrid');

  if (!allProducts.length) {
    grid.innerHTML = '<div class="empty-state">No products yet — add your first product above</div>';
    return;
  }

  grid.innerHTML = `
    <div class="product-grid">
      ${allProducts.map(product => renderProductCard(product)).join('')}
    </div>`;
}

// ── RENDER PRODUCT CARD ───────────────────────────────
function renderProductCard(product) {
  const isOutOfStock = product.quantity === 0;
  const isLowStock = product.quantity > 0 && product.quantity <= product.low_stock_alert;

  const maxStock = Math.max(product.low_stock_alert * 3, product.quantity);
  const fillPct = Math.min((product.quantity / maxStock) * 100, 100);

  const barColor = isOutOfStock ? '#EF4444' : isLowStock ? '#F59E0B' : '#10B981';
  const qtyClass = isOutOfStock ? 'danger' : isLowStock ? 'warning' : '';

  const badge = isOutOfStock
    ? '<span class="badge badge-red">Out of Stock</span>'
    : isLowStock
    ? '<span class="badge badge-yellow">Low Stock</span>'
    : '<span class="badge badge-green">In Stock</span>';

  const pricesHtml = (product.unit_cost || product.sale_price)
    ? '<div class="product-prices">' +
      (product.unit_cost ? 'Cost: $' + parseFloat(product.unit_cost).toFixed(2) : '') +
      (product.unit_cost && product.sale_price ? ' · ' : '') +
      (product.sale_price ? 'Sell: $' + parseFloat(product.sale_price).toFixed(2) : '') +
      '</div>'
    : '';

  return `
    <div class="product-card ${isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
        <div class="product-name">${product.name}</div>
        ${badge}
      </div>
      <div class="product-sku">${product.sku || 'No SKU'}</div>

      <div class="stock-level">
        <div>
          <span class="stock-number ${qtyClass}">${product.quantity}</span>
          <span class="stock-unit"> ${product.unit || 'units'}</span>
        </div>
        <div style="font-size:11px; color:#64748B;">
          Alert at ${product.low_stock_alert}
        </div>
      </div>

      <div class="stock-bar-bg">
        <div class="stock-bar-fill" style="width:${fillPct}%; background:${barColor};"></div>
      </div>

      ${pricesHtml}

      <div class="product-actions">
        <button class="action-btn" onclick="openAdjustModal(${product.id}, '${product.name}')">
          📦 Adjust Stock
        </button>
        <button class="action-btn danger" onclick="deleteProduct(${product.id}, '${product.name}')">
          🗑️ Delete
        </button>
      </div>
    </div>`;
}

// ── SETUP MODALS ──────────────────────────────────────
function setupModals() {
  const addModal = document.getElementById('addProductModal');
  document.getElementById('addProductBtn').addEventListener('click', () => {
    clearProductForm();
    addModal.style.display = 'flex';
  });
  document.getElementById('closeProductModal').addEventListener('click', () =>
    addModal.style.display = 'none');
  document.getElementById('cancelProductBtn').addEventListener('click', () =>
    addModal.style.display = 'none');
  document.getElementById('saveProductBtn').addEventListener('click', saveProduct);

  const adjustModal = document.getElementById('adjustModal');
  document.getElementById('closeAdjustModal').addEventListener('click', () =>
    adjustModal.style.display = 'none');
  document.getElementById('cancelAdjustBtn').addEventListener('click', () =>
    adjustModal.style.display = 'none');
  document.getElementById('saveAdjustBtn').addEventListener('click', saveAdjustment);
}

// ── ADD PRODUCT ───────────────────────────────────────
function clearProductForm() {
  ['productName','productSku','productQty','productUnit',
   'productAlert','productCost','productSell','productDesc'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('productModalError').style.display = 'none';
}

async function saveProduct() {
  const name = document.getElementById('productName').value.trim();
  const errorDiv = document.getElementById('productModalError');

  if (!name) {
    errorDiv.textContent = 'Product name is required.';
    errorDiv.style.display = 'block';
    return;
  }

  const result = await ipcRenderer.invoke('inventory:add-product', {
    name,
    notes: document.getElementById('productDesc').value.trim(),
    quantity: parseInt(document.getElementById('productQty').value) || 0,
    unit: document.getElementById('productUnit').value.trim() || 'units',
    low_stock_alert: parseInt(document.getElementById('productAlert').value) || 10,
    unit_cost: parseFloat(document.getElementById('productCost').value) || null,
    sale_price: parseFloat(document.getElementById('productSell').value) || null,
    sku: document.getElementById('productSku').value.trim() || null,
  });

  if (!result.success) {
    errorDiv.textContent = result.message;
    errorDiv.style.display = 'block';
    return;
  }

  document.getElementById('addProductModal').style.display = 'none';
  await loadInventory();
}

// ── ADJUST STOCK ──────────────────────────────────────
function openAdjustModal(productId, productName) {
  currentAdjustProductId = productId;
  adjustType = 'add';

  document.getElementById('adjustTitle').textContent = 'Adjust Stock — ' + productName;
  document.getElementById('adjustAmount').value = '';
  document.getElementById('adjustReason').value = '';
  document.getElementById('adjustError').style.display = 'none';
  document.getElementById('addStockBtn').classList.add('active');
  document.getElementById('removeStockBtn').classList.remove('active');

  document.getElementById('adjustModal').style.display = 'flex';
}

function setAdjustType(type) {
  adjustType = type;
  document.getElementById('addStockBtn').classList.toggle('active', type === 'add');
  document.getElementById('removeStockBtn').classList.toggle('active', type === 'remove');
}

async function saveAdjustment() {
  const amount = parseInt(document.getElementById('adjustAmount').value);
  const reason = document.getElementById('adjustReason').value.trim();
  const errorDiv = document.getElementById('adjustError');

  if (!amount || amount <= 0) {
    errorDiv.textContent = 'Please enter a valid amount greater than 0.';
    errorDiv.style.display = 'block';
    return;
  }

  const adjustment = adjustType === 'add' ? amount : -amount;

  const result = await ipcRenderer.invoke('inventory:adjust-stock', {
    productId: currentAdjustProductId,
    adjustment,
    reason: reason || 'Manual adjustment',
  });

  if (!result.success) {
    errorDiv.textContent = result.message;
    errorDiv.style.display = 'block';
    return;
  }

  document.getElementById('adjustModal').style.display = 'none';
  await loadInventory();
}

// ── DELETE PRODUCT ────────────────────────────────────
async function deleteProduct(id, name) {
  const confirmed = confirm('Delete "' + name + '"? This cannot be undone.');
  if (!confirmed) return;

  const result = await ipcRenderer.invoke('inventory:delete-product', id);
  if (result.success) await loadInventory();
}

init();