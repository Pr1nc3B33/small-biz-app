const STATUSES = ['Pending', 'In Progress', 'Done'];

async function init() {
  initSidebar();

  const employees = await ipcRenderer.invoke('employees:get-all');
  const select = document.getElementById('taskEmployee');
  employees.forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = emp.first_name + ' ' + emp.last_name;
    select.appendChild(option);
  });

  document.getElementById('addTaskBtn').addEventListener('click', openModal);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveTaskBtn').addEventListener('click', saveTask);

  loadTasks();
}

async function loadTasks() {
  const tasks = await ipcRenderer.invoke('tasks:get-all');

  // Clear all columns
  STATUSES.forEach(status => {
    document.getElementById('cards-' + status).innerHTML = '';
    document.getElementById('count-' + status).textContent = 0;
  });

  // Count per status
  const counts = { 'Pending': 0, 'In Progress': 0, 'Done': 0 };

  tasks.forEach(task => {
    const status = task.status || 'Pending';
    if (!counts.hasOwnProperty(status)) return;
    counts[status]++;
    const container = document.getElementById('cards-' + status);
    if (container) container.appendChild(buildCard(task));
  });

  // Update counts
  STATUSES.forEach(status => {
    document.getElementById('count-' + status).textContent = counts[status];
  });

  // Update summary
  const total = tasks.length;
  const done = counts['Done'];
  document.getElementById('taskSummary').textContent =
    total + ' tasks — ' + done + ' completed';

  // Show empty state
  STATUSES.forEach(status => {
    const container = document.getElementById('cards-' + status);
    if (counts[status] === 0) {
      container.innerHTML = '<div class="empty-column">No tasks</div>';
    }
  });
}

function buildCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';

  const assignee = task.first_name
    ? task.first_name + ' ' + task.last_name
    : 'Unassigned';

  const dueDate = task.due_date
    ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'No due date';

  const description = task.description
    ? '<div class="task-description">' + task.description + '</div>'
    : '';

  // Build status change buttons
  const otherStatuses = STATUSES.filter(s => s !== task.status);
  const statusButtons = otherStatuses.map(s => {
    const label = s === 'Pending' ? '← To Do' : s === 'In Progress' ? '→ In Progress' : '✓ Done';
    return '<button class="task-btn" data-id="' + task.id + '" data-status="' + s + '">' + label + '</button>';
  }).join('');

  card.innerHTML = `
    <div class="task-card-header">
      <div class="task-title">${task.title}</div>
      <span class="priority-badge priority-${task.priority}">${task.priority}</span>
    </div>
    ${description}
    <div class="task-meta">
      <div class="task-meta-row">👤 ${assignee}</div>
      <div class="task-meta-row">📅 ${dueDate}</div>
    </div>
    <div class="task-actions">
      ${statusButtons}
      <button class="task-btn task-btn-delete" data-id="${task.id}">Delete</button>
    </div>
  `;

  // Status change listeners
  card.querySelectorAll('.task-btn[data-status]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt(e.currentTarget.dataset.id);
      const status = e.currentTarget.dataset.status;
      await ipcRenderer.invoke('tasks:update-status', { id, status });
      loadTasks();
    });
  });

  // Delete listener
  card.querySelector('.task-btn-delete').addEventListener('click', async (e) => {
    const id = parseInt(e.currentTarget.dataset.id);
    await ipcRenderer.invoke('tasks:delete', id);
    loadTasks();
  });

  return card;
}

function openModal() {
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('modalError').classList.remove('active');
  document.getElementById('modalError').textContent = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskEmployee').value = '';
  document.getElementById('taskDueDate').value = '';
  document.getElementById('taskPriority').value = 'Medium';
}

async function saveTask() {
  const errorEl = document.getElementById('modalError');
  errorEl.classList.remove('active');
  errorEl.textContent = '';

  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDescription').value.trim();
  const assigned_to = document.getElementById('taskEmployee').value;
  const due_date = document.getElementById('taskDueDate').value;
  const priority = document.getElementById('taskPriority').value;

  if (!title) {
    errorEl.textContent = 'Please enter a task title.';
    errorEl.classList.add('active');
    return;
  }

  const result = await ipcRenderer.invoke('tasks:add', {
    title,
    description,
    assigned_to: assigned_to ? parseInt(assigned_to) : null,
    due_date: due_date || null,
    priority
  });

  if (!result.success) {
    errorEl.textContent = result.message || 'Failed to save task.';
    errorEl.classList.add('active');
    return;
  }

  closeModal();
  loadTasks();
}

init();