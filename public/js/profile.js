document.addEventListener('DOMContentLoaded', () => {
    // Определяем режим работы (dev или production)
    const isDevelopment = window.location.hostname === '127.0.0.1' || 
                          window.location.hostname === 'localhost';
    
    // API базовый URL - указываем адрес нашего сервера Express
    const API_BASE_URL = isDevelopment ? 'http://localhost:3000' : '';
    
    // Для дебага выводим режим и URL
    console.log(`Режим: ${isDevelopment ? 'Development' : 'Production'}, API URL: ${API_BASE_URL}`);
    
    // UI элементы
    const userProfile = document.getElementById('userProfile');
    const userNameEl = document.getElementById('userName');
    const profileBtn = document.getElementById('profileBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const userOrdersContainer = document.getElementById('userOrders');
    const adminButtonContainer = document.getElementById('adminButtonContainer');
    const adminBtn = document.getElementById('adminBtn');
    
    // Состояние приложения
    let currentUser = null;
    
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
                // Заполняем профиль пользователя
                userNameEl.textContent = currentUser.name;
                profileName.textContent = currentUser.name;
                profileEmail.textContent = currentUser.email;
                
                // Показываем кнопку админ-панели, если пользователь - администратор
                if (currentUser.role === 'ADMIN' && adminButtonContainer) {
                    adminButtonContainer.style.display = 'block';
                }
                
                // Загружаем заказы пользователя
                loadUserOrders();
            } else {
                // Если пользователь не авторизован, перенаправляем на главную
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Ошибка при проверке аутентификации:', error);
            // Перенаправляем на главную, так как пользователь не авторизован
            window.location.href = '/';
        }
    }
    
    // Добавляем обработчик для кнопки перехода в админ-панель
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            window.location.href = 'admin.html';
        });
    }
    
    // Загрузка заказов пользователя
    async function loadUserOrders() {
        if (!currentUser) return;
        
        try {
            console.log('Загружаем заказы для пользователя:', currentUser.id, currentUser.email);
            const data = await safeJsonFetch('/api/orders');
            console.log('Получены заказы:', data.orders ? data.orders.length : 0);
            
            if (data.orders && data.orders.length > 0) {
                console.log('Пример данных заказа:', data.orders[0]);
            } else {
                console.log('Заказы отсутствуют');
            }
            
            renderUserOrders(data.orders || []);
        } catch (error) {
            console.error('Ошибка при загрузке заказов:', error);
            showNotification('Не удалось загрузить заказы: ' + error.message, true);
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
    
    async function logout() {
        try {
            await safeJsonFetch('/api/logout', { method: 'POST' });
            
            // Очищаем токен из localStorage
            localStorage.removeItem('authToken');
            console.log('Токен удален из localStorage');
            
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
                
                // Если ошибка 401 при запросе, кроме /api/me, показываем предупреждение
                if (response.status === 401 && url !== '/api/me') {
                    showNotification('Проблема с авторизацией. Возможно, вам нужно войти снова.', true);
                }
                
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
            // Выводим ошибки в консоль только если это не 401 при первичной проверке авторизации
            if (!(url === '/api/me' && error.message.includes('401'))) {
                console.error('Ошибка при запросе:', error);
            }
            throw error;
        }
    }
    
    // Инициализация приложения
    checkAuth();
    
    // Обработчики событий
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }
}); 