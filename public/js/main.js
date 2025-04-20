document.addEventListener('DOMContentLoaded', () => {
    // Определяем режим работы (dev или production)
    const isDevelopment = window.location.hostname === '127.0.0.1' || 
                          window.location.hostname === 'localhost';
    
    // API базовый URL - указываем адрес нашего сервера Express
    const API_BASE_URL = isDevelopment ? 'http://localhost:3000' : '';
    
    // Для дебага выводим режим и URL
    console.log(`Режим: ${isDevelopment ? 'Development' : 'Production'}, API URL: ${API_BASE_URL}`);
    
    // UI элементы
    const orderForm = document.getElementById('orderForm');
    const authButtons = document.getElementById('authButtons');
    const userProfile = document.getElementById('userProfile');
    const userNameEl = document.getElementById('userName');
    const authPages = document.getElementById('authPages');
    const loginPage = document.getElementById('loginPage');
    const registerPage = document.getElementById('registerPage');
    const profilePage = document.getElementById('profilePage');
    const adminPage = document.getElementById('adminPage');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const showRegisterPageBtn = document.getElementById('showRegisterPage');
    const showLoginPageBtn = document.getElementById('showLoginPage');
    const profileBtn = document.getElementById('profileBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const userOrdersContainer = document.getElementById('userOrders');
    const adminOrdersList = document.getElementById('adminOrdersList');
    const adminUsersList = document.getElementById('adminUsersList');
    const footer = document.querySelector('footer');
    
    // Состояние приложения
    let currentUser = null;
    let isMainPageVisible = true;
    
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

    // Функции для переключения между страницами
    function showMainPage() {
        document.querySelectorAll('section').forEach(section => {
            section.style.display = '';
        });
        footer.style.display = '';
        authPages.style.display = 'none';
        profilePage.style.display = 'none';
        adminPage.style.display = 'none';
        isMainPageVisible = true;
    }
    
    function hideMainPage() {
        document.querySelectorAll('section').forEach(section => {
            section.style.display = 'none';
        });
        footer.style.display = 'none';
        isMainPageVisible = false;
    }
    
    function showPage(page) {
        hideMainPage();
        authPages.style.display = 'none';
        profilePage.style.display = 'none';
        adminPage.style.display = 'none';
        page.style.display = '';
    }
    
    // Обработчики событий для навигации
    loginBtn.addEventListener('click', () => {
        showPage(loginPage);
        loginPage.style.display = '';
        registerPage.style.display = 'none';
        authPages.style.display = '';
    });
    
    registerBtn.addEventListener('click', () => {
        showPage(registerPage);
        loginPage.style.display = 'none';
        registerPage.style.display = '';
        authPages.style.display = '';
    });
    
    showRegisterPageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginPage.style.display = 'none';
        registerPage.style.display = '';
    });
    
    showLoginPageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerPage.style.display = 'none';
        loginPage.style.display = '';
    });
    
    profileBtn.addEventListener('click', () => {
        window.location.href = 'profile.html';
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
                // Заполняем профиль пользователя
                if (document.getElementById('profileName')) {
                    document.getElementById('profileName').textContent = currentUser.name;
                    document.getElementById('profileEmail').textContent = currentUser.email;
                }
            }
            
            updateUIForAuthUser();
            
            if (currentUser && currentUser.role === 'ADMIN') {
                console.log('Пользователь имеет права администратора');
                // Для admin кнопки добавляем обработчик события
                const adminBtn = userProfile.querySelector('.user-profile__dropdown div[data-admin] button');
                if (adminBtn) {
                    // Очищаем старые обработчики
                    adminBtn.replaceWith(adminBtn.cloneNode(true));
                    // Добавляем новый обработчик
                    const newAdminBtn = userProfile.querySelector('.user-profile__dropdown div[data-admin] button');
                    newAdminBtn.addEventListener('click', () => {
                        console.log('Переход в панель администратора');
                        showPage(adminPage);
                        loadAdminData();
                    });
                }
            }
        } catch (error) {
            // Если ошибка 401, это нормально при первой загрузке - просто обрабатываем тихо
            if (!error.message.includes('401')) {
                console.error('Ошибка при проверке аутентификации:', error);
            } else {
                console.log('Пользователь не авторизован (401)');
            }
            currentUser = null;
            updateUIForNonAuthUser();
        }
    }
    
    // Обновление UI в зависимости от статуса аутентификации
    function updateUIForAuthUser() {
        authButtons.style.display = 'none';
        userProfile.style.display = 'block';
        userNameEl.textContent = currentUser.name;
        
        // Если пользователь админ, показываем ссылку на админ-панель
        if (currentUser.role === 'ADMIN') {
            const adminBtn = document.createElement('button');
            adminBtn.className = 'user-profile__button';
            adminBtn.textContent = 'Админ-панель';
            adminBtn.addEventListener('click', () => {
                showPage(adminPage);
                loadAdminData();
            });
            
            if (!userProfile.querySelector('.user-profile__dropdown button[data-admin]')) {
                const adminBtnContainer = document.createElement('div');
                adminBtnContainer.setAttribute('data-admin', 'true');
                adminBtnContainer.appendChild(adminBtn);
                
                const dropdown = userProfile.querySelector('.user-profile__dropdown');
                dropdown.insertBefore(adminBtnContainer, dropdown.firstChild);
            }
        }
    }
    
    function updateUIForNonAuthUser() {
        authButtons.style.display = 'flex';
        userProfile.style.display = 'none';
        
        // Удаляем админ-кнопку, если она есть
        const adminBtn = userProfile.querySelector('.user-profile__dropdown div[data-admin]');
        if (adminBtn) {
            adminBtn.remove();
        }
    }
    
    // Функции для работы с API
    async function login(credentials) {
        try {
            console.log('Попытка входа с данными:', credentials.email);
            const data = await safeJsonFetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });
            
            console.log('Ответ сервера при входе:', data);
            
            // Сохраняем токен в localStorage
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                console.log('Токен сохранен в localStorage');
            }
            
            // Проверяем наличие токена в куки
            setTimeout(() => {
                console.log('Проверка наличия токена в куки...');
                console.log('Текущие куки:', document.cookie);
            }, 500);
            
            currentUser = data.user;
            showNotification('Вы успешно вошли в систему');
            updateUIForAuthUser();
            showMainPage();
            
            // Вместо перезагрузки сразу вызываем проверку авторизации
            checkAuth();
            
            return true;
        } catch (error) {
            showNotification(error.message, true);
            return false;
        }
    }
    
    async function register(userData) {
        try {
            const data = await safeJsonFetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            // Сохраняем токен в localStorage
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                console.log('Токен сохранен в localStorage после регистрации');
            }
            
            currentUser = data.user;
            showNotification('Вы успешно зарегистрировались');
            updateUIForAuthUser();
            showMainPage();
            return true;
        } catch (error) {
            showNotification(error.message, true);
            return false;
        }
    }
    
    async function logout() {
        try {
            await safeJsonFetch('/api/logout', { method: 'POST' });
            
            currentUser = null;
            showNotification('Вы вышли из системы');
            updateUIForNonAuthUser();
            showMainPage();
        } catch (error) {
            showNotification(error.message, true);
        }
    }
    
    // Загрузка заказов пользователя
    async function loadUserOrders() {
        if (!currentUser) return;
        
        try {
            const data = await safeJsonFetch('/api/orders');
            renderUserOrders(data.orders || []);
        } catch (error) {
            showNotification(error.message, true);
        }
    }
    
    // Рендер заказов пользователя
    function renderUserOrders(orders) {
        if (!orders || orders.length === 0) {
            userOrdersContainer.innerHTML = '<p class="orders-list__empty">У вас пока нет заказов</p>';
            return;
        }
        
        userOrdersContainer.innerHTML = '';
        
        orders.forEach(order => {
            const orderDate = new Date(order.createdAt).toLocaleDateString();
            
            const orderEl = document.createElement('div');
            orderEl.className = 'order-item';
            
            let statusClass = '';
            let statusText = '';
            
            switch (order.status) {
                case 'PENDING':
                    statusClass = 'order-item__status--pending';
                    statusText = 'Новый';
                    break;
                case 'PROCESSING':
                    statusClass = 'order-item__status--processing';
                    statusText = 'В обработке';
                    break;
                case 'COMPLETED':
                    statusClass = 'order-item__status--completed';
                    statusText = 'Выполнен';
                    break;
                case 'CANCELLED':
                    statusClass = 'order-item__status--cancelled';
                    statusText = 'Отменен';
                    break;
                default:
                    statusClass = 'order-item__status--pending';
                    statusText = 'Новый';
            }
            
            orderEl.innerHTML = `
                <div class="order-item__header">
                    <span class="order-item__id">Заказ #${order.id}</span>
                    <span class="order-item__date">${orderDate}</span>
                </div>
                <div class="order-item__details">
                    <p><strong>Количество:</strong> ${order.amount} кг</p>
                    <p><strong>Описание:</strong> ${order.description || 'Не указано'}</p>
                    <p><strong>Статус:</strong> <span class="order-item__status ${statusClass}">${statusText}</span></p>
                </div>
            `;
            
            userOrdersContainer.appendChild(orderEl);
        });
    }
    
    // Функции для админ-панели
    async function loadAdminData() {
        if (!currentUser || currentUser.role !== 'ADMIN') {
            console.log('Доступ запрещен: нет прав администратора');
            showNotification('У вас нет прав для доступа к панели администратора', true);
            showMainPage();
            return;
        }
        
        const tabBtns = adminPage.querySelectorAll('.admin-tabs__btn');
        const tabs = adminPage.querySelectorAll('.admin-tab');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                
                tabBtns.forEach(b => b.classList.remove('active'));
                tabs.forEach(t => t.style.display = 'none');
                
                btn.classList.add('active');
                adminPage.querySelector(`#${tabId}Tab`).style.display = '';
                
                if (tabId === 'orders') {
                    loadAdminOrders();
                } else if (tabId === 'users') {
                    loadAdminUsers();
                }
            });
        });
        
        // Загружаем заказы при первой загрузке
        loadAdminOrders();
    }
    
    async function loadAdminOrders() {
        try {
            if (!currentUser || currentUser.role !== 'ADMIN') {
                console.log('Доступ запрещен: нет прав администратора');
                return;
            }
            
            const data = await safeJsonFetch('/api/admin/orders');
            renderAdminOrders(data.orders || []);
        } catch (error) {
            console.error('Ошибка при загрузке заказов:', error);
            showNotification('Не удалось загрузить заказы', true);
        }
    }
    
    async function loadAdminUsers() {
        try {
            if (!currentUser || currentUser.role !== 'ADMIN') {
                console.log('Доступ запрещен: нет прав администратора');
                return;
            }
            
            const data = await safeJsonFetch('/api/admin/users');
            renderAdminUsers(data.users || []);
        } catch (error) {
            console.error('Ошибка при загрузке пользователей:', error);
            showNotification('Не удалось загрузить пользователей', true);
        }
    }
    
    function renderAdminOrders(orders) {
        if (!orders || orders.length === 0) {
            adminOrdersList.innerHTML = '<tr><td colspan="8" style="text-align: center;">Нет заказов</td></tr>';
            return;
        }
        
        adminOrdersList.innerHTML = '';
        
        orders.forEach(order => {
            const row = document.createElement('tr');
            const createdAt = new Date(order.createdAt).toLocaleDateString();
            
            let statusText = '';
            switch (order.status) {
                case 'PENDING':
                    statusText = 'Новый';
                    break;
                case 'PROCESSING':
                    statusText = 'В обработке';
                    break;
                case 'COMPLETED':
                    statusText = 'Выполнен';
                    break;
                case 'CANCELLED':
                    statusText = 'Отменен';
                    break;
                default:
                    statusText = 'Новый';
            }
            
            // Получаем имя клиента: из связанного пользователя, если есть, или из поля customerName
            const customerName = order.user ? order.user.name : (order.customerName || 'Не указано');
            // Получаем телефон из поля customerPhone
            const customerPhone = order.customerPhone || 'Не указан';
            // Получаем email: из связанного пользователя, если есть, или из поля customerEmail
            const customerEmail = order.user ? order.user.email : (order.customerEmail || 'Не указано');
            
            row.innerHTML = `
                <td>${order.id}</td>
                <td>${createdAt}</td>
                <td>${customerName}</td>
                <td>${customerPhone}</td>
                <td>${customerEmail}</td>
                <td>${order.amount} кг</td>
                <td>${statusText}</td>
                <td>
                    <button class="action-btn action-btn--edit" data-id="${order.id}">Изменить</button>
                    <button class="action-btn action-btn--status" data-id="${order.id}">Статус</button>
                </td>
            `;
            
            adminOrdersList.appendChild(row);
        });
        
        // Обработчики событий для кнопок действий
        adminOrdersList.querySelectorAll('.action-btn--edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const orderId = btn.getAttribute('data-id');
                // TODO: Реализовать редактирование заказа
                showNotification('Редактирование заказа #' + orderId);
            });
        });
        
        adminOrdersList.querySelectorAll('.action-btn--status').forEach(btn => {
            btn.addEventListener('click', () => {
                const orderId = btn.getAttribute('data-id');
                showStatusChangeForm(orderId);
            });
        });
    }
    
    function renderAdminUsers(users) {
        if (!users || users.length === 0) {
            adminUsersList.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет пользователей</td></tr>';
            return;
        }
        
        adminUsersList.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            const createdAt = new Date(user.createdAt).toLocaleDateString();
            
            // Получаем количество заказов пользователя
            const orderCount = user.orderCount || (user._count && user._count.orders) || 0;
            
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${createdAt}</td>
                <td>${orderCount}</td>
                <td>
                    <button class="action-btn action-btn--edit" data-id="${user.id}">Изменить</button>
                </td>
            `;
            
            adminUsersList.appendChild(row);
        });
        
        // Обработчики событий для кнопок действий
        adminUsersList.querySelectorAll('.action-btn--edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.getAttribute('data-id');
                // TODO: Реализовать редактирование пользователя
                showNotification('Редактирование пользователя #' + userId);
            });
        });
    }
    
    function showStatusChangeForm(orderId) {
        // Создаем модальное окно для изменения статуса
        const statusModal = document.createElement('div');
        statusModal.className = 'modal active';
        statusModal.innerHTML = `
            <div class="modal__content">
                <h3 class="modal__title">Изменить статус заказа #${orderId}</h3>
                <form id="statusForm">
                    <div class="form__group">
                        <label class="form__label">Статус:</label>
                        <select class="form__input" id="orderStatus">
                            <option value="PENDING">Новый</option>
                            <option value="PROCESSING">В обработке</option>
                            <option value="COMPLETED">Выполнен</option>
                            <option value="CANCELLED">Отменен</option>
                        </select>
                    </div>
                    <div class="form__actions">
                        <button type="submit" class="button">Сохранить</button>
                        <button type="button" class="button button--secondary" id="cancelStatus">Отмена</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(statusModal);
        
        // Обработчик отмены
        statusModal.querySelector('#cancelStatus').addEventListener('click', () => {
            statusModal.remove();
        });
        
        // Обработчик формы
        statusModal.querySelector('#statusForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const status = statusModal.querySelector('#orderStatus').value;
            
            try {
                await safeJsonFetch(`/api/admin/orders/${orderId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status })
                });
                
                showNotification('Статус заказа успешно изменен');
                loadAdminOrders();
            } catch (error) {
                showNotification(error.message, true);
            } finally {
                statusModal.remove();
            }
        });
    }
    
    // Валидация телефона
    function validatePhone(phone) {
        const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
        return phoneRegex.test(phone);
    }

    // Обработка отправки формы заказа
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(orderForm);
        const data = Object.fromEntries(formData.entries());
        
        console.log('Данные формы перед отправкой:', data);

        // Валидация данных
        if (!validatePhone(data.phone)) {
            showNotification('Пожалуйста, введите корректный номер телефона', true);
            return;
        }

        try {
            // Убедимся, что все поля правильно названы в соответствии с серверными ожиданиями
            const orderData = {
                name: data.name,
                phone: data.phone,
                email: data.email,
                amount: data.amount,
                details: data.details || '' // Убедимся, что details существует
            };
            
            // Если пользователь авторизован, используем его данные
            if (currentUser) {
                orderData.name = currentUser.name;
                orderData.email = currentUser.email;
            }
            
            console.log('Отправляемые данные:', orderData);
            
            const response = await safeJsonFetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData),
                credentials: 'include' // Важно: включаем куки в запрос
            });
            
            showNotification('Заявка успешно отправлена! Мы свяжемся с вами в ближайшее время.');
            orderForm.reset();
            
            // Если пользователь авторизован и находится в профиле, обновляем список заказов
            if (currentUser && window.location.pathname.includes('profile.html')) {
                loadUserOrders();
            }
            
            // Предлагаем перейти в личный кабинет для просмотра заказа
            if (currentUser) {
                setTimeout(() => {
                    if (confirm('Хотите перейти в личный кабинет для просмотра заказа?')) {
                        window.location.href = 'profile.html';
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Ошибка при отправке заявки:', error);
            showNotification(error.message, true);
        }
    });
    
    // Обработка отправки формы входа
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(loginForm);
        const credentials = Object.fromEntries(formData.entries());
        
        try {
            await login(credentials);
        } catch (error) {
            console.error('Ошибка при входе:', error);
            // Показываем уведомление даже если login() обработал ошибку внутри
            showNotification('Не удалось войти в систему. Проверьте данные и попробуйте снова.', true);
        }
    });
    
    // Обработка отправки формы регистрации
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(registerForm);
        const userData = Object.fromEntries(formData.entries());
        
        if (userData.password !== userData.passwordConfirm) {
            showNotification('Пароли не совпадают', true);
            return;
        }
        
        delete userData.passwordConfirm;
        
        try {
            await register(userData);
        } catch (error) {
            console.error('Ошибка при регистрации:', error);
            // Показываем уведомление даже если register() обработал ошибку внутри
            showNotification('Не удалось зарегистрироваться. Проверьте данные и попробуйте снова.', true);
        }
    });
    
    // Обработка выхода из системы
    logoutBtn.addEventListener('click', logout);

    // Маска для телефона
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D+/g, '');
        if (value.length > 0) {
            if (value[0] === '7' || value[0] === '8') {
                value = value.substring(1);
            }
            if (value.length > 10) {
                value = value.substring(0, 10);
            }
            const parts = [];
            parts.push('+7');
            if (value.length > 0) {
                parts.push(' (' + value.substring(0, 3));
            }
            if (value.length > 3) {
                parts.push(') ' + value.substring(3, 6));
            }
            if (value.length > 6) {
                parts.push('-' + value.substring(6, 8));
            }
            if (value.length > 8) {
                parts.push('-' + value.substring(8, 10));
            }
            e.target.value = parts.join('');
        }
    });
    
    // Функция для безопасного запроса и парсинга JSON
    async function safeJsonFetch(url, options = {}) {
        try {
            // Добавим отладочную информацию
            console.log(`API запрос: ${url}`);
            
            // Устанавливаем передачу учетных данных для всех запросов
            if (!options.credentials) {
                options.credentials = 'include';
            }
            
            // Добавляем токен в заголовок, если он есть в куках или localStorage
            const cookies = document.cookie.split(';');
            let token = null;
            
            // Сначала ищем в куках
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'token') {
                    token = value;
                    console.log('Токен найден в куках');
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
            if (token && !options.headers?.Authorization) {
                if (!options.headers) {
                    options.headers = {};
                }
                options.headers.Authorization = `Bearer ${token}`;
                console.log('Добавлен токен в заголовки запроса');
            }
            
            // Добавляем базовый URL к запросу
            const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
            console.log(`Полный URL запроса: ${fullUrl}`);
            
            if (options.body) {
                console.log('Тело запроса:', typeof options.body === 'string' ? JSON.parse(options.body) : options.body);
            }
            
            const response = await fetch(fullUrl, options);
            
            if (!response.ok) {
                console.error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
                
                // Получаем текст ответа для более подробной диагностики
                const errorText = await response.text();
                console.error('Ответ сервера при ошибке:', errorText);
                
                let errorMessage = `Ошибка сервера (${response.status})`;
                
                // Пытаемся распарсить JSON ответ, если возможно
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    // Не удалось распарсить ответ как JSON, используем текст как есть
                    if (errorText) {
                        errorMessage = errorText;
                    }
                }
                
                // Если ошибка 401 при запросе, кроме /api/me, показываем предупреждение
                if (response.status === 401 && url !== '/api/me') {
                    showNotification('Проблема с авторизацией. Возможно, вам нужно войти снова.', true);
                }
                
                throw new Error(errorMessage);
            }
            
            const text = await response.text();
            
            if (!text) {
                return { success: true };
            }
            
            try {
                const data = JSON.parse(text);
                console.log('Ответ сервера:', data);
                return data;
            } catch (parseError) {
                console.error('Ошибка при парсинге JSON:', parseError, text);
                throw new Error('Некорректный формат ответа от сервера');
            }
        } catch (error) {
            // Выводим ошибки в консоль только если это не 401 при первичной проверке авторизации
            if (!(url === '/api/me' && error.message.includes('401'))) {
                console.error('Ошибка при запросе:', error);
            }
            throw error;
        }
    }
    
    // Инициализация
    checkAuth();
}); 