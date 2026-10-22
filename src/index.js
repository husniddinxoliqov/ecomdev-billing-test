require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./db');
const { startBot } = require('./bot');
const { getDebtorsByMonth } = require('./services/billingService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Info / Health
app.get('/', (req, res) => {
  res.json({
    message: "O'quv markazi to'lovlar hisobi (mini billing) API tizimi",
    status: 'running',
    endpoints: {
      students: {
        'POST /students': "Yangi o'quvchi qo'shish (name, phone, group, monthlyFee)",
        'GET /students': "Barcha o'quvchilar ro'yxati",
        'PUT /students/:id': "O'quvchi ma'lumotlarini yangilash",
        'DELETE /students/:id': "O'quvchini o'chirish (to'lovlari bilan birga)",
      },
      payments: {
        'POST /payments': "Yangi to'lov kiritish (studentId, amount, date?)",
        'GET /students/:id/payments': "O'quvchining to'lovlar tarixi",
      },
      billing: {
        'GET /debtors?month=YYYY-MM': 'Berilgan oy uchun qarzdorlar ro\'yxati (UTC)',
      },
    },
  });
});

/* =========================================================
   STUDENTS ENDPOINTS
========================================================= */

// 1. POST /students - O'quvchi qo'shish
app.post('/students', async (req, res) => {
  try {
    const { name, phone, group, monthlyFee } = req.body;

    if (!name || !phone || !group || monthlyFee === undefined) {
      return res.status(400).json({
        error: "Barcha maydonlar to'ldirilishi shart: name, phone, group, monthlyFee",
      });
    }

    const fee = parseFloat(monthlyFee);
    if (isNaN(fee) || fee < 0) {
      return res.status(400).json({
        error: "monthlyFee musbat son bo'lishi kerak",
      });
    }

    const student = await prisma.student.create({
      data: {
        name: String(name).trim(),
        phone: String(phone).trim(),
        group: String(group).trim(),
        monthlyFee: fee,
      },
    });

    return res.status(201).json(student);
  } catch (error) {
    console.error('POST /students error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. GET /students - O'quvchilar ro'yxati
app.get('/students', async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    return res.json(students);
  } catch (error) {
    console.error('GET /students error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. PUT /students/:id - O'quvchini tahrirlash
app.put('/students/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Noto'g'ri o'quvchi ID" });
    }

    const { name, phone, group, monthlyFee } = req.body;

    const existing = await prisma.student.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "O'quvchi topilmadi" });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (phone !== undefined) updateData.phone = String(phone).trim();
    if (group !== undefined) updateData.group = String(group).trim();
    if (monthlyFee !== undefined) {
      const fee = parseFloat(monthlyFee);
      if (isNaN(fee) || fee < 0) {
        return res.status(400).json({ error: "monthlyFee musbat son bo'lishi kerak" });
      }
      updateData.monthlyFee = fee;
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: updateData,
    });

    return res.json(updatedStudent);
  } catch (error) {
    console.error('PUT /students/:id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 4. DELETE /students/:id - O'quvchini o'chirish
app.delete('/students/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Noto'g'ri o'quvchi ID" });
    }

    const existing = await prisma.student.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "O'quvchi topilmadi" });
    }

    await prisma.student.delete({
      where: { id },
    });

    return res.json({
      message: "O'quvchi va uning barcha to'lovlari muvaffaqiyatli o'chirildi",
      deletedStudentId: id,
    });
  } catch (error) {
    console.error('DELETE /students/:id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/* =========================================================
   PAYMENTS ENDPOINTS
========================================================= */

// 5. POST /payments - To'lov kiritish: studentId, amount, date
app.post('/payments', async (req, res) => {
  try {
    const { studentId, amount, date } = req.body;

    const sId = parseInt(studentId, 10);
    const amt = parseFloat(amount);

    if (isNaN(sId) || isNaN(amt) || amt <= 0) {
      return res.status(400).json({
        error: "studentId va amount to'g'ri musbat son bo'lishi kerak",
      });
    }

    // O'quvchi mavjudligini tekshirish
    const student = await prisma.student.findUnique({
      where: { id: sId },
    });

    if (!student) {
      return res.status(404).json({
        error: `ID=${sId} bo'lgan o'quvchi topilmadi`,
      });
    }

    let paymentDate = new Date();
    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: "Yaroqsiz 'date' formati. ISO formatda yuboring (masalan: 2026-10-15T10:00:00Z)",
        });
      }
      paymentDate = parsedDate;
    }

    const payment = await prisma.payment.create({
      data: {
        studentId: sId,
        amount: amt,
        paidAt: paymentDate,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
      },
    });

    return res.status(201).json(payment);
  } catch (error) {
    console.error('POST /payments error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 6. GET /students/:id/payments - O'quvchining to'lovlar tarixi
app.get('/students/:id/payments', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Noto'g'ri o'quvchi ID" });
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: "O'quvchi topilmadi" });
    }

    const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      student: {
        id: student.id,
        name: student.name,
        phone: student.phone,
        group: student.group,
        monthlyFee: student.monthlyFee,
      },
      totalPaymentsCount: student.payments.length,
      allTimePaid: Number(totalPaid.toFixed(2)),
      payments: student.payments,
    });
  } catch (error) {
    console.error('GET /students/:id/payments error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/* =========================================================
   DEBTORS ENDPOINT
========================================================= */

// 7. GET /debtors?month=YYYY-MM - Qarzdorlar hisobi (UTC)
app.get('/debtors', async (req, res) => {
  try {
    const { month } = req.query;

    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        error: "'month' parametri YYYY-MM formatida bo'lishi kerak (masalan: 2026-10)",
      });
    }

    const result = await getDebtorsByMonth(month);

    return res.json(result);
  } catch (error) {
    console.error('GET /debtors error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Serverni ishga tushirish
const server = app.listen(PORT, () => {
  console.log(`🚀 Express server http://localhost:${PORT} manzilida ishga tushdi`);
  // Telegram botni ishga tushirish
  startBot();
});

module.exports = { app, server };
