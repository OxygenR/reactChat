/* eslint-disable no-undef */
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

// Создаем папку uploads если ее нет
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

app.use('/uploads', express.static('uploads'));

app.post('/upload-to-network', upload.single('file'), (req, res) => {
    try {
        const networkPath = req.body.networkPath;
        const file = req.file;

        // Создаем уникальное имя файла
        const uniqueFileName = `${Date.now()}_${file.originalname}`;
        const fullPath = path.join(networkPath, uniqueFileName);

        // Проверяем доступность сетевой папки
        if (!fs.existsSync(networkPath)) {
            return res.status(500).json({ error: 'Сетевая папка недоступна' });
        }

        // Записываем файл
        fs.writeFileSync(fullPath, file.buffer);

        res.json({
            originalName: file.originalname,
            fileUrl: `file:///${fullPath.replace(/\\/g, '/')}`,
            fileSize: file.size
        });

    } catch (error) {
        console.error('Ошибка записи файла:', error);
        res.status(500).json({ error: error.message });
    }
});
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`File server running on port ${PORT}`);
});