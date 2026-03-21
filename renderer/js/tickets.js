

let allTickets = [];
let currentTicketId = null;
let allEmployees = [];

const createTicketBtn = document.getElementById('createTicketBtn');
const createTicketModal = document.getElementById('createTicketModal');
const closeCreateModal = document.getElementById('closeCreateModal');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const submitTicketBtn = document.getElementById('submitTicketBtn');
const createTicketError = document.getElementById('createTicketError');
const ticketDetailModal = document.getElementById('ticketDetailModal');
const closeDetailModal = document.getElementById('closeDetailModal');
const closeDetailBtn = document.getElementById('closeDetailBtn');
const detailTicketTitle = document.getElementById('detailTicketTitle');
const detailTicketMeta = document.getElementById('detailTicketMeta');
const detailCategory = document.getElementById('detailCategory');
const detailPriority = document.getElementById('detailPriority');
const detailStatus = document.getElementById('detailStatus');
const detailAssignee = document.getElementById('detailAssignee');
const notesHistory = document.getElementById('notesHistory');
const detailNoteInput = document.getElementById('detailNoteInput');
const detailNoteError = document.getElementById('detailNoteError');
const addNoteBtn = document.getElementById('addNoteBtn');
const statusButtons = document.querySelectorAll('.status-action-btn');

function getCurrentUser() {
  const user = localStorage.getItem('currentUser');
  return user ? JSON.parse(user) : null;
}

function normalizeStatus(status) {
  return (status || '').toLowerCase().replace(/\s+/g, '-');
}

function formatDateTime(value) {
  if (!value) return 'Unknown time';

  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString();
}

function showCreateTicketError(message) {
  createTicketError.textContent = message;
  createTicketError.style.display = 'block';
}

function clearCreateTicketError() {
  createTicketError.textContent = '';
  createTicketError.style.display = 'none';
}

function showDetailError(message) {
  detailNoteError.textContent = message;
  detailNoteError.style.display = 'block';
}

function clearDetailError() {
  detailNoteError.textContent = '';
  detailNoteError.style.display = 'none';
}

function openCreateTicketModal() {
  clearCreateTicketError();
  createTicketModal.style.display = 'flex';
}

function closeCreateTicketModal() {
  createTicketModal.style.display = 'none';
  clearCreateTicketError();
  document.getElementById('ticketTitle').value = '';
  document.getElementById('ticketCategory').value = 'Customer Complaint';
  document.getElementById('ticketPriority').value = 'Low';
  document.getElementById('ticketDescription').value = '';
}

async function loadTickets() {
  const result = await ipcRenderer.invoke('tickets:get-all');
  if (!result.success) return;
  allTickets = result.tickets; // ← not just result
  renderTickets(allTickets);
  document.getElementById('ticketCount').textContent = `${allTickets.length} tickets`;
}

async function loadEmployees() {
  const employees = await ipcRenderer.invoke('employees:get-all');
  allEmployees = Array.isArray(employees) ? employees : [];
}

function populateAssigneeDropdown(selectedEmployeeId) {
  detailAssignee.innerHTML = '<option value="">Unassigned</option>';

  allEmployees.forEach(employee => {
    const option = document.createElement('option');
    option.value = String(employee.id);
    option.textContent = `${employee.first_name} ${employee.last_name}`;
    detailAssignee.appendChild(option);
  });

  detailAssignee.value = selectedEmployeeId ? String(selectedEmployeeId) : '';
}

function renderNotesHistory(notes) {
  if (!notes.length) {
    notesHistory.innerHTML = '<p>No notes yet.</p>';
    return;
  }

  notesHistory.innerHTML = notes.map(note => `
    <div class="note-item">
      <div class="note-meta">${note.author_name || 'Unknown'} • ${formatDateTime(note.created_at)}</div>
      <div class="note-text">${note.note}</div>
    </div>
  `).join('');
}

function syncStatusButtons(status) {
  statusButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.status === status);
  });
}

function closeTicketDetailModal() {
  ticketDetailModal.style.display = 'none';
  clearDetailError();
  detailNoteInput.value = '';
}

async function openTicketDetail(ticketId) {
  currentTicketId = ticketId;

  const result = await ipcRenderer.invoke('tickets:get-by-id', ticketId);
  if (!result.success) {
    showDetailError(result.message || 'Failed to load ticket details.');
    return;
  }

  if (!allEmployees.length) {
    await loadEmployees();
  }

  const { ticket, notes = [] } = result;

  detailTicketTitle.textContent = ticket.title || 'Ticket Details';
  detailTicketMeta.textContent = `Created by ${ticket.created_by_name || 'Unknown'} • ${formatDateTime(ticket.created_at)}`;
  detailCategory.textContent = ticket.category || '-';
  detailPriority.textContent = ticket.priority || '-';
  detailStatus.textContent = ticket.status || '-';

  populateAssigneeDropdown(ticket.assigned_to);
  renderNotesHistory(notes);
  syncStatusButtons(ticket.status);
  clearDetailError();
  detailNoteInput.value = '';
  ticketDetailModal.style.display = 'flex';
}

async function updateTicketStatus(status) {
  if (!currentTicketId) return;

  const result = await ipcRenderer.invoke('tickets:update-status', {
    id: currentTicketId,
    status
  });

  if (!result.success) {
    showDetailError(result.message || 'Failed to update ticket status.');
    return;
  }

  await loadTickets();
  await openTicketDetail(currentTicketId);
}

async function assignTicket() {
  if (!currentTicketId) return;

  const employeeId = detailAssignee.value ? parseInt(detailAssignee.value, 10) : null;
  const result = await ipcRenderer.invoke('tickets:assign', {
    id: currentTicketId,
    employeeId
  });

  if (!result.success) {
    showDetailError(result.message || 'Failed to assign ticket.');
    return;
  }

  await loadTickets();
  await openTicketDetail(currentTicketId);
}

async function addNote() {
  if (!currentTicketId) return;

  const note = detailNoteInput.value.trim();
  const currentUser = getCurrentUser();

  if (!note) {
    showDetailError('Please enter a note.');
    return;
  }

  const result = await ipcRenderer.invoke('tickets:add-note', {
    ticketId: currentTicketId,
    authorId: currentUser ? currentUser.employeeId : null,
    note
  });

  if (!result.success) {
    showDetailError(result.message || 'Failed to add note.');
    return;
  }

  detailNoteInput.value = '';
  await openTicketDetail(currentTicketId);
}


function renderTickets(tickets) {
  const container = document.getElementById('ticketList');
    container.innerHTML = '';
    if (tickets.length === 0) {
        container.innerHTML = '<p>No tickets found.</p>';
        return;
    }
    tickets.forEach(ticket => {
        const row = document.createElement('div');
        row.classList.add('ticket-row');
        row.dataset.id = ticket.id;
        row.innerHTML = `
            <div class="ticket-title">${ticket.title}</div>
            <div class="ticket-category">${ticket.category}</div>
            <div class="ticket-priority priority-${ticket.priority.toLowerCase()}">${ticket.priority}</div>
            <div class="ticket-status">${ticket.status}</div>
            <div class="ticket-created">${new Date(ticket.created_at).toLocaleString()}</div>
        `;
        row.addEventListener('click', () => openTicketDetail(ticket.id));
        container.appendChild(row);
    }); 
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    const filteredTickets = filter === 'all'
      ? allTickets
      : allTickets.filter(ticket => normalizeStatus(ticket.status) === filter);
    renderTickets(filteredTickets);
  });
});

async function submitCreateTicket() {
  clearCreateTicketError();

  const title = document.getElementById('ticketTitle').value.trim();
  const category = document.getElementById('ticketCategory').value;
  const priority = document.getElementById('ticketPriority').value;
  const description = document.getElementById('ticketDescription').value.trim();
  const currentUser = getCurrentUser();

  if (!title) {
    showCreateTicketError('Title is required.');
    return;
  }

  const result = await ipcRenderer.invoke('tickets:create', {
    title,
    category,
    priority,
    description,
    created_by: currentUser ? currentUser.employeeId : null
  });

  if (!result.success) {
    showCreateTicketError(result.message || 'Failed to create ticket.');
    return;
  }

  closeCreateTicketModal();
  await loadTickets();
}

async function init() {
  initSidebar();
  await loadEmployees();
  await loadTickets();

  createTicketBtn.addEventListener('click', openCreateTicketModal);
  closeCreateModal.addEventListener('click', closeCreateTicketModal);
  cancelCreateBtn.addEventListener('click', closeCreateTicketModal);
  submitTicketBtn.addEventListener('click', submitCreateTicket);
  closeDetailModal.addEventListener('click', closeTicketDetailModal);
  closeDetailBtn.addEventListener('click', closeTicketDetailModal);
  detailAssignee.addEventListener('change', assignTicket);
  addNoteBtn.addEventListener('click', addNote);

  statusButtons.forEach(button => {
    button.addEventListener('click', () => updateTicketStatus(button.dataset.status));
  });
}

init();
