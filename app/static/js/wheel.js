/* ============ LUCKY WHEEL GAME ============ */

let wheelPeople = [];
let selectedWheelPeople = [];
let isSpinning = false;
let spinCount = 1;
let currentSpinRound = 0;
let spinResults = [];
let currentRotation = 0;

async function initWheel() {
    try {
        const res = await fetch('/api/stats/people', { credentials: 'include' });
        const data = await res.json();
        wheelPeople = data.map(p => p.name);
        if (wheelPeople.length === 0) wheelPeople = ['Người 1', 'Người 2', 'Người 3'];
    } catch (e) {
        wheelPeople = ['Người 1', 'Người 2', 'Người 3'];
    }
}

function openWheelModal() {
    renderWheelParticipants();
    setupSpinCountButtons();
    selectedWheelPeople = [...wheelPeople];
    updateWheelParticipantsUI();

    currentRotation = 0;
    spinResults = [];
    currentSpinRound = 0;
    isSpinning = false;

    drawWheel(0);
    document.getElementById('wheelResult').textContent = '';
    document.getElementById('wheelHistory').textContent = '';
    document.getElementById('spinBtn').innerHTML = '<i class="fas fa-sync"></i> QUAY!';
    document.getElementById('spinBtn').disabled = false;

    document.getElementById('wheelModal').classList.add('show');
}

function renderWheelParticipants() {
    const container = document.getElementById('wheelParticipants');
    container.innerHTML = wheelPeople.map(name => `
        <span class="wheel-participant selected" onclick="toggleWheelParticipant('${name}')" data-name="${name}">
            ${name}
        </span>
    `).join('');
}

function updateWheelParticipantsUI() {
    const participants = document.querySelectorAll('.wheel-participant');
    participants.forEach(p => {
        const name = p.dataset.name;
        if (selectedWheelPeople.includes(name)) {
            p.classList.add('selected');
        } else {
            p.classList.remove('selected');
        }
    });
    drawWheel();
}

function toggleWheelParticipant(name) {
    const idx = selectedWheelPeople.indexOf(name);
    if (idx > -1) {
        selectedWheelPeople.splice(idx, 1);
    } else {
        selectedWheelPeople.push(name);
    }
    updateWheelParticipantsUI();
}

function selectAllWheelParticipants() {
    selectedWheelPeople = [...wheelPeople];
    updateWheelParticipantsUI();
}

function deselectAllWheelParticipants() {
    selectedWheelPeople = [];
    updateWheelParticipantsUI();
}

function setupSpinCountButtons() {
    document.querySelectorAll('.spin-count-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.spin-count-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            spinCount = parseInt(btn.dataset.count);
        });
    });
}

function drawWheel(rotationAngle = 0) {
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    const centerX = 150, centerY = 150, radius = 140;
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#48bb78', '#ed8936', '#38b2ac', '#d69e2e'];

    ctx.clearRect(0, 0, 300, 300);

    const people = selectedWheelPeople.length > 0 ? selectedWheelPeople : ['?'];
    const sliceAngle = (2 * Math.PI) / people.length;
    const startOffset = -Math.PI / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngle * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    people.forEach((name, i) => {
        const startAngle = startOffset + i * sliceAngle;
        const endAngle = startOffset + (i + 1) * sliceAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;

        let displayName = name.length > 10 ? name.substring(0, 9) + '..' : name;
        ctx.fillText(displayName, radius - 20, 5);
        ctx.restore();
    });

    ctx.restore();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 4;
    ctx.stroke();
}

function spinWheel() {
    if (isSpinning) return;
    if (selectedWheelPeople.length < 2) {
        showNotification('Cần ít nhất 2 người để quay!', 'error');
        return;
    }

    if (currentSpinRound === 0) {
        spinResults = [];
        document.getElementById('wheelHistory').innerHTML = '';
    }

    isSpinning = true;
    document.getElementById('spinBtn').disabled = true;
    document.getElementById('wheelResult').textContent = '🎰 Đang quay...';

    const numPeople = selectedWheelPeople.length;
    const sliceAngle = 360 / numPeople;

    const winnerIndex = Math.floor(Math.random() * numPeople);
    const winner = selectedWheelPeople[winnerIndex];

    const targetSliceAngle = winnerIndex * sliceAngle + sliceAngle / 2;
    const angleToWinner = 360 - targetSliceAngle;

    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetRotation = currentRotation + (extraSpins * 360) + angleToWinner - (currentRotation % 360);

    const startTime = Date.now();
    const duration = 4000;
    const startRotation = currentRotation;

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4);

        currentRotation = startRotation + (targetRotation - startRotation) * easeProgress;
        drawWheel(currentRotation);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            onSpinComplete(winner);
        }
    }

    requestAnimationFrame(animate);
}

function onSpinComplete(winner) {
    isSpinning = false;
    currentSpinRound++;
    spinResults.push(winner);

    document.getElementById('wheelResult').innerHTML = `🎉 Lần ${currentSpinRound}: <strong style="color: #f5576c; font-size: 1.5rem;">${winner}</strong> 🎉`;

    const historyEl = document.getElementById('wheelHistory');
    historyEl.innerHTML = spinResults.map((r, i) => `<span style="background:#eef2ff;padding:4px 8px;border-radius:12px;margin:2px;">Lần ${i+1}: <b>${r}</b></span>`).join(' ');

    if (currentSpinRound < spinCount) {
        document.getElementById('spinBtn').disabled = false;
        document.getElementById('spinBtn').innerHTML = `<i class="fas fa-sync"></i> QUAY TIẾP (${currentSpinRound}/${spinCount})`;
    } else {
        document.getElementById('spinBtn').disabled = false;
        document.getElementById('spinBtn').innerHTML = '<i class="fas fa-redo"></i> QUAY LẠI';
        currentSpinRound = 0;

        if (spinCount > 1) {
            const counts = {};
            spinResults.forEach(r => counts[r] = (counts[r] || 0) + 1);
            const sortedResults = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const mostFrequent = sortedResults[0];
            document.getElementById('wheelResult').innerHTML += `<br><span style="margin-top:8px;display:inline-block;">👑 Người được chọn nhiều nhất: <strong style="color:#48bb78;">${mostFrequent[0]}</strong> (${mostFrequent[1]} lần)</span>`;
        }
    }
}
