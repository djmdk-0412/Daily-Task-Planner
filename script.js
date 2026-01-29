document.addEventListener('DOMContentLoaded', () => {
    // Data Store
    let data = JSON.parse(localStorage.getItem('plannerData')) || {
        lists: [
            { id: 'today', name: 'Today', type: 'system' },
            { id: 'expenditures', name: 'Expenditures', type: 'custom' },
            { id: 'work', name: 'Work', type: 'custom' }
        ],
        tasks: [], // Tasks now have optional 'date' property (YYYY-MM-DD)
    };

    // State
    let state = {
        view: 'tasks', // 'tasks' or 'calendar'
        context: 'list', // 'list' or 'date'
        targetId: 'today', // listId (e.g. 'work') or dateString (e.g. '2026-01-25')
        currentDate: new Date() // For Calendar navigation
    };

    // DOM Elements
    const views = {
        tasks: document.getElementById('tasks-view'),
        calendar: document.getElementById('calendar-view')
    };
    const customListsNav = document.getElementById('custom-lists-nav');
    const taskList = document.getElementById('task-list');
    const listTitle = document.getElementById('list-title');
    const listSubtitle = document.getElementById('current-date');
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const prioritySelect = document.getElementById('priority-select');
    const deleteListBtn = document.getElementById('delete-list-btn');

    // Calendar DOM
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearDisplay = document.getElementById('calendar-month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // Modals
    const newListModal = document.getElementById('new-list-modal');
    const addListBtn = document.getElementById('add-list-btn');
    const confirmListBtn = document.getElementById('confirm-list-btn');
    const cancelListBtn = document.getElementById('cancel-list-btn');
    const newListInput = document.getElementById('new-list-name');

    // Initialization
    renderSidebar();
    switchToContext('list', 'today'); // Default view

    // --- NAVIGATION & CONTEXT ---

    function switchToContext(context, targetId) {
        state.context = context;
        state.targetId = targetId;

        // Update UI
        switchView('tasks');
        updateHeaderUI();
        renderTasks();
        renderSidebar(); // Update active state
    }

    function switchView(viewName) {
        state.view = viewName;
        Object.values(views).forEach(v => v.classList.remove('active'));
        views[viewName].classList.add('active');

        if (viewName === 'calendar') {
            renderCalendar();
            updateSidebarActiveState('calendar');
        } else {
            updateSidebarActiveState(state.targetId);
        }
    }

    function updateHeaderUI() {
        if (state.context === 'list') {
            const list = data.lists.find(l => l.id === state.targetId);
            listTitle.textContent = list ? list.name : 'Unknown List';

            // Subtitle
            if (state.targetId === 'today') {
                listSubtitle.textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
            } else {
                listSubtitle.textContent = 'Custom List';
            }

            deleteListBtn.classList.toggle('hidden', !list || list.type === 'system');

        } else if (state.context === 'date') {
            // TargetId is a date string 'YYYY-MM-DD'
            // We use specific parsing to avoid UTC->Local conversion issues on just dates
            const [y, m, d] = state.targetId.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);

            listTitle.textContent = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            listSubtitle.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            deleteListBtn.classList.add('hidden');
        }
    }

    function renderSidebar() {
        customListsNav.innerHTML = '';
        data.lists.filter(l => l.type === 'custom').forEach(list => {
            const li = document.createElement('li');
            li.className = `nav-item ${state.context === 'list' && state.targetId === list.id ? 'active' : ''}`;
            li.innerHTML = `<span class="icon">📝</span> ${list.name}`;
            li.dataset.id = list.id;
            li.onclick = () => switchToContext('list', list.id);
            customListsNav.appendChild(li);
        });

        // Static Items
        const todayNav = document.querySelector('[data-list-id="today"]');
        if (todayNav) {
            todayNav.onclick = () => switchToContext('list', 'today');
        }

        // Calendar Nav
        const calendarNav = document.querySelector('[data-view="calendar"]');
        if (calendarNav) {
            calendarNav.onclick = () => switchView('calendar');
        }
    }

    function updateSidebarActiveState(activeId) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        if (activeId === 'calendar') {
            document.querySelector('[data-view="calendar"]').classList.add('active');
        } else if (state.context === 'list') {
            const el = document.querySelector(`[data-list-id="${activeId}"]`) ||
                Array.from(customListsNav.children).find(child => child.dataset.id === activeId);
            if (el) el.classList.add('active');
        }
        // No sidebar highlight for specific dates (optional design choice)
    }

    // --- TASKS LOGIC ---

    function getTodayString() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function addTask(e) {
        e.preventDefault();
        const text = taskInput.value.trim();
        if (!text) return;

        const newTask = {
            id: Date.now(),
            text: text,
            priority: prioritySelect.value,
            completed: false
        };

        // Assign context-specific properties
        if (state.context === 'list') {
            newTask.listId = state.targetId;
            // If adding to 'Today' list, technically it implies today's date, 
            // but we keep it simple as a list unless user wants strict date mode.
            if (state.targetId === 'today') {
                newTask.date = getTodayString();
            }
        } else if (state.context === 'date') {
            newTask.date = state.targetId; // Assign the specific date
            // Optional: could also assign to a default list if needed, or leave listId undefined
        }

        data.tasks.unshift(newTask);
        saveData();
        renderTasks();
        taskInput.value = '';
    }

    function renderTasks() {
        taskList.innerHTML = '';
        let filteredTasks = [];

        if (state.context === 'list') {
            if (state.targetId === 'today') {
                // Show tasks specifically in 'today' list OR tasks with today's date
                const todayStr = getTodayString();
                filteredTasks = data.tasks.filter(t => t.listId === 'today' || t.date === todayStr);
            } else {
                filteredTasks = data.tasks.filter(t => t.listId === state.targetId);
            }
        } else if (state.context === 'date') {
            filteredTasks = data.tasks.filter(t => t.date === state.targetId);
        }

        const emptyState = document.getElementById('empty-state');

        if (filteredTasks.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            filteredTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';
                li.innerHTML = `
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <div style="flex:1">
                        <div class="task-text ${task.completed ? 'completed' : ''}">${task.text}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary)">
                            ${task.priority.toUpperCase()} 
                            ${task.listId && task.listId !== 'today' ? `• ${data.lists.find(l => l.id === task.listId)?.name || ''}` : ''}
                        </div>
                    </div>
                    <button class="icon-btn delete-task">×</button>
                `;

                li.querySelector('.task-checkbox').addEventListener('change', () => {
                    task.completed = !task.completed;
                    saveData();
                    renderTasks(); // Re-render to show strikethrough logic (handled in CSS better but nice to refresh)
                    li.querySelector('.task-text').classList.toggle('completed', task.completed);
                });

                li.querySelector('.delete-task').addEventListener('click', () => {
                    data.tasks = data.tasks.filter(t => t.id !== task.id);
                    saveData();
                    renderTasks();
                });

                taskList.appendChild(li);
            });
        }
    }

    // --- CALENDAR LOGIC ---

    function renderCalendar() {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();

        monthYearDisplay.textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        calendarGrid.innerHTML = '';

        // Empty cells
        for (let i = 0; i < firstDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            cell.style.background = 'transparent';
            cell.style.cursor = 'default';
            calendarGrid.appendChild(cell);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            // Check if today
            const todayStr = getTodayString();
            if (dateStr === todayStr) cell.classList.add('today-cell');

            // Render Date number
            let html = `<div class="day-number">${i}</div>`;

            // Render Task Dots (Preview)
            const dayTasks = data.tasks.filter(t => t.date === dateStr);
            if (dayTasks.length > 0) {
                html += `<div style="display:flex; gap:2px; flex-wrap:wrap;">`;
                dayTasks.slice(0, 4).forEach(() => {
                    html += `<div style="width:4px; height:4px; border-radius:50%; background:var(--accent);"></div>`;
                });
                html += `</div>`;
            }

            cell.innerHTML = html;

            // Click -> Switch to Day View
            cell.addEventListener('click', () => switchToContext('date', dateStr));

            calendarGrid.appendChild(cell);
        }
    }

    prevMonthBtn.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        renderCalendar();
    });

    // --- LIST MANAGEMENT (Modals) ---

    addListBtn.addEventListener('click', () => newListModal.showModal());
    cancelListBtn.addEventListener('click', () => newListModal.close());

    confirmListBtn.addEventListener('click', (e) => {
        const name = newListInput.value.trim();
        if (name) {
            const newList = {
                id: name.toLowerCase().replace(/\s+/g, '-'),
                name: name,
                type: 'custom'
            };
            data.lists.push(newList);
            saveData();
            switchToContext('list', newList.id);
            newListInput.value = '';
            newListModal.close();
        }
    });

    deleteListBtn.addEventListener('click', () => {
        if (confirm(`Delete list "${listTitle.textContent}" and all its tasks?`)) {
            data.lists = data.lists.filter(l => l.id !== state.targetId);
            data.tasks = data.tasks.filter(t => t.listId !== state.targetId);
            saveData();
            switchToContext('list', 'today');
        }
    });

    // --- UTILS ---

    function saveData() {
        localStorage.setItem('plannerData', JSON.stringify(data));
    }

    // Initial Form Listener
    taskForm.addEventListener('submit', addTask);
});
