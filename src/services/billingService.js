const prisma = require('../db');

/**
 * Berilgan oy (YYYY-MM) bo'yicha qarzdorlar ro'yxatini hisoblaydi.
 * UTC sanalardan foydalaniladi.
 * 
 * @param {string} [monthStr] - "YYYY-MM" formatidagi oy. Berilmasa joriy UTC oy olinadi.
 * @returns {Promise<{ month: string, startDate: Date, endDate: Date, debtors: Array }>}
 */
async function getDebtorsByMonth(monthStr) {
  let year, month;

  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const parts = monthStr.split('-').map(Number);
    year = parts[0];
    month = parts[1];
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
    monthStr = `${year}-${String(month).padStart(2, '0')}`;
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const students = await prisma.student.findMany({
    include: {
      payments: {
        where: {
          paidAt: {
            gte: startDate,
            lt: endDate,
          },
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const debtors = [];

  for (const student of students) {
    const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
    const debt = student.monthlyFee - totalPaid;

    if (debt > 0) {
      debtors.push({
        studentId: student.id,
        name: student.name,
        phone: student.phone,
        group: student.group,
        monthlyFee: student.monthlyFee,
        totalPaid: Number(totalPaid.toFixed(2)),
        debt: Number(debt.toFixed(2)),
      });
    }
  }

  return {
    month: monthStr,
    startDate,
    endDate,
    debtors,
  };
}

module.exports = {
  getDebtorsByMonth,
};
