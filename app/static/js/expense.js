/* ============ EXPENSE MANAGEMENT ============ */

let allMembers = [];
let editingExpenseId = null;

async function loadExpenseData() {
    try {
        const [statsRes, peopleRes, expensesRes] = await Promise.all([
            fetch('/api/stats', { credentials: 'include' }),
            fetch('/api/stats/people', { credentials: 'include' }),
            fetch('/api/expenses', { credentials: 'include' })
        ]);

        const stats = statsRes.ok ? await statsRes.json() : { total_amount: 0, total_count: 0, average_amount: 0 };
        const people = peopleRes.ok ? await peopleRes.json() : [];
        const expenses = expensesRes.ok ? await expensesRes.json() : [];

        // Update stats
        document.getElementById('totalAmount').textContent = formatMoney(stats.total_amount);
        document.getElementById('totalCount').textContent = stats.total_count;
        document.getElementById('avgAmount').textContent = formatMoney(stats.average_amount);

        // Get all unique member names
        allMembers = [...new Set(people.map(p => p.name))];

        // Update participant checkboxes
        renderParticipantCheckboxes();

        // Calculate and display balance
        calculateBalance(people, expenses);

        // Update people
        const peopleGrid = document.getElementById('peopleStats');
        peopleGrid.innerHTML = people.map(p => {
            const balance = p.total - p.share;
            return `
                <div class="person-card">
                    <div class="name">${p.name}</div>
                    <div class="amount">${formatMoney(p.total)}</div>
                    <div style="font-size: 0.8rem; color: #718096; margin-top: 4px;">
                        Phần phải trả: ${formatMoney(p.share)}
                    </div>
                </div>
            `;
        }).join('');

        // Store expenses for editing
        window.allExpenses = expenses;

        // Update expense list with participants
        const list = document.getElementById('expenseList');
        list.innerHTML = expenses.slice(0, 20).map(e => {
            const participantsHtml = e.participants ?
                `<div class="expense-participants">
                    ${e.participants.map(p => `<span class="expense-participant-tag">${p}</span>`).join('')}
                </div>` :
                '<div class="expense-participants"><span class="expense-participant-tag">Tất cả</span></div>';
            return `
                <tr>
                    <td>${e.name}</td>
                    <td class="amount">${formatMoney(e.amount)}</td>
                    <td>
                        ${e.purpose}
                        ${participantsHtml}
                    </td>
                    <td>${new Date(e.date).toLocaleDateString('vi')}</td>
                    <td>
                        <button class="btn-action btn-edit" onclick="editExpense(${e.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="deleteExpense(${e.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Name suggestions
        document.getElementById('nameSuggestions').innerHTML = allMembers.map(n => `<option value="${n}">`).join('');

    } catch (e) {
        console.error('Failed to load expense data:', e);
    }
}

function renderParticipantCheckboxes() {
    const container = document.getElementById('participantsCheckboxes');
    container.innerHTML = allMembers.map(name => `
        <label class="participant-checkbox" onclick="toggleParticipant(this)">
            <input type="checkbox" name="participants" value="${name}">
            ${name}
        </label>
    `).join('');
}

function toggleParticipant(label) {
    const checkbox = label.querySelector('input');
    setTimeout(() => {
        if (checkbox.checked) {
            label.classList.add('checked');
        } else {
            label.classList.remove('checked');
        }
    }, 0);
}

function getSelectedParticipants() {
    const checkboxes = document.querySelectorAll('#participantsCheckboxes input:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value);
    return selected.length > 0 ? selected : null;
}

function calculateBalance(people, expenses) {
    if (!people.length) {
        document.getElementById('balanceSummary').innerHTML = '<p style="color:#718096;text-align:center;">Chưa có dữ liệu</p>';
        document.getElementById('balanceDetails').innerHTML = '';
        return;
    }

    // Calculate balance for each person (paid - share)
    const balances = {};
    people.forEach(p => {
        balances[p.name] = {
            paid: p.total,
            share: p.share,
            balance: p.total - p.share
        };
    });

    // Display balance cards
    document.getElementById('balanceSummary').innerHTML = people.map(p => {
        const balance = p.total - p.share;
        let balanceClass = 'neutral';
        let label = 'Cân bằng';
        if (balance > 100) {
            balanceClass = 'positive';
            label = 'Được nhận lại';
        } else if (balance < -100) {
            balanceClass = 'negative';
            label = 'Cần trả thêm';
        }
        return `
            <div class="balance-card">
                <div class="name">${p.name}</div>
                <div class="amount ${balanceClass}">${balance >= 0 ? '+' : ''}${formatMoney(balance)}</div>
                <div class="label">${label}</div>
            </div>
        `;
    }).join('');

    // Calculate optimal transactions to settle debts
    const transactions = calculateSettlements(balances);
    document.getElementById('balanceDetails').innerHTML = transactions.length ? `
        <h4 style="margin-bottom: 12px; color: #4a5568;"><i class="fas fa-exchange-alt"></i> Cách chia tiền:</h4>
        ${transactions.map(t => `
            <div class="balance-transaction">
                <div class="parties">
                    <strong>${t.from}</strong>
                    <span class="arrow"><i class="fas fa-arrow-right"></i></span>
                    <strong>${t.to}</strong>
                </div>
                <div class="amount">${formatMoney(t.amount)}</div>
            </div>
        `).join('')}
    ` : '<p style="color:#48bb78;text-align:center;"><i class="fas fa-check-circle"></i> Tất cả đã cân bằng!</p>';
}

function calculateSettlements(balances) {
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([name, data]) => {
        if (data.balance < -100) {
            debtors.push({ name, amount: Math.abs(data.balance) });
        } else if (data.balance > 100) {
            creditors.push({ name, amount: data.balance });
        }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const amount = Math.min(debtor.amount, creditor.amount);

        if (amount > 100) {
            transactions.push({
                from: debtor.name,
                to: creditor.name,
                amount: Math.round(amount)
            });
        }

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount < 100) i++;
        if (creditor.amount < 100) j++;
    }

    return transactions;
}

function editExpense(id) {
    const expense = window.allExpenses.find(e => e.id === id);
    if (!expense) {
        showNotification('Không tìm thấy chi tiêu', 'error');
        return;
    }

    document.getElementById('expenseName').value = expense.name;
    document.getElementById('expenseAmount').value = expense.amount / 1000;
    document.getElementById('expensePurpose').value = expense.purpose;

    document.querySelectorAll('#participantsCheckboxes input').forEach(cb => {
        if (expense.participants && expense.participants.includes(cb.value)) {
            cb.checked = true;
            cb.closest('.participant-checkbox').classList.add('checked');
        } else {
            cb.checked = false;
            cb.closest('.participant-checkbox').classList.remove('checked');
        }
    });

    editingExpenseId = id;

    const submitBtn = document.querySelector('.btn-add');
    const cancelBtn = document.querySelector('.btn-cancel');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Cập nhật';
    submitBtn.classList.add('editing');
    cancelBtn.style.display = 'inline-block';

    document.getElementById('expenseForm').scrollIntoView({ behavior: 'smooth' });
    showNotification('Đang sửa chi tiêu - Nhấn "Cập nhật" để lưu', 'success');
}

function cancelEdit() {
    editingExpenseId = null;
    document.getElementById('expenseForm').reset();
    document.querySelectorAll('#participantsCheckboxes input').forEach(cb => {
        cb.checked = false;
        cb.closest('.participant-checkbox').classList.remove('checked');
    });
    const submitBtn = document.querySelector('.btn-add');
    const cancelBtn = document.querySelector('.btn-cancel');
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Thêm';
    submitBtn.classList.remove('editing');
    cancelBtn.style.display = 'none';
}

async function addExpense(e) {
    e.preventDefault();
    const name = document.getElementById('expenseName').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value) * 1000;
    const purpose = document.getElementById('expensePurpose').value.trim();
    const participants = getSelectedParticipants();

    try {
        let res;
        if (editingExpenseId) {
            res = await fetch(`/api/expenses/${editingExpenseId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, amount, purpose, participants })
            });
        } else {
            res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, amount, purpose, participants })
            });
        }

        if (res.ok) {
            showNotification(editingExpenseId ? 'Cập nhật thành công!' : 'Thêm thành công!', 'success');
            cancelEdit();
            loadExpenseData();
        } else {
            const err = await res.json();
            showNotification(err.error || 'Lỗi', 'error');
        }
    } catch (err) {
        showNotification('Lỗi kết nối', 'error');
    }
}

async function deleteExpense(id) {
    if (!confirm('Xóa chi tiêu này?')) return;

    try {
        const res = await fetch(`/api/expenses/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (res.ok) {
            showNotification('Đã xóa!', 'success');
            loadExpenseData();
        } else {
            const err = await res.json();
            showNotification(err.error || 'Lỗi khi xóa', 'error');
        }
    } catch (e) {
        showNotification('Lỗi kết nối', 'error');
    }
}
