document.addEventListener('DOMContentLoaded', () => {
    // Определяем режим работы (dev или production)
    const isDevelopment = window.location.hostname === '127.0.0.1' || 
                          window.location.hostname === 'localhost';
    
    // API базовый URL - указываем адрес нашего сервера Express
    const API_BASE_URL = isDevelopment ? 'http://localhost:3000' : '';
    
    // Для дебага выводим режим и URL
    console.log(`Режим: ${isDevelopment ? 'Development' : 'Production'}, API URL: ${API_BASE_URL}`);
    
    // UI элементы
    const userNameEl = document.getElementById('userName');
    const profileBtn = document.getElementById('profileBtn');
    const adminBtn = document.getElementById('adminBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminOrdersList = document.getElementById('adminOrdersList');
    const adminUsersList = document.getElementById('adminUsersList');
    const ordersTab = document.getElementById('ordersTab');
    const usersTab = document.getElementById('usersTab');
    
    // Состояние приложения
    let currentUser = null;
    let orders = [];
    let users = [];
    let activeTab = 'orders';
    
    // Создаем модальное окно для уведомлений
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal__content">
            <h3 class="modal__title"></h3>
            <button class="button">OK</button>
        </div>
    `;
    document.body.appendChild(modal);

    // Функция для показа уведомлений
    function showNotification(message, isError = false) {
        const modalTitle = modal.querySelector('.modal__title');
        modalTitle.textContent = message;
        modalTitle.style.color = isError ? '#DC2626' : '#059669';
        modal.classList.add('active');
    }

    // Закрытие модального окна
    modal.querySelector('button').addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    // Функция проверки аутентификации
    async function checkAuth() {
        try {
            console.log('Проверка авторизации...');
            const data = await safeJsonFetch('/api/me');
            console.log('Получены данные пользователя:', data);
            currentUser = data.user;
            
            if (currentUser) {
                console.log(`Пользователь авторизован: ${currentUser.name}, роль: ${currentUser.role}`);
                userNameEl.textContent = currentUser.name;
                
                // Проверяем, является ли пользователь администратором
                if (currentUser.role !== 'ADMIN') {
                    console.warn('Доступ запрещен: пользователь не является администратором');
                    showNotification('У вас нет прав для просмотра этой страницы', true);
                    // Перенаправляем на главную через 2 секунды
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                    return;
                }
                
                // Загружаем данные для админ панели
                loadAdminData();
            } else {
                // Если пользователь не авторизован, перенаправляем на главную
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Ошибка при проверке аутентификации:', error);
            // Перенаправляем на главную, так как пользователь не авторизован
            window.location.href = 'index.html';
        }
    }
    
    // Загрузка данных для админ панели
    async function loadAdminData() {
        try {
            // Загружаем заказы
            const ordersData = await safeJsonFetch('/api/admin/orders');
            orders = ordersData.orders || [];
            console.log('Загружено заказов:', orders.length);
            
            // Загружаем пользователей
            const usersData = await safeJsonFetch('/api/admin/users');
            users = usersData.users || [];
            console.log('Загружено пользователей:', users.length);
            
            // Рендерим данные
            renderOrders();
            renderUsers();
        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            showNotification('Ошибка при загрузке данных: ' + error.message, true);
        }
    }
    
    // Рендер списка заказов
    function renderOrders() {
        if (!adminOrdersList) {
            console.error('Элемент adminOrdersList не найден');
            return;
        }
        
        adminOrdersList.innerHTML = '';
        
        if (!orders || orders.length === 0) {
            adminOrdersList.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">Заказы отсутствуют</td>
                </tr>
            `;
            return;
        }
        
        orders.forEach(order => {
            const orderDate = new Date(order.createdAt).toLocaleDateString();
            const tr = document.createElement('tr');
            
            // Определяем класс статуса
            let statusClass = '';
            let statusText = '';
            
            switch (order.status) {
                case 'PENDING':
                    statusClass = 'status-pending';
                    statusText = 'Новый';
                    break;
                case 'PROCESSING':
                    statusClass = 'status-processing';
                    statusText = 'В обработке';
                    break;
                case 'COMPLETED':
                    statusClass = 'status-completed';
                    statusText = 'Выполнен';
                    break;
                case 'CANCELLED':
                    statusClass = 'status-cancelled';
                    statusText = 'Отменен';
                    break;
                default:
                    statusClass = 'status-pending';
                    statusText = 'Новый';
            }
            
            tr.innerHTML = `
                <td>${order.id}</td>
                <td>${orderDate}</td>
                <td>${order.customerName || (order.user ? order.user.name : 'Анонимный')}</td>
                <td>${order.customerPhone || '-'}</td>
                <td>${order.customerEmail || (order.user ? order.user.email : '-')}</td>
                <td>${order.amount} кг</td>
                <td>
                    <span class="status ${statusClass}">${statusText}</span>
                </td>
                <td>
                    <div class="actions">
                        <button class="btn-edit" data-id="${order.id}">Изменить</button>
                    </div>
                </td>
            `;
            
            adminOrdersList.appendChild(tr);
            
            // Добавляем обработчик для кнопки редактирования
            const editBtn = tr.querySelector('.btn-edit');
            editBtn.addEventListener('click', () => openEditOrderModal(order));
        });
    }
    
    // Рендер списка пользователей
    function renderUsers() {
        if (!adminUsersList) {
            console.error('Элемент adminUsersList не найден');
            return;
        }
        
        adminUsersList.innerHTML = '';
        
        if (!users || users.length === 0) {
            adminUsersList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">Пользователи отсутствуют</td>
                </tr>
            `;
            return;
        }
        
        users.forEach(user => {
            const tr = document.createElement('tr');
            const createdDate = new Date(user.createdAt).toLocaleDateString();
            
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role === 'ADMIN' ? 'Администратор' : 'Пользователь'}</td>
                <td>${createdDate}</td>
                <td>${user.orderCount || 0}</td>
                <td>
                    <div class="actions">
                        <button class="btn-view" data-id="${user.id}">Просмотр</button>
                    </div>
                </td>
            `;
            
            adminUsersList.appendChild(tr);
        });
    }
    
    // Модальное окно для редактирования заказа
    function openEditOrderModal(order) {
        // Создаем модальное окно
        const editModal = document.createElement('div');
        editModal.className = 'modal edit-modal';
        
        // Наполняем содержимым
        editModal.innerHTML = `
            <div class="modal__content">
                <h3 class="modal__title">Редактирование заказа #${order.id}</h3>
                <form id="editOrderForm" class="edit-form">
                    <div class="form-group">
                        <label for="orderStatus">Статус заказа</label>
                        <select id="orderStatus" name="status" class="form-control">
                            <option value="PENDING" ${order.status === 'PENDING' ? 'selected' : ''}>Новый</option>
                            <option value="PROCESSING" ${order.status === 'PROCESSING' ? 'selected' : ''}>В обработке</option>
                            <option value="COMPLETED" ${order.status === 'COMPLETED' ? 'selected' : ''}>Выполнен</option>
                            <option value="CANCELLED" ${order.status === 'CANCELLED' ? 'selected' : ''}>Отменен</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="orderAmount">Количество (кг)</label>
                        <input type="number" id="orderAmount" name="amount" class="form-control" value="${order.amount}" min="1">
                    </div>
                    <div class="form-group">
                        <label for="orderDescription">Описание</label>
                        <textarea id="orderDescription" name="description" class="form-control">${order.description || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="button">Сохранить</button>
                        <button type="button" class="button button--secondary cancel-btn">Отмена</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(editModal);
        editModal.classList.add('active');
        
        // Обработчик отмены
        const cancelBtn = editModal.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', () => {
            editModal.classList.remove('active');
            setTimeout(() => {
                editModal.remove();
            }, 300);
        });
        
        // Обработчик формы
        const editForm = editModal.querySelector('#editOrderForm');
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(editForm);
            const updatedOrder = {
                id: order.id,
                status: formData.get('status'),
                amount: parseInt(formData.get('amount')),
                description: formData.get('description')
            };
            
            try {
                await updateOrder(updatedOrder);
                editModal.classList.remove('active');
                setTimeout(() => {
                    editModal.remove();
                }, 300);
            } catch (error) {
                showNotification(`Ошибка при обновлении заказа: ${error.message}`, true);
            }
        });
    }
    
    // Обновление заказа
    async function updateOrder(orderData) {
        try {
            const response = await safeJsonFetch(`/api/admin/orders/${orderData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            if (response.success) {
                showNotification('Заказ успешно обновлен');
                
                // Обновляем заказ в локальном массиве
                const index = orders.findIndex(order => order.id === orderData.id);
                if (index !== -1) {
                    orders[index] = { ...orders[index], ...orderData };
                }
                
                // Перерисовываем заказы
                renderOrders();
            } else {
                throw new Error(response.message || 'Не удалось обновить заказ');
            }
        } catch (error) {
            console.error('Ошибка при обновлении заказа:', error);
            throw error;
        }
    }
    
    // Функция для переключения табов
    function switchTab(tab) {
        activeTab = tab;
        
        // Находим все кнопки табов и убираем активный класс
        const tabButtons = document.querySelectorAll('.admin-tabs__btn');
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Находим все табы и скрываем/показываем нужные
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tabElement => {
            if (tabElement.id === `${tab}Tab`) {
                tabElement.style.display = 'block';
            } else {
                tabElement.style.display = 'none';
            }
        });
        
        // Обновляем данные в зависимости от выбранного таба
        if (tab === 'orders') {
            renderOrders();
        } else if (tab === 'users') {
            renderUsers();
        }
    }
    
    // Добавляем обработчики для кнопок табов
    document.querySelectorAll('.admin-tabs__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
    
    async function logout() {
        try {
            await safeJsonFetch('/api/logout', { method: 'POST' });
            
            // Очищаем токен из localStorage
            localStorage.removeItem('authToken');
            
            // Выводим информацию о текущих куках после выхода
            console.log('Куки после выхода:', document.cookie);
            
            currentUser = null;
            showNotification('Вы вышли из системы');
            // Перенаправляем на главную после выхода
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            showNotification(error.message, true);
        }
    }
    
    // Функция для безопасного запроса и парсинга JSON
    async function safeJsonFetch(url, options = {}) {
        try {
            // Добавим отладочную информацию
            console.log(`API запрос: ${url}`);
            
            // Устанавливаем передачу учетных данных для всех запросов
            if (!options.credentials) {
                options.credentials = 'include';
            }
            
            // Получаем токен из куки или localStorage
            const cookies = document.cookie.split(';');
            let token = null;
            
            // Сначала проверяем куки
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'token') {
                    token = value;
                    break;
                }
            }
            
            // Если токен не найден в куках, проверяем localStorage
            if (!token) {
                token = localStorage.getItem('authToken');
                if (token) {
                    console.log('Токен найден в localStorage');
                }
            }
            
            // Если токен не найден, но пользователь уже авторизован в нашем состоянии,
            // не сбрасываем currentUser, чтобы избежать автоматического выхода
            if (!token && currentUser && url !== '/api/login' && url !== '/api/register') {
                console.warn('Токен не найден в куках и localStorage, но состояние авторизации сохраняется');
            }
            
            // Добавляем токен в заголовок Authorization
            if (token) {
                if (!options.headers) {
                    options.headers = {};
                }
                options.headers.Authorization = `Bearer ${token}`;
                console.log('Добавлен токен в заголовки запроса');
            }
            
            // Добавляем базовый URL к запросу
            const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
            console.log(`Полный URL запроса: ${fullUrl}`);
            console.log('Параметры запроса:', options);
            
            const response = await fetch(fullUrl, options);
            
            if (!response.ok) {
                console.error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const text = await response.text();
            
            if (!text) {
                return { success: true };
            }
            
            try {
                return JSON.parse(text);
            } catch (parseError) {
                console.error('Ошибка при парсинге JSON:', parseError, text);
                throw new Error('Некорректный формат ответа от сервера');
            }
        } catch (error) {
            console.error('Ошибка при запросе:', error);
            throw error;
        }
    }
    
    // Обработчики для кнопок навигации
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }
    
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Проверяем авторизацию при загрузке страницы
    checkAuth();
}); 