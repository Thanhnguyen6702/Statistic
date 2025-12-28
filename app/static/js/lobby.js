/* ============ MULTIPLAYER LOBBY (Socket.IO) ============ */

let lobbySocket = null;
let onlinePlayers = [];
let pendingInviteId = null;
let selectedBestOf = 3;

function initLobbySocket() {
    if (lobbySocket) {
        lobbySocket.disconnect();
        lobbySocket = null;
    }

    console.log('Initializing lobby socket...');

    lobbySocket = io({
        withCredentials: true,
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    lobbySocket.on('connect', () => {
        console.log('Socket connected! SID:', lobbySocket.id);
        lobbySocket.emit('join_lobby', { user_id: currentUser ? currentUser.id : null });
    });

    lobbySocket.on('connected', (data) => {
        console.log('Server confirmed connection:', data);
    });

    lobbySocket.on('joined_lobby', (data) => {
        console.log('Joined lobby successfully:', data);
    });

    lobbySocket.on('lobby_users', (data) => {
        console.log('Received lobby users:', data);
        onlinePlayers = data.users || [];
        renderOnlinePlayers();
    });

    lobbySocket.on('error', (data) => {
        console.error('Socket error:', data);
        showNotification(data.message, 'error');
    });

    lobbySocket.on('game_invite', (data) => {
        if (currentUser && data.to_user_id === currentUser.id) {
            showInviteToast(data);
        }
    });

    lobbySocket.on('invite_sent', (data) => {
        showNotification('Đã gửi lời mời!', 'success');
    });

    lobbySocket.on('invite_declined', (data) => {
        showNotification(data.declined_by.username + ' đã từ chối lời mời', 'error');
    });

    lobbySocket.on('game_started', (data) => {
        window.location.href = '/game/room/' + data.room_code;
    });

    lobbySocket.on('room_created', (data) => {
        console.log('Room created:', data);
        closeModal('rpsModal');
        window.location.href = '/game/room/' + data.room_code;
    });

    lobbySocket.on('room_joined', (data) => {
        console.log('Room joined:', data);
        closeModal('rpsModal');
        window.location.href = '/game/room/' + data.room_code;
    });

    lobbySocket.on('disconnect', (reason) => {
        console.log('Disconnected from lobby:', reason);
        onlinePlayers = [];
        renderOnlinePlayers();
    });

    lobbySocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        document.getElementById('onlinePlayersGrid').innerHTML = `
            <div class="no-players">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Lỗi kết nối. <a href="javascript:initLobbySocket()">Thử lại</a></p>
            </div>
        `;
    });
}

function renderOnlinePlayers() {
    const grid = document.getElementById('onlinePlayersGrid');
    const count = document.getElementById('onlineCount');

    if (!grid || !count) return;

    count.textContent = onlinePlayers.length + ' online';

    if (!lobbySocket || !lobbySocket.connected) {
        grid.innerHTML = `
            <div class="no-players">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Đang kết nối...</p>
            </div>
        `;
        return;
    }

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

function invitePlayer(playerId, playerName) {
    if (!lobbySocket || !lobbySocket.connected) {
        showNotification('Chưa kết nối, đang thử lại...', 'error');
        initLobbySocket();
        return;
    }

    lobbySocket.emit('invite_player', {
        to_user_id: playerId,
        best_of: selectedBestOf
    });
}

function showInviteToast(data) {
    const container = document.getElementById('inviteToastContainer');
    pendingInviteId = data.invite_id;

    const avatarContent = data.from_user.avatar_url
        ? `<img src="${data.from_user.avatar_url}" alt="">`
        : data.from_user.username[0].toUpperCase();

    container.innerHTML = `
        <div class="invite-toast" id="inviteToast-${data.invite_id}">
            <div class="invite-toast-header">
                <div class="invite-toast-avatar">${avatarContent}</div>
                <div class="invite-toast-info">
                    <h4>${data.from_user.username}</h4>
                    <p>Mời bạn chơi Oẳn Tù Tì (Bộ ${data.best_of})</p>
                </div>
            </div>
            <div class="invite-toast-actions">
                <button class="btn-accept" onclick="acceptInvite('${data.invite_id}')">
                    <i class="fas fa-check"></i> Chấp Nhận
                </button>
                <button class="btn-decline" onclick="declineInvite('${data.invite_id}')">
                    <i class="fas fa-times"></i> Từ Chối
                </button>
            </div>
        </div>
    `;

    setTimeout(() => {
        if (pendingInviteId === data.invite_id) {
            declineInvite(data.invite_id);
        }
    }, 30000);
}

function acceptInvite(inviteId) {
    if (!lobbySocket) return;
    lobbySocket.emit('accept_invite', { invite_id: inviteId });
    removeInviteToast(inviteId);
}

function declineInvite(inviteId) {
    if (!lobbySocket) return;
    lobbySocket.emit('decline_invite', { invite_id: inviteId });
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

function createGameRoom() {
    if (!lobbySocket || !lobbySocket.connected) {
        showNotification('Chưa kết nối, vui lòng chờ...', 'error');
        return;
    }

    if (!currentUser) {
        showNotification('Chưa đăng nhập', 'error');
        return;
    }

    lobbySocket.emit('create_room', {
        best_of: selectedBestOf,
        user_id: currentUser.id
    });
    showNotification('Đang tạo phòng...', 'success');
}

function joinGameRoom() {
    const code = document.getElementById('joinRoomCode').value.trim().toUpperCase();
    if (!code || code.length !== 6) {
        showNotification('Nhập mã phòng 6 ký tự', 'error');
        return;
    }

    if (!lobbySocket || !lobbySocket.connected) {
        showNotification('Chưa kết nối, vui lòng chờ...', 'error');
        return;
    }

    if (!currentUser) {
        showNotification('Chưa đăng nhập', 'error');
        return;
    }

    lobbySocket.emit('join_room_by_code', {
        room_code: code,
        user_id: currentUser.id
    });
    showNotification('Đang tham gia phòng...', 'success');
}

async function loadLeaderboard() {
    try {
        const res = await fetch('/api/game/stats/leaderboard', { credentials: 'include' });
        const data = await res.json();

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
        console.error('Failed to load leaderboard:', e);
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
