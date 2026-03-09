const { ipcRenderer } = require('electron');

async function loadDashboard() {
  // Load all four panels
  await loadTodaySchedule();
  await loadTomorrowSchedule();
  await loadInventoryAlerts();
  await loadManagerNotes();
}

async function loadTodaySchedule() {
  const result = await ipcRenderer.invoke('dashboard:today-schedule');
  const container = document.getElementById('todaySchedule');
  const counter = document.getElementById('todayCount');

  if (!result || result.length === 0) {
    counter.textContent = '0 shifts';
    return;
  }

  counter.textContent = `${result.length} shift${result.length > 1 ? 's' : ''}`;
  container.innerHTML = result.map(shift => `
    <div style="padding: 10px 0; border-bottom: 1px solid #2D3748;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:600; color:#F1F5F9; font-size:14px;">
            ${shift.first_name} ${shift.last_name}
          </div>
          <div style="font-size:12px; color:#64748B; margin-top:2px;">
            ${shift.start_time} – ${shift.end_time}
            ${shift.position ? `· ${shift.position}` : ''}
          </div>
        </div>
        <span class="badge ${getStatusBadge(shift.status)}">${shift.status}</span>
      </div>
      ${shift.tasks ? `
        <div style="margin-top:8px; padding-left:8px; border-left:2px solid #2D3748;">
          ${shift.tasks.split('||').map(t => `
            <div style="font-size:12px; color:#94A3B8; padding:2px 0;">
              ✅ ${t}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function loadTomorrowSchedule() {
  const result = await ipcRenderer.invoke('dashboard:tomorrow-schedule');
  const container = document.getElementById('tomorrowSchedule');
  const counter = document.getElementById('tomorrowCount');

  if (!result || result.length === 0) {
    counter.textContent = '0 shifts';
    return;
  }

  counter.textContent = `${result.length} shift${result.length > 1 ? 's' : ''}`;
  container.innerHTML = result.map(shift => `
    <div style="padding: 10px 0; border-bottom: 1px solid #2D3748;">
      <div style="font-weight:600; color:#F1F5F9; font-size:14px;">
        ${shift.first_name} ${shift.last_name}
      </div>
      <div style="font-size:12px; color:#64748B; margin-top:2px;">
        ${shift.start_time} – ${shift.end_time}
        ${shift.position ? `· ${shift.position}` : ''}
      </div>
    </div>
  `).join('');
}

async function loadInventoryAlerts() {
  const result = await ipcRenderer.invoke('dashboard:inventory-alerts');
  const container = document.getElementById('inventoryAlerts');
  const counter = document.getElementById('alertCount');

  if (!result || result.length === 0) {
    counter.textContent = '0 alerts';
    container.innerHTML = '<div class="empty-state">✅ All inventory levels are good</div>';
    return;
  }

  counter.textContent = `${result.length} alert${result.length > 1 ? 's' : ''}`;
  container.innerHTML = result.map(item => `
    <div style="padding: 10px 0; border-bottom: 1px solid #2D3748;
      display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:600; color:#F1F5F9; font-size:14px;">
          ${item.name}
        </div>
        <div style="font-size:12px; color:#64748B; margin-top:2px;">
          ${item.quantity} remaining · Alert at ${item.low_stock_alert}
        </div>
      </div>
      <span class="badge badge-red">Low Stock</span>
    </div>
  `).join('');
}

async function loadManagerNotes() {
  const result = await ipcRenderer.invoke('dashboard:manager-notes');
  const container = document.getElementById('managerNotes');

  if (!result || result.length === 0) {
    return;
  }

  container.innerHTML = result.map(note => `
    <div style="padding: 10px 0; border-bottom: 1px solid #2D3748;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:600; color:#F1F5F9; font-size:14px;">
          ${note.type === 'Meeting' ? '📅' : '📌'} ${note.title}
        </div>
        <span class="badge ${note.type === 'Meeting' ? 'badge-blue' : 'badge-gray'}">
          ${note.type}
        </span>
      </div>
      ${note.body ? `
        <div style="font-size:13px; color:#94A3B8; margin-top:4px;">
          ${note.body}
        </div>
      ` : ''}
      ${note.meeting_at ? `
        <div style="font-size:12px; color:#64748B; margin-top:4px;">
          🕐 ${new Date(note.meeting_at).toLocaleString()}
        </div>
      ` : ''}
    </div>
  `).join('');
}

function getStatusBadge(status) {
  const map = {
    'Scheduled': 'badge-blue',
    'Completed': 'badge-green',
    'No-Show':   'badge-red',
    'Cancelled': 'badge-gray',
  };
  return map[status] || 'badge-gray';
}

loadDashboard();