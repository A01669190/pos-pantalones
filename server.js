const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const app = express();

const db = new sqlite3.Database('./pos.db');

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
    db.run("CREATE TABLE IF NOT EXISTS productos (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT UNIQUE, nombre TEXT, precio REAL, stock INTEGER, imagen TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS ventas (id INTEGER PRIMARY KEY AUTOINCREMENT, total REAL, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

app.get('/', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, productos) => {
        res.render('index', { productos: productos || [] });
    });
});

app.get('/api/producto/:codigo', (req, res) => {
    db.get("SELECT * FROM productos WHERE codigo = ?", [req.params.codigo], (err, row) => {
        res.json(row || { error: "No encontrado" });
    });
});

app.post('/agregar', upload.single('foto'), (req, res) => {
    const { codigo, nombre, precio, stock } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : 'https://via.placeholder.com/150?text=Pantalón';
    const query = `INSERT INTO productos (codigo, nombre, precio, stock, imagen) VALUES (?, ?, ?, ?, ?) 
                   ON CONFLICT(codigo) DO UPDATE SET nombre=excluded.nombre, precio=excluded.precio, stock=stock+excluded.stock, imagen=excluded.imagen`;
    db.run(query, [codigo, nombre, precio, stock, imagen], () => res.redirect('/'));
});

app.post('/eliminar-articulo', (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM productos WHERE id = ?", [id], () => res.redirect('/'));
});

app.post('/vender', (req, res) => {
    const { carrito } = req.body;
    let totalVenta = 0;
    carrito.forEach(item => {
        totalVenta += item.precio * item.cantidad;
        db.run("UPDATE productos SET stock = stock - ? WHERE id = ?", [item.cantidad, item.id]);
    });
    db.run("INSERT INTO ventas (total) VALUES (?)", [totalVenta], () => res.json({ success: true }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sistema lanzado exitosamente en el puerto ${PORT}`);
});