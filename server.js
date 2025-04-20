const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

// Добавляем временный JWT_SECRET если он не указан в переменных окружения
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'sibirsnow_secret_key_for_development';
  console.log('Warning: Using development JWT_SECRET. In production, set a secure JWT_SECRET in .env file.');
}

// Initialize Express app
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middlewares
const corsOptions = {
  origin: function(origin, callback) {
    // Разрешаем запросы из этих источников, а также без origin (например, Postman)
    const allowedOrigins = ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'];
    
    // Разрешаем запросы без origin (например, из Postman) или из разрешенных источников
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS блокировка для:', origin);
      callback(new Error('Не разрешено политикой CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Добавляем логгер запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} [${req.method}] ${req.path} - ${req.ip}`);
  if (req.cookies.token) {
    console.log('  Cookie token present');
  }
  next();
});

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('Запрос отклонён - отсутствует токен');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Токен декодирован успешно, userID:', decoded.id);
    
    // Получаем пользователя из базы данных
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });
    
    if (!user) {
      console.log('Пользователь не найден:', decoded.id);
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    
    console.log(`Пользователь аутентифицирован: ${user.email}, роль: ${user.role}`);
    req.user = user;
    next();
  } catch (error) {
    console.error('Ошибка аутентификации:', error.message);
    res.status(401).json({ message: 'Необходима повторная аутентификация' });
  }
};

// Admin middleware
const isAdmin = (req, res, next) => {
  console.log('Проверка прав администратора для пользователя:', req.user.email);
  console.log('Роль пользователя:', req.user.role);
  
  if (req.user.role !== 'ADMIN') {
    console.log('Отказано в доступе - не администратор');
    return res.status(403).json({ message: 'Доступ запрещен: требуются права администратора' });
  }
  
  console.log('Доступ разрешен - пользователь является администратором');
  next();
};

// AUTH ROUTES
// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user in database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'USER'
      }
    });
    
    // Create token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Настройка cookie для надежного сохранения
    res.cookie('token', token, {
      httpOnly: false,        // Позволяем JavaScript читать токен
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',              // Доступен на всех путях
      sameSite: 'lax',        // Подходит для большинства случаев кросс-доменных запросов
      secure: false           // В разработке не требуем HTTPS
    });
    
    console.log('Токен установлен в куки:', token.substring(0, 20) + '...');
    
    res.status(201).json({ 
      message: 'Регистрация успешна',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: token  // Отправляем токен в ответе для хранения в localStorage
    });
  } catch (error) {
    console.error('Ошибка при регистрации:', error);
    res.status(500).json({ message: 'Ошибка сервера при регистрации' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Неверные учетные данные' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Неверные учетные данные' });
    }
    
    // Create token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Настройка cookie для надежного сохранения
    res.cookie('token', token, {
      httpOnly: false,        // Позволяем JavaScript читать токен
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',              // Доступен на всех путях
      sameSite: 'lax',        // Подходит для большинства случаев кросс-доменных запросов
      secure: false           // В разработке не требуем HTTPS
    });
    
    console.log('Токен установлен в куки:', token.substring(0, 20) + '...');
    
    res.json({ 
      message: 'Вход выполнен успешно',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: token  // Отправляем токен в ответе для хранения в localStorage
    });
  } catch (error) {
    console.error('Ошибка при входе:', error);
    res.status(500).json({ message: 'Ошибка сервера при входе' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Выход выполнен успешно' });
});

// Get current user
app.get('/api/me', auth, (req, res) => {
  res.json({ 
    user: { 
      id: req.user.id, 
      name: req.user.name, 
      email: req.user.email, 
      role: req.user.role 
    } 
  });
});

// USER ORDERS ROUTES
// Get user's orders
app.get('/api/orders', auth, async (req, res) => {
  try {
    // Получаем заказы пользователя из базы данных
    const userOrders = await prisma.order.findMany({
      where: { userId: req.user.id }
    });
    
    res.json({ orders: userOrders });
  } catch (error) {
    console.error('Ошибка при получении заказов:', error);
    res.status(500).json({ message: 'Ошибка при получении заказов' });
  }
});

// Create a new order
app.post('/api/orders', async (req, res) => {
  try {
    const { name, phone, email, amount, details } = req.body;

    console.log('Получен запрос на создание заказа:', {
      name, phone, email, amount, details
    });

    // Проверка данных на наличие
    if (!name || !phone || !email || !amount) {
      console.log('Ошибка валидации: обязательные поля отсутствуют');
      return res.status(400).json({ message: 'Все обязательные поля должны быть заполнены' });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('Ошибка валидации: некорректный email', email);
      return res.status(400).json({ message: 'Некорректный email адрес' });
    }

    // Определяем, авторизован ли пользователь
    let userId = null;
    
    // Сначала проверяем авторизацию по токену
    if (req.cookies.token) {
      try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.id }
        });
        
        if (user) {
          userId = user.id;
          console.log('Пользователь авторизован по токену, userId:', userId);
        }
      } catch (authError) {
        console.log('Ошибка авторизации по токену:', authError.message);
      }
    }
    
    // Если пользователь не авторизован по токену, пробуем найти его по email
    if (userId === null) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email }
        });
        
        if (user) {
          userId = user.id;
          console.log('Пользователь найден по email, привязываем заказ к userId:', userId);
        } else {
          console.log('Пользователь с email', email, 'не найден в базе данных');
        }
      } catch (emailSearchError) {
        console.log('Ошибка при поиске пользователя по email:', emailSearchError.message);
      }
    }

    // Подготавливаем данные для создания заказа
    const orderData = {
      status: 'PENDING',
      amount: parseFloat(amount),
      description: details || '',
      customerName: name,
      customerPhone: phone,
      customerEmail: email
    };

    // Добавляем userId только если пользователь авторизован
    if (userId !== null) {
      orderData.userId = userId;
      console.log('Заказ будет привязан к пользователю:', userId);
    } else {
      console.log('Заказ будет создан без привязки к пользователю');
    }

    console.log('Создаем заказ с данными:', orderData);

    // Создаем заказ в базе данных
    const newOrder = await prisma.order.create({
      data: orderData
    });
    
    console.log('Заказ успешно создан:', {
      id: newOrder.id,
      status: newOrder.status,
      customerName: newOrder.customerName,
      userId: newOrder.userId
    });
    
    res.status(201).json({ 
      message: 'Заявка успешно создана', 
      orderId: newOrder.id 
    });
  } catch (error) {
    console.error('Ошибка при создании заявки:', error);
    res.status(500).json({ message: 'Произошла ошибка при обработке заявки' });
  }
});

// ADMIN ROUTES
// Get all users
app.get('/api/admin/users', auth, isAdmin, async (req, res) => {
  try {
    console.log('Запрос на получение списка пользователей от админа');
    
    // Получаем всех пользователей из базы данных
    const dbUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: { orders: true }
        }
      }
    });
    
    console.log(`Найдено ${dbUsers.length} пользователей`);
    
    // Преобразуем данные для фронтенда
    const users = dbUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      orderCount: user._count?.orders || 0
    }));

    res.json({ 
      success: true,
      users 
    });
  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    res.status(500).json({ 
      success: false,
      message: 'Ошибка при получении пользователей' 
    });
  }
});

// Get all orders
app.get('/api/admin/orders', auth, isAdmin, async (req, res) => {
  try {
    console.log('Запрос на получение списка заказов от админа');
    
    // Получаем все заказы из базы данных с информацией о пользователях
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`Найдено ${orders.length} заказов`);
    
    // Для отладки выводим данные первого заказа, если он есть
    if (orders.length > 0) {
      console.log('Пример данных заказа:', {
        id: orders[0].id,
        status: orders[0].status,
        amount: orders[0].amount,
        customerName: orders[0].customerName,
        customerPhone: orders[0].customerPhone,
        customerEmail: orders[0].customerEmail,
        userId: orders[0].userId
      });
    }
    
    res.json({ 
      success: true,
      orders 
    });
  } catch (error) {
    console.error('Ошибка при получении заказов:', error);
    res.status(500).json({ 
      success: false,
      message: 'Ошибка при получении заказов' 
    });
  }
});

// Update order status
app.patch('/api/admin/orders/:id', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Обновляем статус заказа в базе данных
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    return res.json({ 
      success: true,
      message: 'Статус заказа успешно обновлен', 
      order: updatedOrder
    });
  } catch (error) {
    console.error('Ошибка при обновлении статуса заказа:', error);
    res.status(500).json({ 
      success: false,
      message: 'Ошибка при обновлении статуса заказа' 
    });
  }
});

// Update order details
app.put('/api/admin/orders/:id', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, amount, description } = req.body;

    // Обновляем данные заказа в базе данных
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        status: status || undefined,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        description: description !== undefined ? description : undefined
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Заказ успешно обновлен',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Ошибка при обновлении заказа:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при обновлении заказа'
    });
  }
});

// Обработка всех остальных маршрутов - отдаем index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Функция для создания администратора при запуске сервера
async function createAdminIfNotExists() {
  try {
    // Проверяем, существует ли уже администратор
    const adminExists = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });
    
    if (!adminExists) {
      // Хешируем пароль
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // Создаем администратора
      await prisma.user.create({
        data: {
          name: 'Admin',
          email: 'admin@sibir.com',
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
      
      console.log('Администратор создан успешно');
    } else {
      console.log('Администратор уже существует');
    }
  } catch (error) {
    console.error('Ошибка при создании администратора:', error);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  try {
    // Тестируем подключение к базе данных
    await prisma.$connect();
    console.log('Подключение к базе данных успешно');
    
    // Создаем администратора при запуске
    await createAdminIfNotExists();
    
    console.log('Email: admin@sibir.com');
    console.log('Password: admin123');
  } catch (error) {
    console.error('Ошибка подключения к базе данных:', error);
    console.log('Приложение продолжит работу, но функции базы данных будут недоступны');
  }
}); 