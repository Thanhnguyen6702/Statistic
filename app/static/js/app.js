class ExpenseManager {
    constructor() {
        this.expenses = [];
        this.editingId = null;
        this.isLocked = false;
        this.currentAction = null;
        this.memberSuggestions = new Set(); // Lưu danh sách tên thành viên
        this.allMembers = new Set(); // Tất cả thành viên (bao gồm cả participants)
        this.init();
    }

    init() {
        this.loadExpenses();
        this.loadStats();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Thêm event listener cho input số tiền để hiển thị preview
        const amountInput = document.getElementById('amount');
        amountInput.addEventListener('input', (e) => {
            this.updateAmountPreview(e.target.value);
        });

        // Thêm event listener cho input tên để kích hoạt autocomplete
        const nameInput = document.getElementById('name');
        nameInput.addEventListener('input', (e) => {
            this.showSuggestions(e.target.value);
        });

        // Xử lý phím mũi tên cho navigation
        nameInput.addEventListener('keydown', (e) => {
            this.handleKeyNavigation(e);
        });

        // Ẩn suggestions khi click ra ngoài
        nameInput.addEventListener('blur', (e) => {
            // Delay để cho phép click vào suggestions
            setTimeout(() => {
                this.hideSuggestions();
            }, 200);
        });

        // Hiển thị suggestions khi focus vào input
        nameInput.addEventListener('focus', (e) => {
            // Hiển thị tất cả gợi ý khi focus, hoặc filter theo giá trị hiện tại
            this.showSuggestions(e.target.value || '');
        });

        window.onclick = (event) => {
            const historyModal = document.getElementById('historyModal');
            const personModal = document.getElementById('personModal');
            const passwordModal = document.getElementById('passwordModal');
            const archiveModal = document.getElementById('archiveModal');
            const archiveListModal = document.getElementById('archiveListModal');
            const actionPasswordModal = document.getElementById('actionPasswordModal');

            if (event.target === historyModal) {
                historyModal.style.display = 'none';
            }
            if (event.target === personModal) {
                personModal.style.display = 'none';
            }
            if (event.target === passwordModal) {
                passwordModal.style.display = 'none';
            }
            if (event.target === archiveModal) {
                archiveModal.style.display = 'none';
            }
            if (event.target === archiveListModal) {
                archiveListModal.style.display = 'none';
            }
            if (event.target === actionPasswordModal) {
                this.closeActionPasswordModal();
            }

            const spinWheelModal = document.getElementById('spinWheelModal');
            if (event.target === spinWheelModal) {
                spinWheelModal.style.display = 'none';
            }
        };
    }

    async loadExpenses() {
        try {
            const response = await fetch('/api/expenses');
            this.expenses = await response.json();
            // Cập nhật danh sách gợi ý tên thành viên
            this.expenses.forEach(expense => {
                this.memberSuggestions.add(expense.name);
                this.allMembers.add(expense.name);
                // Thêm cả participants vào danh sách
                if (expense.participants && Array.isArray(expense.participants)) {
                    expense.participants.forEach(p => this.allMembers.add(p));
                }
            });
            this.renderExpenses();
            this.setupAutocomplete();
            this.updateParticipantsList();
        } catch (error) {
            console.error('Error loading expenses:', error);
        }
    }

    updateParticipantsList() {
        const container = document.getElementById('participantsList');
        if (!container) return;

        container.innerHTML = '';
        const sortedMembers = Array.from(this.allMembers).sort();

        sortedMembers.forEach(member => {
            const label = document.createElement('label');
            label.className = 'participant-checkbox';
            label.innerHTML = `
                <input type="checkbox" name="participant" value="${member}">
                <span>${member}</span>
            `;
            container.appendChild(label);
        });
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            this.updateStats(stats);
            this.loadPeopleStats();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadPeopleStats() {
        try {
            const response = await fetch('/api/stats/people');
            const peopleStats = await response.json();
            this.renderPeopleStats(peopleStats);
        } catch (error) {
            console.error('Error loading people stats:', error);
        }
    }

    updateStats(stats) {
        document.getElementById('totalAmount').textContent = this.formatCurrency(stats.total);
        document.getElementById('totalCount').textContent = stats.count;
        document.getElementById('averageAmount').textContent = this.formatCurrency(stats.average);
    }

    renderPeopleStats(peopleStats) {
        const grid = document.getElementById('peopleStatsGrid');
        grid.innerHTML = '';

        if (peopleStats.length === 0) {
            grid.innerHTML = '<div class="loading">Chưa có dữ liệu thống kê</div>';
            return;
        }

        peopleStats.forEach(person => {
            const card = document.createElement('div');
            card.className = 'person-card';
            card.onclick = () => this.showPersonDetail(person.name);

            // Balance = total paid - share owed
            // Positive = paid more than share (should receive money)
            // Negative = paid less than share (should pay money)
            const balance = person.total - (person.share || 0);

            card.innerHTML = `
                <div class="person-card-content">
                    <span class="person-name">${person.name}</span>
                    <span class="person-transactions">${person.count} giao dịch</span>
                    <span class="person-total">${this.formatCurrency(person.total)}</span>
                    <span class="person-balance ${balance >= 0 ? 'positive' : 'negative'}">
                        ${balance >= 0 ? '+' : ''}${this.formatCurrency(Math.abs(balance))}
                    </span>
                    <span class="person-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </span>
                </div>
            `;

            grid.appendChild(card);
        });
    }

    renderExpenses() {
        const tbody = document.getElementById('expenseTableBody');
        tbody.innerHTML = '';

        if (this.expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">Chưa có chi tiêu nào</td></tr>';
            return;
        }

        this.expenses.forEach(expense => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${expense.name}</td>
                <td class="amount">${this.formatCurrency(expense.amount)}</td>
                <td>${expense.purpose}</td>
                <td>${this.formatDate(expense.date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-edit" onclick="expenseManager.editExpense(${expense.id})">
                            <i class="fas fa-edit"></i> Sửa
                        </button>
                        <button class="btn btn-danger" onclick="expenseManager.deleteExpense(${expense.id})">
                            <i class="fas fa-trash"></i> Xóa
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async handleFormSubmit() {
        if (this.isLocked) {
            this.showNotification('Chức năng đã bị khóa', 'error');
            return;
        }

        const formData = new FormData(document.getElementById('expenseForm'));

        // Chuẩn hóa tên: trim space và capitalize từng từ
        let rawName = formData.get('name').trim();
        const normalizedName = this.normalizeName(rawName);

        // Chuyển đổi số tiền: nhập 1 = 1000 VNĐ
        let rawAmount = parseFloat(formData.get('amount'));
        const actualAmount = rawAmount * 1000;

        // Get selected participants
        let participants = null;
        const selectParticipantsCheckbox = document.getElementById('selectParticipants');
        if (selectParticipantsCheckbox && selectParticipantsCheckbox.checked) {
            const checkboxes = document.querySelectorAll('#participantsList input[name="participant"]:checked');
            participants = Array.from(checkboxes).map(cb => cb.value);
            if (participants.length === 0) {
                this.showNotification('Vui lòng chọn ít nhất một người tham gia', 'error');
                return;
            }
        }

        const data = {
            name: normalizedName,
            amount: actualAmount,
            purpose: formData.get('purpose').trim(),
            participants: participants
        };

        if (!data.name || !data.amount || !data.purpose) {
            this.showNotification('Vui lòng điền đầy đủ thông tin', 'error');
            return;
        }

        // If editing, require password
        if (this.editingId) {
            this.showPasswordPrompt('edit', async (password) => {
                data.password = password;
                await this.submitExpense(data);
            });
        } else {
            await this.submitExpense(data);
        }
    }

    async submitExpense(data) {
        try {
            const url = this.editingId ? `/api/expenses/${this.editingId}` : '/api/expenses';
            const method = this.editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                // Thêm tên mới vào danh sách gợi ý
                this.memberSuggestions.add(data.name);
                this.allMembers.add(data.name);

                const message = this.editingId ? 'Cập nhật thành công!' : 'Thêm chi tiêu thành công!';
                this.resetForm();
                this.loadExpenses();
                this.loadStats();
                this.showNotification(message, 'success');
            } else {
                const result = await response.json();
                this.showNotification(result.error || 'Có lỗi xảy ra', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    editExpense(id) {
        if (this.isLocked) {
            this.showNotification('Chức năng đã bị khóa', 'error');
            return;
        }

        const expense = this.expenses.find(e => e.id === id);
        if (expense) {
            document.getElementById('name').value = expense.name;
            // Hiển thị số tiền đã chia cho 1000 (số đơn giản)
            document.getElementById('amount').value = expense.amount / 1000;
            document.getElementById('purpose').value = expense.purpose;

            // Handle participants
            const selectParticipantsCheckbox = document.getElementById('selectParticipants');
            const participantsContainer = document.getElementById('participantsContainer');

            if (expense.participants && expense.participants.length > 0) {
                selectParticipantsCheckbox.checked = true;
                participantsContainer.style.display = 'block';

                // Check the correct participants
                const checkboxes = document.querySelectorAll('#participantsList input[name="participant"]');
                checkboxes.forEach(cb => {
                    cb.checked = expense.participants.includes(cb.value);
                });
            } else {
                selectParticipantsCheckbox.checked = false;
                participantsContainer.style.display = 'none';
            }

            this.editingId = id;
            document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Cập nhật';

            document.querySelector('.form-section h2').scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Show password modal for edit/delete operations
    showPasswordPrompt(action, callback) {
        this.pendingAction = { action, callback };
        document.getElementById('passwordModalTitle').textContent =
            action === 'edit' ? 'Xác nhận sửa chi tiêu' : 'Xác nhận xóa chi tiêu';
        document.getElementById('actionPassword').value = '';
        document.getElementById('actionPasswordModal').style.display = 'block';
    }

    confirmActionPassword() {
        const password = document.getElementById('actionPassword').value;
        if (!password) {
            this.showNotification('Vui lòng nhập mật khẩu', 'error');
            return;
        }

        if (this.pendingAction && this.pendingAction.callback) {
            this.pendingAction.callback(password);
        }

        this.closeActionPasswordModal();
    }

    closeActionPasswordModal() {
        document.getElementById('actionPasswordModal').style.display = 'none';
        document.getElementById('actionPassword').value = '';
        this.pendingAction = null;
    }

    async deleteExpense(id) {
        if (this.isLocked) {
            this.showNotification('Chức năng đã bị khóa', 'error');
            return;
        }

        if (!confirm('Bạn có chắc chắn muốn xóa chi tiêu này?')) {
            return;
        }

        // Show password prompt
        this.showPasswordPrompt('delete', async (password) => {
            try {
                const response = await fetch(`/api/expenses/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password })
                });

                if (response.ok) {
                    this.loadExpenses();
                    this.loadStats();
                    this.showNotification('Xóa thành công!', 'success');
                } else {
                    const result = await response.json();
                    this.showNotification(result.error || 'Có lỗi xảy ra khi xóa', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                this.showNotification('Có lỗi xảy ra', 'error');
            }
        });
    }

    resetForm() {
        document.getElementById('expenseForm').reset();
        this.editingId = null;
        document.getElementById('submitBtn').innerHTML = '<i class="fas fa-plus"></i> Thêm chi tiêu';
        this.hideSuggestions();

        // Reset participants selection
        const selectParticipantsCheckbox = document.getElementById('selectParticipants');
        if (selectParticipantsCheckbox) {
            selectParticipantsCheckbox.checked = false;
        }
        const participantsContainer = document.getElementById('participantsContainer');
        if (participantsContainer) {
            participantsContainer.style.display = 'none';
        }
        // Uncheck all participant checkboxes
        const checkboxes = document.querySelectorAll('#participantsList input[name="participant"]');
        checkboxes.forEach(cb => cb.checked = false);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    // Thêm method để cập nhật preview số tiền
    updateAmountPreview(value) {
        const amountInput = document.getElementById('amount');
        const formHint = amountInput.parentElement.querySelector('.form-hint');
        
        if (value && !isNaN(value) && parseFloat(value) > 0) {
            const actualAmount = parseFloat(value) * 1000;
            formHint.textContent = `= ${this.formatCurrency(actualAmount)}`;
            formHint.style.color = '#48bb78';
            formHint.style.fontWeight = '600';
        } else {
            formHint.textContent = 'Nhập số đơn giản: 1 = 1,000 VNĐ';
            formHint.style.color = '#718096';
            formHint.style.fontWeight = 'normal';
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Thêm method để chuẩn hóa tên
    normalizeName(name) {
        if (!name) return '';
        
        return name
            .trim()
            .toLowerCase()
            .split(' ')
            .filter(word => word.length > 0) // Loại bỏ khoảng trắng thừa
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    setupAutocomplete() {
        const nameInput = document.getElementById('name');
        this.suggestionBox = document.createElement('div');
        this.suggestionBox.className = 'suggestion-box';
        this.selectedIndex = -1; // Index của suggestion được chọn
        nameInput.parentNode.appendChild(this.suggestionBox);
    }

    handleKeyNavigation(e) {
        if (!this.suggestionBox || this.suggestionBox.style.display === 'none') {
            return;
        }

        const suggestions = this.suggestionBox.querySelectorAll('.suggestion-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, suggestions.length - 1);
                this.highlightSuggestion(suggestions);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.highlightSuggestion(suggestions);
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && suggestions[this.selectedIndex]) {
                    suggestions[this.selectedIndex].click();
                }
                break;
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }

    highlightSuggestion(suggestions) {
        suggestions.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    showSuggestions(input) {
        let filtered;
        
        if (!input || input.trim() === '') {
            // Hiển thị tất cả gợi ý khi không có input
            filtered = Array.from(this.memberSuggestions);
        } else {
            // Filter theo input
            filtered = Array.from(this.memberSuggestions).filter(name => 
                name.toLowerCase().includes(input.toLowerCase())
            );
        }

        if (filtered.length === 0) {
            this.hideSuggestions();
            return;
        }

        // Sắp xếp theo độ phổ biến (số lần xuất hiện)
        const sortedFiltered = filtered.sort((a, b) => {
            const countA = this.expenses.filter(exp => exp.name === a).length;
            const countB = this.expenses.filter(exp => exp.name === b).length;
            return countB - countA;
        });

        this.suggestionBox.innerHTML = sortedFiltered.map(name => {
            const count = this.expenses.filter(exp => exp.name === name).length;
            const total = this.expenses.filter(exp => exp.name === name)
                .reduce((sum, exp) => sum + exp.amount, 0);
            return `<div class="suggestion-item" onclick="expenseManager.selectSuggestion('${name}')">
                <div class="suggestion-info">
                    <div class="suggestion-name">${name}</div>
                    <div class="suggestion-details">
                        <span class="suggestion-count">${count} giao dịch</span>
                        <span class="suggestion-total">${this.formatCurrency(total)}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
        
        this.selectedIndex = -1; // Reset selection
        this.suggestionBox.style.display = 'block';
    }

    hideSuggestions() {
        if (this.suggestionBox) {
            this.suggestionBox.style.display = 'none';
            this.selectedIndex = -1; // Reset selection
        }
    }

    selectSuggestion(name) {
        document.getElementById('name').value = name;
        this.hideSuggestions();
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#48bb78' : '#f56565'};
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    async showPersonDetail(name) {
        try {
            const response = await fetch(`/api/people/${encodeURIComponent(name)}/expenses`);
            const personData = await response.json();
            
            if (response.ok) {
                this.renderPersonDetail(personData);
                document.getElementById('personModal').style.display = 'block';
            } else {
                this.showNotification('Không thể tải chi tiết người này', 'error');
            }
        } catch (error) {
            console.error('Error loading person detail:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    renderPersonDetail(personData) {
        document.getElementById('personName').textContent = personData.name;
        
        const summary = document.getElementById('personSummary');
        summary.innerHTML = `
            <h4>Tổng quan chi tiêu</h4>
            <div class="summary-stats">
                <div class="summary-stat">
                    <div class="summary-stat-value">${this.formatCurrency(personData.total)}</div>
                    <div class="summary-stat-label">Tổng chi tiêu</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value">${personData.count}</div>
                    <div class="summary-stat-label">Số giao dịch</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value">${this.formatCurrency(personData.total / personData.count)}</div>
                    <div class="summary-stat-label">Trung bình</div>
                </div>
            </div>
        `;
        
        const expenses = document.getElementById('personExpenses');
        expenses.innerHTML = '<h4>Chi tiết các khoản chi tiêu</h4>';
        
        personData.expenses.forEach(expense => {
            const item = document.createElement('div');
            item.className = 'expense-item';
            item.innerHTML = `
                <div class="expense-item-header">
                    <div class="expense-amount">${this.formatCurrency(expense.amount)}</div>
                    <div class="expense-date">${this.formatDate(expense.date)}</div>
                </div>
                <div class="expense-purpose">${expense.purpose}</div>
            `;
            expenses.appendChild(item);
        });
    }

    updateLockUI() {
        const body = document.body;
        const lockIcon = document.getElementById('lockIcon');
        const lockText = document.getElementById('lockText');
        
        if (this.isLocked) {
            body.classList.add('locked');
            lockIcon.className = 'fas fa-lock';
            lockText.textContent = 'Đã khóa';
        } else {
            body.classList.remove('locked');
            lockIcon.className = 'fas fa-lock-open';
            lockText.textContent = 'Mở khóa';
        }
    }

    async archiveData(password) {
        try {
            const response = await fetch('/api/archive', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.showNotification(`Đã lưu trữ ${result.archived_items} mục và bắt đầu thống kê mới!`, 'success');
                this.loadExpenses();
                this.loadStats();
                this.loadPeopleStats();
            } else {
                this.showNotification(result.error || 'Có lỗi xảy ra', 'error');
            }
        } catch (error) {
            console.error('Error archiving data:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    async toggleLockStatus(password) {
        try {
            const response = await fetch('/api/lock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.isLocked = !this.isLocked;
                this.updateLockUI();
                const status = this.isLocked ? 'khóa' : 'mở khóa';
                this.showNotification(`Đã ${status} chức năng chỉnh sửa`, 'success');
            } else {
                this.showNotification(result.error || 'Mật khẩu không đúng', 'error');
            }
        } catch (error) {
            console.error('Error toggling lock:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    async loadArchiveList() {
        try {
            const response = await fetch('/api/archive/stats');
            const archives = await response.json();
            this.renderArchiveList(archives);
        } catch (error) {
            console.error('Error loading archive list:', error);
        }
    }

    renderArchiveList(archives) {
        const list = document.getElementById('archiveList');
        list.innerHTML = '';

        if (archives.length === 0) {
            list.innerHTML = '<div class="loading">Chưa có dữ liệu lưu trữ</div>';
            return;
        }

        archives.reverse().forEach((archive, index) => {
            const item = document.createElement('div');
            item.className = 'archive-item clickable';
            item.onclick = () => this.showArchiveDetail(archive, archives.length - index);
            
            const total = archive.data.reduce((sum, exp) => sum + exp.amount, 0);
            const peopleCount = [...new Set(archive.data.map(exp => exp.name))].length;
            
            item.innerHTML = `
                <div class="archive-header">
                    <div class="archive-title">
                        <i class="fas fa-archive"></i>
                        <span>Đợt ${archives.length - index}</span>
                    </div>
                    <div class="archive-meta">
                        <span class="archive-date">${this.formatDate(archive.timestamp)}</span>
                        <div class="archive-arrow">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                </div>
                <div class="archive-stats">
                    <div class="archive-stat">
                        <i class="fas fa-receipt"></i>
                        <span>${archive.data.length} giao dịch</span>
                    </div>
                    <div class="archive-stat">
                        <i class="fas fa-users"></i>
                        <span>${peopleCount} người</span>
                    </div>
                    <div class="archive-stat total">
                        <i class="fas fa-wallet"></i>
                        <span>${this.formatCurrency(total)}</span>
                    </div>
                </div>
            `;
            
            list.appendChild(item);
        });
    }

    showArchiveDetail(archive, periodNumber) {
        // Create archive detail modal content
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'archiveDetailModal';
        
        const total = archive.data.reduce((sum, exp) => sum + exp.amount, 0);
        const peopleStats = {};
        
        // Calculate people stats for this archive
        archive.data.forEach(exp => {
            if (!peopleStats[exp.name]) {
                peopleStats[exp.name] = { total: 0, count: 0 };
            }
            peopleStats[exp.name].total += exp.amount;
            peopleStats[exp.name].count += 1;
        });
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-archive"></i> Chi Tiết Đợt ${periodNumber}</h3>
                    <span class="close" onclick="closeArchiveDetailModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="archive-detail-summary">
                        <h4>Tổng quan</h4>
                        <div class="summary-stats">
                            <div class="summary-stat">
                                <div class="summary-stat-value">${this.formatCurrency(total)}</div>
                                <div class="summary-stat-label">Tổng chi tiêu</div>
                            </div>
                            <div class="summary-stat">
                                <div class="summary-stat-value">${archive.data.length}</div>
                                <div class="summary-stat-label">Số giao dịch</div>
                            </div>
                            <div class="summary-stat">
                                <div class="summary-stat-value">${Object.keys(peopleStats).length}</div>
                                <div class="summary-stat-label">Số người</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="archive-people-stats">
                        <h4>Thống kê theo người</h4>
                        <div class="people-stats-list">
                            ${Object.entries(peopleStats)
                                .sort(([,a], [,b]) => b.total - a.total)
                                .map(([name, stats]) => `
                                    <div class="person-stat-item">
                                        <div class="person-stat-name">${name}</div>
                                        <div class="person-stat-details">
                                            <span class="person-stat-amount">${this.formatCurrency(stats.total)}</span>
                                            <span class="person-stat-count">(${stats.count} giao dịch)</span>
                                        </div>
                                    </div>
                                `).join('')}
                        </div>
                    </div>
                    
                    <div class="archive-expenses">
                        <h4>Chi tiết giao dịch</h4>
                        <div class="expenses-list">
                            ${archive.data.map(exp => `
                                <div class="expense-item">
                                    <div class="expense-item-header">
                                        <div class="expense-name">${exp.name}</div>
                                        <div class="expense-amount">${this.formatCurrency(exp.amount)}</div>
                                    </div>
                                    <div class="expense-purpose">${exp.purpose}</div>
                                    <div class="expense-date">${this.formatDate(exp.date)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
    }

    async loadHistory() {
        try {
            const response = await fetch('/api/history');
            const history = await response.json();
            this.renderHistory(history);
            this.updateHistoryMonthSelect(history);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    updateHistoryMonthSelect(history) {
        const select = document.getElementById('historyMonthSelect');
        if (!select) return;

        // Get unique months from history
        const months = new Set();
        history.forEach(item => {
            const date = new Date(item.timestamp);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(monthKey);
        });

        // Clear existing options except first two
        while (select.options.length > 2) {
            select.remove(2);
        }

        // Add month options sorted descending
        Array.from(months).sort().reverse().forEach(month => {
            const [year, mon] = month.split('-');
            const option = document.createElement('option');
            option.value = month;
            option.textContent = `Tháng ${mon}/${year}`;
            select.appendChild(option);
        });
    }

    async clearHistory(month, password) {
        try {
            const response = await fetch('/api/history/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ month, password })
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification(`Đã xóa ${result.deleted_count} mục lịch sử`, 'success');
                this.loadHistory();
            } else {
                this.showNotification(result.error || 'Có lỗi xảy ra', 'error');
            }
        } catch (error) {
            console.error('Error clearing history:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    renderHistory(history) {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';

        if (history.length === 0) {
            historyList.innerHTML = '<div class="loading">Chưa có lịch sử chỉnh sửa</div>';
            return;
        }

        history.reverse().forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            let actionText = '';
            let dataText = '';
            
            // Parse JSON data
            let parsedData;
            try {
                parsedData = JSON.parse(item.data);
            } catch (e) {
                console.error('Error parsing history data:', e);
                parsedData = item.data;
            }
            
            switch (item.action) {
                case 'ADD':
                    actionText = '➕ Thêm chi tiêu mới';
                    dataText = `${parsedData.name} - ${this.formatCurrency(parsedData.amount)} - ${parsedData.purpose}`;
                    break;
                case 'UPDATE':
                    actionText = '✏️ Cập nhật chi tiêu';
                    dataText = `${parsedData.new.name} - ${this.formatCurrency(parsedData.new.amount)} - ${parsedData.new.purpose}`;
                    break;
                case 'DELETE':
                    actionText = '🗑️ Xóa chi tiêu';
                    dataText = `${parsedData.name} - ${this.formatCurrency(parsedData.amount)} - ${parsedData.purpose}`;
                    break;
                case 'ARCHIVE':
                    actionText = '📦 Lưu trữ dữ liệu';
                    dataText = `Đã lưu trữ ${parsedData.count} mục chi tiêu`;
                    break;
                default:
                    actionText = `📝 ${item.action}`;
                    dataText = JSON.stringify(parsedData);
            }

            historyItem.innerHTML = `
                <div class="history-action">${actionText}</div>
                <div class="history-time">${this.formatDate(item.timestamp)}</div>
                <div class="history-data">${dataText}</div>
            `;
            
            historyList.appendChild(historyItem);
        });
    }
}

function toggleHistory() {
    const modal = document.getElementById('historyModal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'block';
        expenseManager.loadHistory();
    }
}

function closePersonModal() {
    document.getElementById('personModal').style.display = 'none';
}

const expenseManager = new ExpenseManager();

// Modal functions for admin features
function toggleLock() {
    expenseManager.currentAction = 'lock';
    document.getElementById('passwordModal').style.display = 'block';
}

function showArchiveModal() {
    document.getElementById('archiveModal').style.display = 'block';
}

function closeArchiveModal() {
    document.getElementById('archiveModal').style.display = 'none';
    document.getElementById('archivePassword').value = '';
}

function confirmArchive() {
    const password = document.getElementById('archivePassword').value;
    if (!password) {
        expenseManager.showNotification('Vui lòng nhập mật khẩu', 'error');
        return;
    }
    
    expenseManager.archiveData(password);
    closeArchiveModal();
}

function showArchiveList() {
    expenseManager.loadArchiveList();
    document.getElementById('archiveListModal').style.display = 'block';
}

function closeArchiveListModal() {
    document.getElementById('archiveListModal').style.display = 'none';
}

function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    expenseManager.currentAction = null;
}

function submitPassword() {
    const password = document.getElementById('adminPassword').value;
    if (!password) {
        expenseManager.showNotification('Vui lòng nhập mật khẩu', 'error');
        return;
    }
    
    if (expenseManager.currentAction === 'lock') {
        expenseManager.toggleLockStatus(password);
    }
    
    closePasswordModal();
}

function refreshPeopleStats() {
    expenseManager.loadPeopleStats();
}

function closeArchiveDetailModal() {
    const modal = document.getElementById('archiveDetailModal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

function clearHistoryByMonth() {
    const select = document.getElementById('historyMonthSelect');
    const month = select.value;

    if (!month) {
        expenseManager.showNotification('Vui lòng chọn tháng cần xóa', 'error');
        return;
    }

    const confirmMsg = month === 'all'
        ? 'Bạn có chắc chắn muốn xóa TẤT CẢ lịch sử?'
        : `Bạn có chắc chắn muốn xóa lịch sử tháng ${month}?`;

    if (!confirm(confirmMsg)) {
        return;
    }

    // Show password prompt
    expenseManager.showPasswordPrompt('delete', async (password) => {
        await expenseManager.clearHistory(month, password);
    });
}

async function handleLogout() {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        return;
    }

    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
        expenseManager.showNotification('Có lỗi xảy ra khi đăng xuất', 'error');
    }
}

// Participants helper functions
function toggleParticipantsSelect() {
    const checkbox = document.getElementById('selectParticipants');
    const container = document.getElementById('participantsContainer');
    if (checkbox && container) {
        container.style.display = checkbox.checked ? 'block' : 'none';
    }
}

function selectAllParticipants() {
    const checkboxes = document.querySelectorAll('#participantsList input[name="participant"]');
    checkboxes.forEach(cb => cb.checked = true);
}

function deselectAllParticipants() {
    const checkboxes = document.querySelectorAll('#participantsList input[name="participant"]');
    checkboxes.forEach(cb => cb.checked = false);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ========== SPIN WHEEL FUNCTIONALITY ==========

class SpinWheelManager {
    constructor() {
        this.participants = new Set();
        this.selectedParticipants = new Set();
        this.wheel = null;
        this.isSpinning = false;
        this.rotation = 0;
        this.stats = this.loadStats();

        // Wheel colors - beautiful gradient colors
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
            '#FF69B4', '#32CD32', '#FF8C00', '#9370DB'
        ];
    }

    loadStats() {
        try {
            const saved = localStorage.getItem('spinWheelStats');
            if (saved) {
                const data = JSON.parse(saved);
                return {
                    results: data.results || {},
                    totalSpins: data.totalSpins || 0
                };
            }
        } catch (e) {
            console.error('Error loading spin stats:', e);
        }
        return { results: {}, totalSpins: 0 };
    }

    saveStats() {
        try {
            localStorage.setItem('spinWheelStats', JSON.stringify(this.stats));
        } catch (e) {
            console.error('Error saving spin stats:', e);
        }
    }

    clearStats() {
        this.stats = { results: {}, totalSpins: 0 };
        this.saveStats();
        this.renderStats();
        expenseManager.showNotification('Đã xóa thống kê vòng quay', 'success');
    }

    initParticipants() {
        // Get members from expense manager
        if (expenseManager && expenseManager.allMembers) {
            expenseManager.allMembers.forEach(member => {
                this.participants.add(member);
            });
        }
        this.renderParticipants();
    }

    addParticipant(name) {
        if (!name || name.trim() === '') return;

        const normalizedName = expenseManager.normalizeName(name);
        if (this.participants.has(normalizedName)) {
            expenseManager.showNotification('Người này đã có trong danh sách', 'error');
            return;
        }

        this.participants.add(normalizedName);
        this.selectedParticipants.add(normalizedName);
        this.renderParticipants();
        this.drawWheel();

        // Clear input
        document.getElementById('newParticipantName').value = '';
    }

    removeParticipant(name) {
        this.participants.delete(name);
        this.selectedParticipants.delete(name);
        this.renderParticipants();
        this.drawWheel();
    }

    toggleParticipant(name) {
        if (this.selectedParticipants.has(name)) {
            this.selectedParticipants.delete(name);
        } else {
            this.selectedParticipants.add(name);
        }
        this.renderParticipants();
        this.drawWheel();
    }

    selectAll() {
        this.participants.forEach(p => this.selectedParticipants.add(p));
        this.renderParticipants();
        this.drawWheel();
    }

    deselectAll() {
        this.selectedParticipants.clear();
        this.renderParticipants();
        this.drawWheel();
    }

    renderParticipants() {
        const container = document.getElementById('spinParticipantsList');
        if (!container) return;

        container.innerHTML = '';
        const sorted = Array.from(this.participants).sort();

        sorted.forEach(name => {
            const isSelected = this.selectedParticipants.has(name);
            const item = document.createElement('div');
            item.className = `spin-participant-item ${isSelected ? 'selected' : ''}`;
            item.onclick = (e) => {
                if (!e.target.classList.contains('remove-btn') && !e.target.closest('.remove-btn')) {
                    this.toggleParticipant(name);
                }
            };

            item.innerHTML = `
                <input type="checkbox" ${isSelected ? 'checked' : ''}>
                <span class="checkmark">
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </span>
                <span class="name">${name}</span>
                <button class="remove-btn" onclick="event.stopPropagation(); spinWheelManager.removeParticipant('${name}')">
                    <i class="fas fa-times"></i>
                </button>
            `;

            container.appendChild(item);
        });
    }

    drawWheel() {
        const canvas = document.getElementById('spinCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const selected = Array.from(this.selectedParticipants);

        if (selected.length === 0) {
            // Draw empty wheel
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = '#e2e8f0';
            ctx.fill();
            ctx.strokeStyle = '#cbd5e0';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Draw text
            ctx.fillStyle = '#718096';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Chọn người tham gia', centerX, centerY);
            return;
        }

        const sliceAngle = (2 * Math.PI) / selected.length;

        // Save context state
        ctx.save();

        // Apply rotation
        ctx.translate(centerX, centerY);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.translate(-centerX, -centerY);

        // Draw slices
        selected.forEach((name, index) => {
            const startAngle = index * sliceAngle - Math.PI / 2;
            const endAngle = startAngle + sliceAngle;

            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();

            // Fill with color
            ctx.fillStyle = this.colors[index % this.colors.length];
            ctx.fill();

            // Stroke
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw text
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + sliceAngle / 2);

            const textRadius = radius * 0.65;
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 3;

            // Truncate name if too long
            let displayName = name;
            if (displayName.length > 10) {
                displayName = displayName.substring(0, 8) + '..';
            }

            ctx.fillText(displayName, textRadius, 0);
            ctx.restore();
        });

        // Restore context
        ctx.restore();

        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw outer ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    spin() {
        const selected = Array.from(this.selectedParticipants);

        if (selected.length < 2) {
            expenseManager.showNotification('Cần ít nhất 2 người để quay', 'error');
            return;
        }

        if (this.isSpinning) return;

        this.isSpinning = true;

        // Hide previous winner
        document.getElementById('winnerDisplay').style.display = 'none';

        // Disable button
        const spinBtn = document.getElementById('spinButton');
        spinBtn.disabled = true;
        spinBtn.classList.add('spinning');
        spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang quay...';

        // Calculate random winner
        const winnerIndex = Math.floor(Math.random() * selected.length);
        const winner = selected[winnerIndex];

        // Calculate final rotation
        const sliceAngle = 360 / selected.length;
        // Target rotation: point to winner (at top, which is -90 degrees or 270 degrees)
        // Winner should be at the top when wheel stops
        const targetAngle = 360 - (winnerIndex * sliceAngle) - (sliceAngle / 2);
        const extraSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
        const finalRotation = this.rotation + (extraSpins * 360) + targetAngle - (this.rotation % 360);

        // Animate with GSAP if available, otherwise use requestAnimationFrame
        if (typeof gsap !== 'undefined') {
            gsap.to(this, {
                rotation: finalRotation,
                duration: 4 + Math.random(),
                ease: "power4.out",
                onUpdate: () => this.drawWheel(),
                onComplete: () => this.onSpinComplete(winner)
            });
        } else {
            // Fallback animation
            this.animateSpin(finalRotation, winner);
        }
    }

    animateSpin(targetRotation, winner) {
        const startRotation = this.rotation;
        const rotationDiff = targetRotation - startRotation;
        const duration = 4000 + Math.random() * 1000;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out quart
            const easeProgress = 1 - Math.pow(1 - progress, 4);

            this.rotation = startRotation + (rotationDiff * easeProgress);
            this.drawWheel();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.onSpinComplete(winner);
            }
        };

        requestAnimationFrame(animate);
    }

    onSpinComplete(winner) {
        this.isSpinning = false;

        // Update stats
        this.stats.totalSpins++;
        this.stats.results[winner] = (this.stats.results[winner] || 0) + 1;
        this.saveStats();

        // Show winner
        document.getElementById('winnerName').textContent = winner;
        document.getElementById('winnerDisplay').style.display = 'block';

        // Re-enable button
        const spinBtn = document.getElementById('spinButton');
        spinBtn.disabled = false;
        spinBtn.classList.remove('spinning');
        spinBtn.innerHTML = '<i class="fas fa-play"></i> QUAY';

        // Update stats display
        this.renderStats();

        // Show notification
        expenseManager.showNotification(`Người trúng: ${winner}!`, 'success');
    }

    renderStats() {
        const container = document.getElementById('spinStatsTable');
        const totalSpan = document.getElementById('totalSpinsCount');

        if (!container) return;

        totalSpan.textContent = this.stats.totalSpins;

        const results = this.stats.results;
        const entries = Object.entries(results).sort((a, b) => b[1] - a[1]);

        if (entries.length === 0) {
            container.innerHTML = '<div class="spin-stats-empty">Chưa có dữ liệu</div>';
            return;
        }

        container.innerHTML = entries.map(([name, count], index) => {
            const percent = this.stats.totalSpins > 0
                ? ((count / this.stats.totalSpins) * 100).toFixed(1)
                : 0;

            let rankClass = '';
            let rankSymbol = index + 1;

            if (index === 0) {
                rankClass = 'first';
                rankSymbol = '🥇';
            } else if (index === 1) {
                rankClass = 'second';
                rankSymbol = '🥈';
            } else if (index === 2) {
                rankClass = 'third';
                rankSymbol = '🥉';
            }

            return `
                <div class="spin-stat-row ${rankClass}">
                    <span class="spin-stat-rank">${rankSymbol}</span>
                    <span class="spin-stat-name">${name}</span>
                    <span class="spin-stat-count">${count} lần</span>
                    <span class="spin-stat-percent">${percent}%</span>
                </div>
            `;
        }).join('');
    }
}

// Create spin wheel manager instance
const spinWheelManager = new SpinWheelManager();

// Spin wheel functions
function showSpinWheel() {
    spinWheelManager.initParticipants();
    spinWheelManager.drawWheel();
    spinWheelManager.renderStats();
    document.getElementById('spinWheelModal').style.display = 'block';
}

function closeSpinWheel() {
    document.getElementById('spinWheelModal').style.display = 'none';
}

function addSpinParticipant() {
    const input = document.getElementById('newParticipantName');
    spinWheelManager.addParticipant(input.value);
}

function selectAllSpinParticipants() {
    spinWheelManager.selectAll();
}

function deselectAllSpinParticipants() {
    spinWheelManager.deselectAll();
}

function spinTheWheel() {
    spinWheelManager.spin();
}

function clearSpinStats() {
    if (confirm('Bạn có chắc chắn muốn xóa thống kê?')) {
        spinWheelManager.clearStats();
    }
}

// Handle enter key on participant input
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('newParticipantName');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSpinParticipant();
            }
        });
    }
});