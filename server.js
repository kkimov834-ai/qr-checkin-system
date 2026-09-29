require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cihazların son statusunu yaddaşda saxlamaq üçün (Production-da Supabase/MongoDB istifadə etmək məqsədəuyğundur)
const deviceStatusMap = {};

const GIRIS_IMAGE = path.join(__dirname, 'assets', 'giris.jpg');
const CIXIS_IMAGE = path.join(__dirname, 'assets', 'cixis.jpg');

async function sendTelegramPhoto(photoPath, caption) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', new Blob([fs.readFileSync(photoPath)], { type: 'image/jpeg' }), path.basename(photoPath));
    if (caption) {
        form.append('caption', caption);
    }

    const response = await fetch(telegramUrl, { method: 'POST', body: form });
    const result = await response.json();

    if (!result.ok) {
        console.error('Telegram API Xətası:', result);
        return false;
    }
    return true;
}

app.post('/api/scan', async (req, res) => {
    try {
        const { deviceId, userName } = req.body;

        if (!deviceId || !userName) {
            return res.status(400).json({ success: false, message: 'Cihaz ID və ya Ad/Soyad əskikdir.' });
        }

        // Cari vaxtı Bakı saatı ilə almaq
        const now = new Date();
        const bakuTime = new Intl.DateTimeFormat('az-AZ', {
            timeZone: 'Asia/Baku', hour12: false,
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(now);
        const bakuDate = new Intl.DateTimeFormat('az-AZ', {
            timeZone: 'Asia/Baku',
            day: '2-digit', month: '2-digit', year: 'numeric'
        }).format(now);

        // Giriş/Çıxış məntiqi (Toggle)
        const lastStatus = deviceStatusMap[deviceId] || 'OUT';
        const currentStatus = lastStatus === 'OUT' ? 'IN' : 'OUT';
        deviceStatusMap[deviceId] = currentStatus;

        const isEntry = currentStatus === 'IN';

        // Telegram bildirişi: Giriş → yaşıl ox şəkli + İşçi/Vaxt/Tarix mətni; Çıxış → tək qırmızı ox şəkli
        if (isEntry) {
            const caption = `İşçi: ${userName}\nVaxt: ${bakuTime}\nTarix: ${bakuDate}`;
            await sendTelegramPhoto(GIRIS_IMAGE, caption);
        } else {
            await sendTelegramPhoto(CIXIS_IMAGE);
        }

        return res.json({
            success: true,
            status: currentStatus,
            message: `${isEntry ? 'Giriş' : 'Çıxış'} uğurla qeydə alındı!`,
            time: `${bakuDate}, ${bakuTime}`
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
