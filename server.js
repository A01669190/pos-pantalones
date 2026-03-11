const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURACIÓN DE BASE DE DATOS SEGURA ---
const isRender = process.env.RENDER === 'true';
// Intentamos usar /data/pos.db, si no se puede, usamos ./pos.db en la carpeta del proyecto
let dbPath = './pos.db'; 

if (isRender) {
    const renderDiskPath = '/data/pos.db';
    try {
        // Verificamos si podemos escribir en la carpeta /data
        if (fs.existsSync('/data')) {
            dbPath = renderDiskPath;
        }
    } catch (e) {
        console.log("Usando base de datos local por falta de permisos en /data");
    }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Error DB:", err.message);
    else console.log(`🏠 Base de datos activa en: ${dbPath}`);
});

// --- CONFIGURACIÓN DE IMÁGENES ---
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

// --- TABLAS ---
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS productos (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT UNIQUE, nombre TEXT, precio REAL, stock INTEGER, imagen TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS ventas (id INTEGER PRIMARY KEY AUTOINCREMENT, total REAL, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

// --- RUTAS (BÁSICAS) ---
app.get('/', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, productos) => {
        res.render('index', { productos: productos || [] });
    });
});

app.post('/agregar', upload.single('foto'), (req, res) => {
    const { codigo, nombre, precio, stock } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : 'https://via.placeholder.com/150?text=Pantalon';
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
    carrito.forEach(item => {
        db.run("UPDATE productos SET stock = stock - ? WHERE id = ?", [item.cantidad, item.id]);
    });
    res.json({ success: true });
});

// --- PUERTO (ESTO ARREGLA EL ERROR DE "NO OPEN PORTS") ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sistema Online en puerto: ${PORT}`);
});