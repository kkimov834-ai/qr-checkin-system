require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cihazların son statusunu yaddaşda saxlamaq üçün (Production-da Supabase/MongoDB istifadə etmək məqsədəuyğundur)
const deviceStatusMap = {};

app.post('/api/scan', async (req, res) => {
    try {
        const { deviceId, userName } = req.body;

        if (!deviceId || !userName) {
            return res.status(400).json({ success: false, message: 'Cihaz ID və ya Ad/Soyad əskikdir.' });
        }

        // Cari vaxtı Bakı saatı ilə almaq
        const now = new Date().toLocaleString("az-AZ", { 
            timeZone: "Asia/Baku", 
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        // Giriş/Çıxış məntiqi (Toggle)
        const lastStatus = deviceStatusMap[deviceId] || 'OUT';
        const currentStatus = lastStatus === 'OUT' ? 'IN' : 'OUT';
        deviceStatusMap[deviceId] = currentStatus;

        // Telegram bildiriş mesajı
        const isEntry = currentStatus === 'IN';
        const statusEmoji = isEntry ? '🟢' : '🔴';
        const statusTitle = isEntry ? 'GİRİŞ EDİLDİ' : 'ÇIXIŞ EDİLDİ';

        const telegramMessage = 
`${statusEmoji} <b>${statusTitle}</b>\n\n` +
`👤 <b>İşçi:</b> ${userName}\n` +
`🕒 <b>Saat:</b> ${now}\n` +
`📱 <b>Cihaz kodi:</b> <code>${deviceId.substring(0, 8)}...</code>`;

        // Telegram Bot API-yə sorğu
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: telegramMessage,
                parse_mode: 'HTML'
            })
        });

        const telegramResult = await response.json();

        if (!telegramResult.ok) {
            console.error('Telegram API Xətası:', telegramResult);
        }

        return res.json({
            success: true,
            status: currentStatus,
            message: `${isEntry ? 'Giriş' : 'Çıxış'} uğurla qeydə alındı!`,
            time: now
        });

    } catch (error) {
        console.error('Server xətası:', error);
        return res.status(500).json({ success: false, message: 'Daxili server xətası baş verdi.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışır...`);
});