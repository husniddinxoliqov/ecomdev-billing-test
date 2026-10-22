const { Telegraf } = require('telegraf');
const prisma = require('./db');
const { getDebtorsByMonth } = require('./services/billingService');

const token = process.env.BOT_TOKEN;

let bot = null;

if (token && token.trim() !== '') {
  bot = new Telegraf(token.trim());

  // Start & Help
  bot.start((ctx) => {
    ctx.reply(
      `👋 Assalomu alaykum! O'quv markazi to'lovlar hisobi botiga xush kelibsiz.\n\n` +
      `Mavjud buyruqlar:\n` +
      `📌 /debt - Joriy oy bo'yicha qarzdorlar ro'yxati\n` +
      `💳 /pay <studentId> <amount> - O'quvchiga to'lov kiritish\n\n` +
      `Misol: /pay 1 500000`
    );
  });

  bot.help((ctx) => {
    ctx.reply(
      `Mavjud buyruqlar:\n` +
      `📌 /debt - Joriy oy bo'yicha qarzdorlar ro'yxati va ularning qarz summasi\n` +
      `💳 /pay <studentId> <amount> - Yangi to'lov yozish (Misol: /pay 1 350000)`
    );
  });

  // /debt komandasi: joriy oy qarzdorlari
  bot.command('debt', async (ctx) => {
    try {
      const { month, debtors } = await getDebtorsByMonth();

      if (!debtors || debtors.length === 0) {
        return ctx.reply(`🎉 ${month} oyi bo'yicha hech qanday qarzdor mavjud emas! Barcha to'lovlar to'langan.`);
      }

      let message = `📋 *${month} oyi bo'yicha qarzdorlar ro'yxati:*\n\n`;
      debtors.forEach((d, idx) => {
        message += `${idx + 1}. *ID:* ${d.studentId} | *Ism:* ${d.name}\n`;
        message += `   👥 Guruh: ${d.group}\n`;
        message += `   📞 Tel: ${d.phone}\n`;
        message += `   💵 Oylik to'lov: ${d.monthlyFee.toLocaleString()} so'm\n`;
        message += `   ✅ To'langan: ${d.totalPaid.toLocaleString()} so'm\n`;
        message += `   ⚠️ *Qarzi:* ${d.debt.toLocaleString()} so'm\n\n`;
      });

      return ctx.replyWithMarkdown(message);
    } catch (error) {
      console.error('Bot /debt error:', error);
      return ctx.reply(`❌ Qarzdorlar ro'yxatini olishda xatolik yuz berdi: ${error.message}`);
    }
  });

  // /pay <studentId> <amount>
  bot.command('pay', async (ctx) => {
    try {
      const text = ctx.message.text.trim();
      const parts = text.split(/\s+/);

      if (parts.length < 3) {
        return ctx.reply(
          `⚠️ Noto'g'ri format!\n` +
          `Foydalanish: /pay <studentId> <amount>\n` +
          `Misol: /pay 1 500000`
        );
      }

      const studentId = parseInt(parts[1], 10);
      const amount = parseFloat(parts[2]);

      if (isNaN(studentId) || studentId <= 0) {
        return ctx.reply(`❌ O'quvchi ID raqam bo'lishi kerak. Kiritilgan: "${parts[1]}"`);
      }

      if (isNaN(amount) || amount <= 0) {
        return ctx.reply(`❌ To'lov summasi musbat son bo'lishi kerak. Kiritilgan: "${parts[2]}"`);
      }

      // O'quvchi mavjudligini tekshirish
      const student = await prisma.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        return ctx.reply(`❌ ID=${studentId} bo'lgan o'quvchi bazadan topilmadi.`);
      }

      // To'lovni kiritish
      const payment = await prisma.payment.create({
        data: {
          studentId: student.id,
          amount,
          paidAt: new Date(),
        },
      });

      return ctx.reply(
        `✅ To'lov muvaffaqiyatli qabul qilindi!\n\n` +
        `🆔 To'lov ID: ${payment.id}\n` +
        `👤 O'quvchi: ${student.name} (ID: ${student.id})\n` +
        `👥 Guruh: ${student.group}\n` +
        `💰 To'langan summa: ${payment.amount.toLocaleString()} so'm\n` +
        `📅 Sana: ${new Date(payment.paidAt).toLocaleString('uz-UZ')}`
      );
    } catch (error) {
      console.error('Bot /pay error:', error);
      return ctx.reply(`❌ To'lovni kiritishda xatolik yuz berdi: ${error.message}`);
    }
  });
} else {
  console.warn('⚠️ BOT_TOKEN topilmadi yoki bo\'sh. Telegram bot ishga tushirilmadi. Iltimos .env fayliga BOT_TOKEN kiriting.');
}

function startBot() {
  if (bot) {
    bot
      .launch()
      .then(() => {
        console.log('🤖 Telegram bot muvaffaqiyatli ishga tushdi!');
      })
      .catch((err) => {
        console.error('❌ Telegram botni ishga tushirishda xatolik:', err.message);
      });

    // Graceful stop
    process.once('SIGINT', () => bot && bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot && bot.stop('SIGTERM'));
  }
}

module.exports = {
  bot,
  startBot,
};
