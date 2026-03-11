const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer'); // Para subir fotos
const path = require('path');
const app = express();
const db = new sqlite3.Database('./pos.db');

// Configuración para guardar imágenes
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS productos (id INTEGER PRIMARY KEY, codigo TEXT UNIQUE, nombre TEXT, precio REAL, stock INTEGER, imagen TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS ventas (id INTEGER PRIMARY KEY, total REAL, fecha TEXT)");
});

app.get('/', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, productos) => {
        res.render('index', { productos });
    });
});

// AGREGAR PRODUCTO CON FOTO
app.post('/agregar', upload.single('foto'), (req, res) => {
    const { codigo, nombre, precio, stock } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : '/uploads/default.png';
    db.run("INSERT INTO productos (codigo, nombre, precio, stock, imagen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(codigo) DO UPDATE SET stock = stock + excluded.stock, precio = excluded.precio", 
    [codigo, nombre, precio, stock, imagen], () => res.redirect('/'));
});

// BUSCAR PARA ESCÁNER
app.get('/api/producto/:codigo', (req, res) => {
    db.get("SELECT * FROM productos WHERE codigo = ?", [req.params.codigo], (err, row) => {
        res.json(row || { error: "No encontrado" });
    });
});

app.listen(3000, '0.0.0.0', () => console.log("Sistema listo en http://localhost:3000"));