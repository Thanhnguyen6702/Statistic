/* ============ MULTIPLAYER LOBBY (Polling-based, no WebSocket) ============ */

let onlinePlayers = [];
let pendingInviteId = null;
let selectedBestOf = 3;
let pollingInterval = null;
let isInLobby = false;

// Start polling when entering games tab
function initLobbySocket() {
    if (isInLobby) return;
    isInLobby = true;

    console.log('Starting lobby polling...');

    // Initial fetch
    fetchOnlinePlayers();
    sendHeartbeat();

    // Poll every 3 seconds
    pollingInterval = setInterval(() => {
        if (isInLobby) {
            sendHeartbeat();
            fetchOnlinePlayers();
        }
    }, 3000);
}

// Stop polling when leaving games tab
function stopLobbyPolling() {
    isInLobby = false;
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }

    // Notify server we're leaving
    fetch('/api/lobby/leave', {
        method: 'POST',
        credentials: 'include'
    }).catch(() => {});
}

// Send heartbeat to stay online
async function sendHeartbeat() {
    try {
        const res = await fetch('/api/lobby/heartbeat', {
            method: 'POST',
            credentials: 'include'
        });

        if (res.ok) {
            const data = await res.json();

            // Check for redirect (invite was accepted by other player)
            if (data.redirect) {
                window.location.href = data.redirect;
                return;
            }

            // Check for pending invites
            if (data.pending_invites && data.pending_invites.length > 0) {
                const invite = data.pending_invites[0];
                if (invite.invite_id !== pendingInviteId) {
                    showInviteToast(invite);
                }
            }
        }
    } catch (e) {
        console.error('Heartbeat failed:', e);
    }
}

// Fetch online players list
async function fetchOnlinePlayers() {
    try {
        const res = await fetch('/api/lobby/online', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            onlinePlayers = data.users || [];
            renderOnlinePlayers();
        }
    } catch (e) {
        console.error('Failed to fetch online players:', e);
    }
}

function renderOnlinePlayers() {
    const grid = document.getElementById('onlinePlayersGrid');
    const count = document.getElementById('onlineCount');

    if (!grid || !count) return;

    count.textContent = onlinePlayers.length + ' online';

    if (onlinePlayers.length === 0) {
        grid.innerHTML = `
            <div class="no-players">
                <i class="fas fa-user-clock"></i>
                <p>Chưa có ai online. Hãy mời bạn bè!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = onlinePlayers.map(player => {
        const isMe = currentUser && player.id === currentUser.id;
        const avatarContent = player.avatar_url
            ? `<img src="${player.avatar_url}" alt="">`
            : (player.username ? player.username[0].toUpperCase() : '?');

        return `
            <div class="online-player ${isMe ? 'is-me' : ''}">
                <div class="online-avatar">${avatarContent}</div>
                <span class="online-name">${player.username || 'Unknown'}${isMe ? ' (Bạn)' : ''}</span>
                ${!isMe ? `<button class="btn-invite" onclick="invitePlayer(${player.id}, '${player.username}')">
                    <i class="fas fa-gamepad"></i> Mời
                </button>` : ''}
            </div>
        `;
    }).join('');
}

async function invitePlayer(playerId, playerName) {
    try {
        const res = await fetch('/api/lobby/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                to_user_id: playerId,
                best_of: selectedBestOf
            })
        });

        const data = await res.json();

        if (res.ok) {
            showNotification('Đã gửi lời mời!', 'success');
        } else {
            showNotification(data.error || 'Lỗi gửi lời mời', 'error');
        }
    } catch (e) {
        showNotification('Lỗi kết nối', 'error');
    }
}

function showInviteToast(invite) {
    const container = document.getElementById('inviteToastContainer');
    pendingInviteId = invite.invite_id;

    const avatarContent = invite.from_user.avatar_url
        ? `<img src="${invite.from_user.avatar_url}" alt="">`
        : invite.from_user.username[0].toUpperCase();

    container.innerHTML = `
        <div class="invite-toast" id="inviteToast-${invite.invite_id}">
            <div class="invite-toast-header">
                <div class="invite-toast-avatar">${avatarContent}</div>
                <div class="invite-toast-info">
                    <h4>${invite.from_user.username}</h4>
                    <p>Mời bạn chơi Oẳn Tù Tì (Bộ ${invite.best_of})</p>
                </div>
            </div>
            <div class="invite-toast-actions">
                <button class="btn-accept" onclick="acceptInvite('${invite.invite_id}')">
                    <i class="fas fa-check"></i> Chấp Nhận
                </button>
                <button class="btn-decline" onclick="declineInvite('${invite.invite_id}')">
                    <i class="fas fa-times"></i> Từ Chối
                </button>
            </div>
        </div>
    `;

    // Auto decline after 30 seconds
    setTimeout(() => {
        if (pendingInviteId === invite.invite_id) {
            declineInvite(invite.invite_id);
        }
    }, 30000);
}

async function acceptInvite(inviteId) {
    try {
        const res = await fetch(`/api/lobby/invite/${inviteId}/accept`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await res.json();

        if (res.ok && data.redirect) {
            window.location.href = data.redirect;
        } else {
            showNotification(data.error || 'Lỗi', 'error');
        }
    } catch (e) {
        showNotification('Lỗi kết nối', 'error');
    }

    removeInviteToast(inviteId);
}

async function declineInvite(inviteId) {
    try {
        await fetch(`/api/lobby/invite/${inviteId}/decline`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (e) {}

    removeInviteToast(inviteId);
}

function removeInviteToast(inviteId) {
    const toast = document.getElementById('inviteToast-' + inviteId);
    if (toast) {
        toast.style.animation = 'slideUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }
    if (pendingInviteId === inviteId) {
        pendingInviteId = null;
    }
}

function openRPSModal() {
    document.getElementById('rpsModal').classList.add('show');
}

async function createGameRoom() {
    if (!currentUser) {
        showNotification('Chưa đăng nhập', 'error');
        return;
    }

    try {
        const res = await fetch('/api/lobby/room/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ best_of: selectedBestOf })
        });

        const data = await res.json();

        if (res.ok && data.redirect) {
            closeModal('rpsModal');
            window.location.href = data.redirect;
        } else {
            showNotification(data.error || 'Lỗi tạo phòng', 'error');
        }
    } catch (e) {
        showNotification('Lỗi kết nối', 'error');
    }
}

async function joinGameRoom() {
    const code = document.getElementById('joinRoomCode').value.trim().toUpperCase();
    if (!code || code.length !== 6) {
        showNotification('Nhập mã phòng 6 ký tự', 'error');
        return;
    }

    if (!currentUser) {
        showNotification('Chưa đăng nhập', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/lobby/room/${code}/join`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await res.json();

        if (res.ok && data.redirect) {
            closeModal('rpsModal');
            window.location.href = data.redirect;
        } else {
            showNotification(data.error || 'Lỗi vào phòng', 'error');
        }
    } catch (e) {
        showNotification('Lỗi kết nối', 'error');
    }
}

async function loadLeaderboard() {
    try {
        const res = await fetch('/api/game/stats/leaderboard', { credentials: 'include' });
        const data = res.ok ? await res.json() : [];

        document.getElementById('leaderboard').innerHTML = data.length ? data.map((u, i) => `
            <tr>
                <td class="${i < 3 ? 'rank-' + (i+1) : ''}">${i + 1}</td>
                <td>${u.username}</td>
                <td>${u.total_wins}</td>
                <td>${u.total_losses}</td>
                <td>${u.win_rate}%</td>
            </tr>
        `).join('') : '<tr><td colspan="5" style="text-align:center;color:#718096;">Chưa có dữ liệu</td></tr>';
    } catch (e) {
        document.getElementById('leaderboard').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#718096;">Chưa có dữ liệu</td></tr>';
    }
}

// Setup best-of selector
function setupBestOfSelector() {
    document.querySelectorAll('.best-of-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.best-of-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedBestOf = parseInt(btn.dataset.value);
        });
    });
}
