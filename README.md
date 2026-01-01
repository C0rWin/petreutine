# ДомойСкорей

  **[🌐 Открыть приложение](https://petreunite-ipda9.ondigitalocean.app/)**
</div>

**ДомойСкорей** — это сервис для поиска пропавших и найденных домашних животных. Пользователи могут публиковать объявления о потерянных или найденных питомцах, а система автоматически находит потенциальные совпадения с помощью полнотекстового поиска.

## Возможности

- 📝 Публикация объявлений о пропавших и найденных животных
- 📷 Загрузка фотографий в облачное хранилище
- 🔍 Умный поиск по описанию, породе, цвету и местоположению
- 🎯 Автоматический подбор совпадений между объявлениями
- 🔐 Авторизация через Яндекс ID
- 👤 Личный кабинет с управлением своими объявлениями
- 🗺️ Выбор местоположения на Яндекс.Картах
- 📱 Адаптивный дизайн для мобильных устройств
- 🇷🇺 Полностью на русском языке

## Технологии

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Яндекс.Карты API

### Backend
- Node.js + Express
- PostgreSQL с полнотекстовым поиском (русский язык)
- JWT авторизация
- TypeScript

### Интеграции
- Яндекс ID (OAuth 2.0)
- Яндекс.Карты
- Digital Ocean Spaces (хранение изображений)

### Инфраструктура
- Digital Ocean App Platform
- Managed PostgreSQL
- CDN для изображений

## Локальная разработка

### Требования
- Node.js 20+
- PostgreSQL 16+

### Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/C0rWin/petreutine.git
cd petreutine
```

2. Установите зависимости frontend:
```bash
npm install
```

3. Установите зависимости backend:
```bash
cd server
npm install
```

4. Создайте базу данных PostgreSQL:
```bash
createdb petreunite
```

5. Настройте переменные окружения:

```bash
# server/.env
DATABASE_URL=postgresql://localhost:5432/petreunite
PORT=3001
CORS_ORIGIN=http://localhost:5173
AUTO_MIGRATE=true
FRONTEND_URL=http://localhost:5173

# Яндекс OAuth (получите на https://oauth.yandex.ru/)
YANDEX_CLIENT_ID=your_client_id
YANDEX_CLIENT_SECRET=your_client_secret
YANDEX_REDIRECT_URI=http://localhost:3001/api/auth/yandex/callback

# JWT секрет (сгенерируйте случайную строку)
JWT_SECRET=your_jwt_secret
```

6. Настройте Яндекс.Карты:

Создайте файл `.env` в корне проекта:
```bash
VITE_YANDEX_MAPS_API_KEY=your_yandex_maps_api_key
```
Получите ключ API на https://developer.tech.yandex.ru/

7. Запустите миграции базы данных:
```bash
cd server
npm run db:migrate
```

### Запуск

В двух терминалах:

```bash
# Терминал 1: Backend
cd server
npm run dev
```

```bash
# Терминал 2: Frontend
npm run dev
```

Откройте http://localhost:5173 в браузере.

## Структура проекта

```
├── App.tsx              # Главный компонент
├── components/          # React компоненты
│   ├── CreatePost.tsx   # Форма создания объявления
│   ├── EditPost.tsx     # Форма редактирования
│   ├── MyPosts.tsx      # Мои объявления
│   ├── PetCard.tsx      # Карточка питомца
│   └── YandexMap.tsx    # Компонент Яндекс.Карт
├── contexts/
│   └── AuthContext.tsx  # Контекст авторизации
├── services/
│   └── api.ts           # API клиент
├── types/
│   └── ymaps.d.ts       # Типы Яндекс.Карт
├── types.ts             # TypeScript типы
├── server/              # Backend
│   ├── src/
│   │   ├── index.ts     # Express сервер
│   │   ├── db/          # База данных
│   │   ├── middleware/  # Middleware (auth)
│   │   └── routes/      # API маршруты (posts, search, auth, upload)
│   └── Dockerfile
└── .do/
    └── app.yaml         # Digital Ocean конфиг
```

## API

### Объявления

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/posts` | Получить все объявления |
| GET | `/api/posts/:id` | Получить объявление по ID |
| POST | `/api/posts` | Создать объявление |
| PUT | `/api/posts/:id` | Обновить объявление |
| DELETE | `/api/posts/:id` | Удалить объявление |

### Поиск

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/search?q=...` | Полнотекстовый поиск |
| GET | `/api/search/matches/:postId` | Найти совпадения |

### Авторизация

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/auth/yandex` | Начать OAuth авторизацию |
| GET | `/api/auth/yandex/callback` | OAuth callback |
| GET | `/api/auth/me` | Получить текущего пользователя |
| POST | `/api/auth/logout` | Выйти из системы |

### Загрузка файлов

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/upload/image` | Загрузить изображение |

## Развёртывание

Проект настроен для развёртывания на Digital Ocean App Platform. Конфигурация находится в `.do/app.yaml`.

```bash
# Установка doctl CLI
brew install doctl

# Развёртывание
doctl apps create --spec .do/app.yaml
```

## Планы развития

- [x] Авторизация через Яндекс ID
- [x] Интеграция Яндекс.Карт для выбора местоположения
- [x] Загрузка изображений в облачное хранилище (Digital Ocean Spaces)
- [x] Личный кабинет с управлением объявлениями
- [ ] Email-уведомления о совпадениях
- [ ] Push-уведомления
- [ ] Мобильное приложение (React Native)

## Лицензия

MIT
