const { ipcRenderer } = require('electron');
let selectedPositionId = null;
let allPositions = [];

// ── INIT ──────────────────────────────────────────────
async function init() {
  await loadPositions();
  setupModal();
}

// ── POSITIONS ─────────────────────────────────────────
async function loadPositions() {
  allPositions = await ipcRenderer.invoke('employees:get-positions');
  const container = document.getElementById('positionSelector');

  if (!allPositions.length) {
    container.innerHTML = '<div class="empty-state">No positions found</div>';
    return;
  }

  // Build position buttons — this is where we use a Set concept:
  // Each position is unique, no duplicates possible
  container.innerHTML = allPositions.map(pos => `
    <button 
      class="position-btn" 
      data-id="${pos.id}"
      onclick="selectPosition(${pos.id})"
    >
      <div class="pos-title">${pos.title}</div>
      <div class="pos-count">${pos.employee_count} active</div>
    </button>
  `).join('');

  // Also populate the modal dropdown
  const select = document.getElementById('positionSelect');
  select.innerHTML = allPositions.map(pos =>
    `<option value="${pos.id}">${pos.title}</option>`
  ).join('');

  // Auto-select first position
  if (allPositions.length > 0) {
    selectPosition(allPositions[0].id);
  }
}

// ── SELECT POSITION ───────────────────────────────────
async function selectPosition(positionId) {
  selectedPositionId = positionId;

  // Update active button styling
  document.querySelectorAll('.position-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.id) === positionId);
  });

  // Load employees for this position
  await loadEmployees(positionId);
}

// ── LOAD EMPLOYEES ────────────────────────────────────
async function loadEmployees(positionId) {
  const employees = await ipcRenderer.invoke('employees:get-by-position', positionId);
  const container = document.getElementById('employeeList');

  if (!employees.length) {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">No active employees in this position</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="employee-grid">
      ${employees.map(emp => `
        <div class="employee-card">
          <div class="employee-card-header">
            <div>
              <div class="employee-name">${emp.first_name} ${emp.last_name}</div>
              <div class="employee-meta">
                ${emp.email || 'No email'} · Hired ${formatDate(emp.hire_date)}
              </div>
            </div>
            <span class="badge badge-green">Active</span>
          </div>

          <div class="employee-stats">
            <div class="stat">
              <div class="stat-value">${emp.tasks_completed}</div>
              <div class="stat-label">Tasks Done</div>
            </div>
            <div class="stat">
              <div class="stat-value">${emp.phone || '—'}</div>
              <div class="stat-label">Phone</div>
            </div>
          </div>

          <div class="employee-actions">
            <button class="action-btn" onclick="editEmployee(${emp.id})">
              ✏️ Edit
            </button>
            <button class="action-btn danger" onclick="deactivateEmployee(${emp.id}, '${emp.first_name}')">
              🚫 Deactivate
            </button>
            <button class="action-btn" onclick="setEmployeePassword(${emp.id}, '${emp.first_name}')">
              🔑 Set Password
            </button>
          </div>
          </div>
        </div>
      `).join('')}
    </div>`;
}

// ── MODAL ─────────────────────────────────────────────
function setupModal() {
  const modal = document.getElementById('addModal');
  const addBtn = document.getElementById('addEmployeeBtn');
  const closeBtn = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const saveBtn = document.getElementById('saveEmployeeBtn');

  addBtn.addEventListener('click', () => {
    clearModal();
    modal.style.display = 'flex';
  });

  closeBtn.addEventListener('click', () => modal.style.display = 'none');
  cancelBtn.addEventListener('click', () => modal.style.display = 'none');

  saveBtn.addEventListener('click', saveEmployee);
}

function clearModal() {
  document.getElementById('firstName').value = '';
  document.getElementById('lastName').value = '';
  document.getElementById('email').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('hireDate').value = '';
  document.getElementById('modalError').style.display = 'none';
}

// ── SAVE EMPLOYEE ─────────────────────────────────────
async function saveEmployee() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const positionId = document.getElementById('positionSelect').value;
  const hireDate = document.getElementById('hireDate').value;
  const errorDiv = document.getElementById('modalError');

  // Validation — this is where regex comes in
  if (!firstName || !lastName) {
    errorDiv.textContent = 'First and last name are required.';
    errorDiv.style.display = 'block';
    return;
  }

  // Email regex validation
  if (email) {
    const emailPattern = /^[\w.-]+@[\w.-]+\.\w+$/;
    if (!emailPattern.test(email)) {
      errorDiv.textContent = 'Please enter a valid email address.';
      errorDiv.style.display = 'block';
      return;
    }
  }

  // Phone regex validation — allows (555) 555-5555 or 555-555-5555 or 5555555555
  if (phone) {
    const phonePattern = /^[\d\s\-\(\)]{7,15}$/;
    if (!phonePattern.test(phone)) {
      errorDiv.textContent = 'Please enter a valid phone number.';
      errorDiv.style.display = 'block';
      return;
    }
  }

  const result = await ipcRenderer.invoke('employees:add', {
    first_name: firstName,
    last_name: lastName,
    email: email || null,
    phone: phone || null,
    position_id: parseInt(positionId),
    hire_date: hireDate || null,
  });

  if (!result.success) {
    errorDiv.textContent = result.message;
    errorDiv.style.display = 'block';
    return;
  }

  // Success — close modal and reload
  document.getElementById('addModal').style.display = 'none';
  await loadPositions();
  if (selectedPositionId) {
    selectPosition(parseInt(positionId));
  }
}

// ── DEACTIVATE ────────────────────────────────────────
async function deactivateEmployee(id, name) {
  const confirmed = confirm(`Deactivate ${name}? They will no longer appear in active lists.`);
  if (!confirmed) return;

  const result = await ipcRenderer.invoke('employees:deactivate', id);
  if (result.success) {
    await loadPositions();
    if (selectedPositionId) selectPosition(selectedPositionId);
  }
}
// ── EDIT (placeholder) ────────────────────────────────
function editEmployee(id) {
  alert(`Edit employee ${id} — coming soon!`);
}

// ── HELPERS ───────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });
}
async function setEmployeePassword(id, name) {
  const password = prompt(`Set portal password for ${name}:`);
  if (!password) return;

  const result = await ipcRenderer.invoke('employee:set-password', {
    employeeId: id,
    password
  });

  if (result.success) {
    alert(`Password set for ${name} successfully!`);
  } else {
    alert(`Failed: ${result.message}`);
  }
}
init();