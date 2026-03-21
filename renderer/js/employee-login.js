const { ipcRenderer } = require('electron');

const emailInput = document.getElementById('employeeEmail');
const passwordInput = document.getElementById('employeePassword');
const loginBtn = document.getElementById('employeeLoginBtn');
const errorMsg = document.getElementById('errorMsg');

function showError(message) {
	errorMsg.textContent = message;
	errorMsg.style.display = 'block';
}

function clearError() {
	errorMsg.textContent = '';
	errorMsg.style.display = 'none';
}

async function handleEmployeeLogin() {
	clearError();

	const email = emailInput.value.trim();
	const password = passwordInput.value.trim();

	if (!email || !password) {
		showError('Please enter your email and password.');
		return;
	}

	const result = await ipcRenderer.invoke('employee:login', {
		email,
		password
	});

	if (!result.success) {
		showError(result.message || 'Unable to sign in.');
		return;
	}

	localStorage.setItem('currentEmployee', JSON.stringify(result.employee));
	window.location.href = 'employee-portal.html';
}

loginBtn.addEventListener('click', handleEmployeeLogin);

passwordInput.addEventListener('keydown', (event) => {
	if (event.key === 'Enter') {
		handleEmployeeLogin();
	}
});
