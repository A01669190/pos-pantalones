const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const dbPath = path.join(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath);

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        codigo TEXT UNIQUE, 
        nombre TEXT, 
        precio REAL, 
        stock INTEGER, 
        imagen TEXT
    )`);
});

app.get('/', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, rows) => {
        res.render('index', { productos: rows || [] });
    });
});

app.post('/agregar', upload.single('foto'), (req, res) => {
    const { codigo, nombre, precio, stock } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : 'https://via.placeholder.com/150';
    const sql = `INSERT INTO productos (codigo, nombre, precio, stock, imagen) VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(codigo) DO UPDATE SET stock = stock + excluded.stock, precio = excluded.precio, nombre = excluded.nombre`;
    db.run(sql, [codigo, nombre, precio, stock, imagen], () => res.redirect('/'));
});

app.post('/eliminar-del-stock', (req, res) => {
    db.run("DELETE FROM productos WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.post('/vender', (req, res) => {
    const { carrito } = req.body;
    db.serialize(() => {
        const stmt = db.prepare("UPDATE productos SET stock = stock - ? WHERE id = ?");
        carrito.forEach(item => stmt.run(item.cantidad, item.id));
        stmt.finalize(() => res.json({ success: true }));
    });
});

app.listen(3000, () => console.log("🚀 YSK Professional POS en http://localhost:3000"));