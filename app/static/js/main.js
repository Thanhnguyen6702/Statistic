/* ============ MAIN APPLICATION ============ */

let currentUser = null;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    loadUser();
    loadExpenseData();
    loadLeaderboard();
    initWheel();
    setupBestOfSelector();
});

// Load current user
async function loadUser() {
    try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (!res.ok) {
            window.location.href = '/login';
            return;
        }
        currentUser = await res.json();
        document.getElementById('userName').textContent = currentUser.username;
        const avatar = document.getElementById('userAvatar');
        if (currentUser.avatar_url) {
            avatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="">`;
        } else {
            avatar.textContent = currentUser.username[0].toUpperCase();
        }
    } catch (e) {
        window.location.href = '/login';
    }
}
