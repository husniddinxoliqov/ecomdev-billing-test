# 🎓 O'quv Markazi To'lovlar Hisobi (Mini Billing) Tizimi

Ushbu loyiha o'quv markazlari uchun mo'ljallangan mini billing tizimi bo'lib, o'quvchilar hisobi, to'lovlar monitoringi, oylik qarzdorliklarni UTC vaqt mintaqasi bo'yicha hisoblash hamda Telegram Bot orqali to'lovlarni boshqarish imkoniyatini beradi.

---

## 🛠 Texnologiyalar Steki

- **Node.js** (JavaScript)
- **Express.js** — REST API server
- **Prisma ORM** + **SQLite** — Ma'lumotlar bazasi va relyatsion modellar
- **Telegraf** — Telegram Bot integratsiyasi
- **dotenv** — Muhit o'zgaruvchilari
- **cors** — Cross-Origin Resource Sharing
- **nodemon** — Ishlab chiqish muhiti (Hot-reload)

---

## 📂 Loyiha Tuzilmasi

```
ecomdev-task/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma       # Prisma ma'lumotlar modellari
│   └── dev.db              # SQLite ma'lumotlar bazasi
├── src/
│   ├── services/
│   │   └── billingService.js # Qarzdorlikni UTC sanalar bo'yicha hisoblash
│   ├── bot.js              # Telegraf Telegram boti (/debt, /pay)
│   ├── db.js               # PrismaClient instansiyasi
│   └── index.js            # Express server va REST API marshrutlari
├── .env                    # Muhit o'zgaruvchilari
├── package.json
└── README.md
```

---

## 🚀 Loyihani Noldan Ishga Tushirish Qadamlari

### 1. Repozitoriyani klonlash
```bash
git clone https://github.com/husniddinxoliqov/ecomdev-billing-test.git
cd ecomdev-billing-test
```

### 2. Bog'liqliklarni (Dependencies) o'rnatish
```bash
npm install
```

### 3. Muhit o'zgaruvchilarini sozlash
`.env.example` faylidan nusxa olib, `.env` faylini yarating:
```bash
cp .env.example .env
```
Fayl ichidagi o'zgaruvchilar:
```env
DATABASE_URL="file:./dev.db"
PORT=3000
BOT_TOKEN="TELEGRAM_BOT_TOKEN_SHU_YERGA"
```
> *Eslatma:* Agar `BOT_TOKEN` kiritilmasa, Express server odatiy tartibda ishlayveradi, faqat Telegram bot vaqtincha nofaol bo'ladi.

### 4. Ma'lumotlar bazasini generatsiya va migratsiya qilish
```bash
npx prisma migrate dev --name init
```
Ushbu buyruq `dev.db` SQLite faylini yaratadi va barcha jadvallarni (`Student`, `Payment`) ishga tushiradi.

### 5. Serverni ishga tushirish

**Rivojlantirish (Development) rejimida:**
```bash
npm run dev
```

**Ishlab chiqarish (Production) rejimida:**
```bash
npm start
```

Server odatiy tarzda `http://localhost:3000` manzilida ishlaydi.

---

## 📡 REST API Hujjatlari

### 1. O'quvchilar (Students)

| Metod | Marshrut | Tavsif |
|---|---|---|
| `POST` | `/students` | Yangi o'quvchi qo'shish |
| `GET` | `/students` | Barcha o'quvchilar ro'yxati |
| `PUT` | `/students/:id` | O'quvchi ma'lumotlarini tahrirlash |
| `DELETE` | `/students/:id` | O'quvchini va uning barcha to'lovlarini o'chirish |

**Yangi o'quvchi qo'shish so'rovi (POST /students):**
```json
{
  "name": "Ali Valiyev",
  "phone": "+998901234567",
  "group": "Node.js Backend",
  "monthlyFee": 600000
}
```

---

### 2. To'lovlar (Payments)

| Metod | Marshrut | Tavsif |
|---|---|---|
| `POST` | `/payments` | Yangi to'lov kiritish |
| `GET` | `/students/:id/payments` | O'quvchining to'lovlar tarixi |

**To'lov kiritish so'rovi (POST /payments):**
```json
{
  "studentId": 1,
  "amount": 400000,
  "date": "2026-10-15T12:00:00Z"
}
```
*(Eslatma: `date` ixtiyoriy, agar berilmasa joriy vaqt saqlanadi).*

---

### 3. Qarzdorlik hisob-kitobi (Debtors)

| Metod | Marshrut | Tavsif |
|---|---|---|
| `GET` | `/debtors?month=YYYY-MM` | Berilgan oy bo'yicha qarzdorlar ro'yxati va qarz summasi |

- Agar `month` parametri berilmasa, joriy oy (UTC) avtomatik hisoblanadi.
- UTC vaqt bo'yicha oyning birinchi soniyasidan keyingi oyning birinchi soniyasigacha bo'lgan to'lovlar jamlanadi.
- Agar `totalPaid < monthlyFee` bo'lsa, `debt = monthlyFee - totalPaid` qilib qaytariladi.

**Javob namunasi:**
```json
{
  "month": "2026-10",
  "startDate": "2026-10-01T00:00:00.000Z",
  "endDate": "2026-11-01T00:00:00.000Z",
  "debtors": [
    {
      "studentId": 1,
      "name": "Ali Valiyev",
      "phone": "+998901234567",
      "group": "Node.js Backend",
      "monthlyFee": 600000,
      "totalPaid": 400000,
      "debt": 200000
    }
  ]
}
```

---

## 🤖 Telegram Bot Buyruqlari

Bot orqali hisobchi yoki administratorlar quyidagi amallarni bajarishi mumkin:
- `/debt` — Joriy oy bo'yicha qarzdorlar ro'yxatini va har birining qarz summasini chiroyli formatda chiqaradi.
- `/pay <studentId> <amount>` — O'quvchiga yangi to'lov yozadi va tasdiq xabarini qaytaradi.
  - *Misol:* `/pay 1 200000`

---

## 💡 Yana Bir Hafta Vaqt Bo'lsa Qilinadigan 5 Ta Yaxshilanish

Agar loyihani rivojlantirish uchun qo'shimcha bir hafta vaqt bo'lsa, quyidagi muhim funksional imkoniyatlar joriy etiladi:

1. **Autentifikatsiya, Rollar va Xavfsizlik (RBAC & JWT)**
   - REST API uchun JWT (JSON Web Token) asosida himoyalangan marshrutlar va rollar iyerarxiyasi (SuperAdmin, Hisobchi/Kassir, O'qituvchi).
   - Har bir kiritilgan to'lov yoki o'zgarish kim tomonidan qilinganini kuzatuvchi Audit Log (audit jurnali).
   - Telegram botda faqat ruxsat etilgan xodimlarning Telegram ID raqamlari orqali ishlash cheklovi (White-listing / Auth middleware).

2. **Konteynerlashtirish va CI/CD (Docker & Docker Compose)**
   - Loyihani istalgan serverda birgina `docker compose up -d` buyrug'i bilan ishga tushirish uchun Dockerfile va docker-compose konfiguratsiyalari.
   - GitHub Actions orqali avtomatlashtirilgan test va lint tekshiruvlarini o'z ichiga olgan CI/CD quvuri (pipeline).

3. **Avtomatlashtirilgan Testlar (Unit & Integration Tests - Jest / Supertest)**
   - `billingService.js` hisob-kitob funksiyalari uchun to'liq Unit testlar (UTC oy boshlanishi/tugashi chegaraviy holatlari bo'yicha).
   - Express API endpointlari (`/students`, `/payments`, `/debtors`) uchun Supertest orqali integratsion testlar va test bazasi (in-memory SQLite).

4. **Kumulyativ Qarz va Depozit Balansi (Wallet & Carry-Over Balance)**
   - O'quvchi bir necha oy davomida to'lov qilmaganida qarzning oydan oyga yig'ilib borishi (cumulative debt).
   - O'quvchi ortiqcha to'lov qilganda mablag'ni shaxsiy balans (depozit) sifatida saqlash va keyingi oy to'loviga avtomatik yechish mexanizmi.

5. **To'lov Tizimlari (Click, Payme, Uzum) va Avtomatlashgan Eslatmalar (Cron Scheduler)**
   - Click Merchant va Payme billing API integratsiyasi orqali to'lovlarni real vaqtda qabul qilish va PDF kvitansiya generatsiya qilish.
   - node-cron yordamida har oyning belgilangan sanasida qarzdorlarga Telegram yoki SMS orqali avtomatik eslatmalar yuborish.

