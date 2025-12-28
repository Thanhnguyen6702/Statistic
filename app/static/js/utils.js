/* ============ UTILITY FUNCTIONS ============ */

// Format money to VND
function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
}

// Show notification toast
function showNotification(msg, type) {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => n.remove(), 300);
    }, 3000);
}

// Close modal by ID
function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

// Logout
async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
}

// Switch between tabs
function switchTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (tab === 'expense') {
        document.querySelectorAll('.nav-tab')[0].classList.add('active');
        document.getElementById('expenseTab').classList.add('active');
        // Leave lobby when switching away from games
        if (typeof lobbySocket !== 'undefined' && lobbySocket && lobbySocket.connected) {
            lobbySocket.emit('leave_lobby');
        }
    } else {
        document.querySelectorAll('.nav-tab')[1].classList.add('active');
        document.getElementById('gamesTab').classList.add('active');
        // Join lobby when entering games tab
        if (typeof initLobbySocket === 'function') {
            initLobbySocket();
        }
    }
}
