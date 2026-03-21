const { ipcRenderer } = require('electron');

const welcomeHeading = document.getElementById('welcomeHeading');
const scheduleList = document.getElementById('scheduleList');
const taskList = document.getElementById('taskList');
const roleScheduleList = document.getElementById('roleScheduleList');
const swapList = document.getElementById('swapList');
const announcementList = document.getElementById('announcementList');
const signOutBtn = document.getElementById('signOutBtn');

const employee = getCurrentEmployee();

function getCurrentEmployee() {
	const storedEmployee = localStorage.getItem('currentEmployee');
	return storedEmployee ? JSON.parse(storedEmployee) : null;
}

function showEmpty(container, message) {
	container.innerHTML = `<div class="empty">${message}</div>`;
}

function formatShiftLine(shift) {
	return `${shift.date} • ${shift.start_time} - ${shift.end_time}`;
}

function renderMySchedule(shifts) {
	if (!shifts.length) {
		showEmpty(scheduleList, 'No upcoming shifts found.');
		return;
	}

	scheduleList.innerHTML = shifts.map((shift) => `
		<div class="row">
			<div>${formatShiftLine(shift)}</div>
			<div>${shift.position || 'No position'} • ${shift.status || 'Scheduled'}</div>
		</div>
	`).join('');
}

function renderMyTasks(tasks) {
	if (!tasks.length) {
		showEmpty(taskList, 'No tasks assigned.');
		return;
	}

	taskList.innerHTML = tasks.map((task) => `
		<div class="row">
			<div>${task.title}</div>
			<div>${task.priority || 'Medium'} • ${task.status || 'Pending'}</div>
		</div>
	`).join('');
}

function renderRoleSchedule(shifts) {
	if (!shifts.length) {
		showEmpty(roleScheduleList, 'No role shifts for today.');
		return;
	}

	roleScheduleList.innerHTML = shifts.map((shift) => `
		<div class="row">
			<div>${formatShiftLine(shift)}</div>
			<div>${shift.first_name} ${shift.last_name}</div>
		</div>
	`).join('');
}

function renderSwapRequests(requests) {
	if (!requests.length) {
		showEmpty(swapList, 'No swap requests yet.');
		return;
	}

	swapList.innerHTML = requests.map((request) => {
		const canRespond = request.status === 'Pending' && request.target_employee_id === employee.id;
		const actions = canRespond
			? `
				<div>
					<button type="button" class="swap-action-btn" data-id="${request.id}" data-accept="true">Approve</button>
					<button type="button" class="swap-action-btn" data-id="${request.id}" data-accept="false">Reject</button>
				</div>
			`
			: '';

		return `
			<div class="row">
				<div>${request.requested_by_name} → ${request.target_employee_name}</div>
				<div>${request.from_date} ${request.from_start_time}-${request.from_end_time}</div>
				<div>Status: ${request.status}</div>
				${actions}
			</div>
		`;
	}).join('');

	swapList.querySelectorAll('.swap-action-btn').forEach((button) => {
		button.addEventListener('click', async () => {
			const requestId = parseInt(button.dataset.id, 10);
			const accept = button.dataset.accept === 'true';
			await respondToSwap(requestId, accept);
		});
	});
}

async function loadMySchedule() {
	const result = await ipcRenderer.invoke('employee:get-my-schedule', employee.id);
	if (!result.success) {
		showEmpty(scheduleList, 'Failed to load schedule.');
		return;
	}
	renderMySchedule(result.shifts || []);
}

async function loadMyTasks() {
	const result = await ipcRenderer.invoke('employee:get-my-tasks', employee.id);
	if (!result.success) {
		showEmpty(taskList, 'Failed to load tasks.');
		return;
	}
	renderMyTasks(result.tasks || []);
}

async function loadRoleSchedule() {
	if (!employee.positionTitle) {
		showEmpty(roleScheduleList, 'No position assigned.');
		return;
	}

	const today = new Date().toISOString().split('T')[0];
	const result = await ipcRenderer.invoke('shifts:get-by-position', {
		position: employee.positionTitle,
		date: today
	});

	if (!result.success) {
		showEmpty(roleScheduleList, 'Failed to load role schedule.');
		return;
	}

	renderRoleSchedule(result.shifts || []);
}

async function loadSwapRequests() {
	const result = await ipcRenderer.invoke('shifts:get-my-swap-requests', employee.id);
	if (!result.success) {
		showEmpty(swapList, 'Failed to load swap requests.');
		return;
	}

	renderSwapRequests(result.requests || []);
}

async function respondToSwap(requestId, accept) {
	const result = await ipcRenderer.invoke('shifts:respond-to-swap', {
		requestId,
		responderEmployeeId: employee.id,
		action: accept ? 'approved' : 'rejected'
	});

	if (!result.success) {
		showEmpty(swapList, result.message || 'Failed to respond to swap request.');
		return;
	}

	await loadSwapRequests();
	await loadMySchedule();
	await loadRoleSchedule();
}

function loadAnnouncements() {
	showEmpty(announcementList, 'No announcements right now.');
}

function init() {
	if (!employee || !employee.id) {
		window.location.href = 'employee-login.html';
		return;
	}

	welcomeHeading.textContent = `${employee.firstName || 'Employee'} Portal`;

	signOutBtn.addEventListener('click', () => {
		localStorage.removeItem('currentEmployee');
		window.location.href = 'employee-login.html';
	});

	loadMySchedule();
	loadMyTasks();
	loadRoleSchedule();
	loadSwapRequests();
	loadAnnouncements();
}

init();
