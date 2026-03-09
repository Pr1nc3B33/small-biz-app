const { ipcRenderer } = require('electron');

// Get the current logged in user
function getCurrentUser() {
  const user = localStorage.getItem('currentUser');
  if (!user) {
    // Not logged in — redirect to login
    window.location.href = 'index.html';
    return null;
  }
  return JSON.parse(user);
}

// Set the username in the sidebar
function initSidebar() {
  const user = getCurrentUser();
  if (!user) return;

  const usernameDisplay = document.getElementById('usernameDisplay');
  if (usernameDisplay) {
    usernameDisplay.textContent = user.username;
  }

  // Set today's date in sidebar
  const currentDate = document.getElementById('currentDate');
  if (currentDate) {
    currentDate.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.href = 'index.html';
    });
  }
}

// Run on every page
initSidebar();