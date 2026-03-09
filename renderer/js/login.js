const { ipcRenderer } = require('electron');

// Grab elements from the HTML
const loginBtn = document.getElementById('loginBtn');
const setupLink = document.getElementById('setupLink');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('errorMsg');

// Show an error message on screen
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
}

// Hide the error message
function hideError() {
  errorMsg.style.display = 'none';
}

// This runs as soon as the page loads
async function init() {
  const managerExists = await ipcRenderer.invoke('auth:check-setup');
  
  // If no manager account exists yet, prompt them to set one up
  if (!managerExists) {
    showError('No manager account found. Please create one below.');
  }
}

// Handle Sign In button click
loginBtn.addEventListener('click', async () => {
  hideError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  // Basic validation
  if (!username || !password) {
    showError('Please enter both username and password.');
    return;
  }

  // Call main.js login handler
  const result = await ipcRenderer.invoke('auth:login', { username, password });

  if (!result.success) {
    showError(result.message);
    return;
  }

  // Login worked — log the user for now
  localStorage.setItem('currentUser', JSON.stringify(result.user));
window.location.href = 'dashboard.html';
});

// Handle "Create manager account" link click
setupLink.addEventListener('click', async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    showError('Enter a username and password to create your manager account.');
    return;
  }

  const result = await ipcRenderer.invoke('auth:create-manager', { 
    username, 
    password 
  });

  if (!result.success) {
    showError(result.message);
    return;
  }

  // Account created — hide the error and confirm
  hideError();
  console.log('Manager account created successfully!');
  showError('✅ Manager account created! You can now sign in.');
  errorMsg.style.background = '#064E3B';
  errorMsg.style.borderColor = '#065F46';
  errorMsg.style.color = '#6EE7B7';
});

// Allow pressing Enter to submit
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

init();