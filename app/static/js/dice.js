/* ============ DICE GAME (2-6 players) ============ */

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

let diceGameState = {
    players: [],
    selectedPlayers: [],
    totalRounds: 1,
    currentRound: 1,
    currentPlayerIndex: 0,
    scores: {},
    roundScores: {},
    isRolling: false
};

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const DEFAULT_DICE_PLAYERS = ['Huy', 'Vàng', 'Thành', 'Mạnh'];

function openDiceModal() {
    // Use wheelPeople if available, otherwise use default
    const players = (wheelPeople && wheelPeople.length > 0) ? wheelPeople : DEFAULT_DICE_PLAYERS;
    diceGameState = {
        players: [...players],
        selectedPlayers: [],
        totalRounds: 1,
        currentRound: 1,
        currentPlayerIndex: 0,
        scores: {},
        roundScores: {},
        isRolling: false
    };

    document.getElementById('diceSetup').style.display = 'block';
    document.getElementById('diceGame').style.display = 'none';
    document.getElementById('diceResult').style.display = 'none';
    document.getElementById('diceCloseBtn').style.display = 'block';

    renderDicePlayerSelect();
    setupDiceRoundButtons();
    updateSelectedCount();

    document.getElementById('diceModal').classList.add('show');
}

function renderDicePlayerSelect() {
    const container = document.getElementById('dicePlayerSelect');
    if (diceGameState.players.length === 0) {
        container.innerHTML = '<span style="color: #718096;">Chưa có dữ liệu người chơi</span>';
        return;
    }
    container.innerHTML = diceGameState.players.map(name => `
        <span class="dice-player-btn" onclick="toggleDicePlayer('${name}')" data-name="${name}">
            ${name}
        </span>
    `).join('');
}

function updateSelectedCount() {
    const countEl = document.getElementById('diceSelectedCount');
    if (countEl) {
        const count = diceGameState.selectedPlayers.length;
        countEl.textContent = `(${count}/${MAX_PLAYERS})`;
        countEl.style.color = count >= MIN_PLAYERS ? '#48bb78' : '#718096';
    }
}

function toggleDicePlayer(name) {
    const idx = diceGameState.selectedPlayers.indexOf(name);
    if (idx > -1) {
        diceGameState.selectedPlayers.splice(idx, 1);
    } else if (diceGameState.selectedPlayers.length < MAX_PLAYERS) {
        diceGameState.selectedPlayers.push(name);
    } else {
        showNotification(`Tối đa ${MAX_PLAYERS} người!`, 'error');
        return;
    }

    document.querySelectorAll('.dice-player-btn').forEach(btn => {
        if (diceGameState.selectedPlayers.includes(btn.dataset.name)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    updateSelectedCount();
}

function selectAllDicePlayers() {
    diceGameState.selectedPlayers = diceGameState.players.slice(0, MAX_PLAYERS);
    document.querySelectorAll('.dice-player-btn').forEach(btn => {
        if (diceGameState.selectedPlayers.includes(btn.dataset.name)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    updateSelectedCount();
}

function deselectAllDicePlayers() {
    diceGameState.selectedPlayers = [];
    document.querySelectorAll('.dice-player-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    updateSelectedCount();
}

function setupDiceRoundButtons() {
    document.querySelectorAll('.dice-round-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dice-round-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            diceGameState.totalRounds = parseInt(btn.dataset.rounds);
        });
    });
}

function startDiceGame() {
    if (diceGameState.selectedPlayers.length < MIN_PLAYERS) {
        showNotification(`Cần ít nhất ${MIN_PLAYERS} người chơi!`, 'error');
        return;
    }

    diceGameState.selectedPlayers.forEach(name => {
        diceGameState.scores[name] = 0;
        diceGameState.roundScores[name] = [];
    });

    diceGameState.currentRound = 1;
    diceGameState.currentPlayerIndex = 0;

    document.getElementById('diceSetup').style.display = 'none';
    document.getElementById('diceGame').style.display = 'block';
    document.getElementById('diceCloseBtn').style.display = 'none';

    updateDiceGameUI();
}

function updateDiceGameUI() {
    const currentPlayer = diceGameState.selectedPlayers[diceGameState.currentPlayerIndex];
    const numPlayers = diceGameState.selectedPlayers.length;

    document.getElementById('diceRoundInfo').innerHTML =
        `<i class="fas fa-sync"></i> Lượt ${diceGameState.currentRound} / ${diceGameState.totalRounds}`;

    document.getElementById('currentPlayerTurn').innerHTML =
        `<i class="fas fa-user"></i> Đến lượt: <strong style="color: #43e97b;">${currentPlayer}</strong>`;

    // Adjust grid columns based on player count
    const gridCols = numPlayers <= 3 ? numPlayers : Math.ceil(numPlayers / 2);
    document.getElementById('dicePlayers').style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;

    const playersHtml = diceGameState.selectedPlayers.map((name, idx) => {
        const isActive = idx === diceGameState.currentPlayerIndex;
        const isFinished = idx < diceGameState.currentPlayerIndex;
        const score = diceGameState.scores[name] || 0;
        const rolls = diceGameState.roundScores[name] || [];

        return `
            <div class="dice-player-card ${isActive ? 'active' : ''} ${isFinished ? 'finished' : ''}">
                <div class="dice-player-name">${name}</div>
                <div class="dice-player-score">${score} điểm</div>
                <div class="dice-player-rolls">${rolls.length > 0 ? rolls.join(' + ') : '-'}</div>
            </div>
        `;
    }).join('');
    document.getElementById('dicePlayers').innerHTML = playersHtml;

    document.getElementById('diceDisplay').innerHTML = `
        <span class="dice-face">🎲</span>
        <span class="dice-face">🎲</span>
    `;

    const rollBtn = document.getElementById('rollDiceBtn');
    rollBtn.disabled = false;
    rollBtn.innerHTML = '<i class="fas fa-dice"></i> LẮC XÚC XẮC';
}

function rollDice() {
    if (diceGameState.isRolling) return;
    diceGameState.isRolling = true;

    const rollBtn = document.getElementById('rollDiceBtn');
    rollBtn.disabled = true;
    rollBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lắc...';

    const diceDisplay = document.getElementById('diceDisplay');
    const faces = diceDisplay.querySelectorAll('.dice-face');
    faces.forEach(f => f.classList.add('rolling'));

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;

    let animCount = 0;
    const animInterval = setInterval(() => {
        faces[0].textContent = DICE_FACES[Math.floor(Math.random() * 6)];
        faces[1].textContent = DICE_FACES[Math.floor(Math.random() * 6)];
        animCount++;
        if (animCount >= 15) {
            clearInterval(animInterval);

            faces.forEach(f => f.classList.remove('rolling'));
            faces[0].textContent = DICE_FACES[dice1 - 1];
            faces[1].textContent = DICE_FACES[dice2 - 1];

            const currentPlayer = diceGameState.selectedPlayers[diceGameState.currentPlayerIndex];
            diceGameState.scores[currentPlayer] += total;
            diceGameState.roundScores[currentPlayer].push(total);

            showNotification(`${currentPlayer}: ${dice1} + ${dice2} = ${total} điểm!`, 'success');

            setTimeout(() => {
                diceGameState.isRolling = false;
                diceGameState.currentPlayerIndex++;

                if (diceGameState.currentPlayerIndex >= diceGameState.selectedPlayers.length) {
                    diceGameState.currentPlayerIndex = 0;
                    diceGameState.currentRound++;

                    if (diceGameState.currentRound > diceGameState.totalRounds) {
                        showDiceResult();
                        return;
                    }
                }

                updateDiceGameUI();
            }, 1000);
        }
    }, 100);
}

function showDiceResult() {
    document.getElementById('diceGame').style.display = 'none';
    document.getElementById('diceResult').style.display = 'block';

    const ranking = Object.entries(diceGameState.scores)
        .sort((a, b) => b[1] - a[1]);

    const badges = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];
    const rankClasses = ['rank-1', 'rank-2', 'rank-3', '', '', ''];

    document.getElementById('diceRanking').innerHTML = ranking.map((entry, idx) => {
        const [name, score] = entry;
        const rolls = diceGameState.roundScores[name].join(' + ');
        return `
            <div class="dice-ranking-item ${rankClasses[idx] || ''}">
                <span class="dice-rank-badge">${badges[idx] || (idx + 1)}</span>
                <span class="dice-rank-name">${name}</span>
                <span class="dice-rank-score">${score} điểm</span>
            </div>
            <div style="font-size: 0.8rem; color: #718096; margin: -6px 0 10px 50px;">
                (${rolls})
            </div>
        `;
    }).join('');
}

function resetDiceGame() {
    diceGameState.selectedPlayers = [];
    diceGameState.currentRound = 1;
    diceGameState.currentPlayerIndex = 0;
    diceGameState.scores = {};
    diceGameState.roundScores = {};

    document.getElementById('diceSetup').style.display = 'block';
    document.getElementById('diceGame').style.display = 'none';
    document.getElementById('diceResult').style.display = 'none';
    document.getElementById('diceCloseBtn').style.display = 'block';

    renderDicePlayerSelect();
    updateSelectedCount();
}
