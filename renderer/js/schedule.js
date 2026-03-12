async function init() {
  initSidebar();

  currentWeekStart = getMonday(new Date());
  renderWeek();

  const employees = await ipcRenderer.invoke('employees:get-all');
  const select = document.getElementById('employeeSelect');
  employees.forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = emp.first_name + ' ' + emp.last_name;
    select.appendChild(option);
  });

  document.getElementById('prevWeekBtn').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderWeek();
  });

  document.getElementById('nextWeekBtn').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderWeek();
  });

  document.getElementById('todayBtn').addEventListener('click', () => {
    currentWeekStart = getMonday(new Date());
    renderWeek();
  });

  document.getElementById('addShiftBtn').addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('shiftDate').value = toDateString(currentWeekStart);
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveShiftBtn').addEventListener('click', saveShift);
}

let currentWeekStart;

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateString(date) {
  return date.toISOString().split('T')[0];
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return displayHour + ':' + m + ' ' + ampm;
}

async function renderWeek() {
  const startDate = toDateString(currentWeekStart);

  const endDate = new Date(currentWeekStart);
  endDate.setDate(endDate.getDate() + 6);
  document.getElementById('weekLabel').textContent =
    currentWeekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) +
    ' – ' +
    endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const result = await ipcRenderer.invoke('schedule:get-week', { startDate });
  const shifts = result.shifts || [];

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = toDateString(new Date());

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + i);
    const dateStr = toDateString(dayDate);

    const dayShifts = shifts.filter(s => s.date === dateStr);
    const isToday = dateStr === today;

    const col = document.createElement('div');
    col.className = 'day-column' + (isToday ? ' today' : '');

    col.innerHTML = `
      <div class="day-header">
        <div class="day-name">${dayNames[i]}</div>
        <div class="day-date">${dayDate.getDate()}</div>
      </div>
      <div class="day-shifts" id="shifts-${dateStr}"></div>
    `;

    grid.appendChild(col);

    const shiftsContainer = document.getElementById('shifts-' + dateStr);

    if (dayShifts.length === 0) {
      shiftsContainer.innerHTML = '<div class="empty-day">No shifts</div>';
    } else {
      dayShifts.forEach(shift => {
        const block = document.createElement('div');
        block.className = 'shift-block';
        block.innerHTML = `
          <div class="shift-name">${shift.first_name} ${shift.last_name}</div>
          <div class="shift-time">${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}</div>
          ${shift.position ? '<div class="shift-position">' + shift.position + '</div>' : ''}
          <div class="shift-delete" data-id="${shift.id}">✕</div>
        `;

        block.querySelector('.shift-delete').addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = parseInt(e.currentTarget.dataset.id);
          await ipcRenderer.invoke('schedule:delete-shift', { id });
          renderWeek();
        });

        shiftsContainer.appendChild(block);
      });
    }
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('modalError').classList.remove('active');
  document.getElementById('modalError').textContent = '';
  document.getElementById('employeeSelect').value = '';
  document.getElementById('shiftDate').value = '';
  document.getElementById('startTime').value = '';
  document.getElementById('endTime').value = '';
  document.getElementById('shiftPosition').value = '';
  document.getElementById('shiftNotes').value = '';
}

async function saveShift() {
  const errorEl = document.getElementById('modalError');
  errorEl.classList.remove('active');
  errorEl.textContent = '';

  const employee_id = document.getElementById('employeeSelect').value;
  const date = document.getElementById('shiftDate').value;
  const start_time = document.getElementById('startTime').value;
  const end_time = document.getElementById('endTime').value;
  const position = document.getElementById('shiftPosition').value.trim();
  const notes = document.getElementById('shiftNotes').value.trim();

  if (!employee_id || !date || !start_time || !end_time) {
    errorEl.textContent = 'Please fill in employee, date, start time and end time.';
    errorEl.classList.add('active');
    return;
  }

  if (start_time >= end_time) {
    errorEl.textContent = 'End time must be after start time.';
    errorEl.classList.add('active');
    return;
  }

  const result = await ipcRenderer.invoke('schedule:add-shift', {
    employee_id: parseInt(employee_id),
    date,
    start_time,
    end_time,
    position,
    notes
  });

  if (!result.success) {
    errorEl.textContent = result.error || 'Failed to save shift.';
    errorEl.classList.add('active');
    return;
  }

  closeModal();
  renderWeek();
}

init();