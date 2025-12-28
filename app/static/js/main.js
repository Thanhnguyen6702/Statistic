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

// Load current user (optional - guest mode supported)
async function loadUser() {
    try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (res.ok) {
            currentUser = await res.json();
            document.getElementById('userName').textContent = currentUser.username;
            const avatar = document.getElementById('userAvatar');
            if (currentUser.avatar_url) {
                avatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="">`;
            } else {
                avatar.textContent = currentUser.username[0].toUpperCase();
            }
        } else {
            // Guest mode
            document.getElementById('userName').textContent = 'Khách';
            document.getElementById('userAvatar').textContent = 'K';
        }
    } catch (e) {
        // Guest mode on error
        document.getElementById('userName').textContent = 'Khách';
        document.getElementById('userAvatar').textContent = 'K';
    }
}
