const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// --- SOLUCIÓN DE EMERGENCIA: RUTA LOCAL ---
// Guardamos la base de datos en la carpeta actual para evitar errores de permisos
const dbPath = path.join(__dirname, 'pos.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Error fatal DB:", err.message);
    } else {
        console.log(`🏠 Base de datos conectada en: ${dbPath}`);
    }
});

// --- CONFIGURACIÓN DE IMÁGENES ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

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

// --- CREAR TABLAS ---
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS productos (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT UNIQUE, nombre TEXT, precio REAL, stock INTEGER, imagen TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS ventas (id INTEGER PRIMARY KEY AUTOINCREMENT, total REAL, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

// --- RUTAS ---
app.get('/', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, productos) => {
        res.render('index', { productos: productos || [] });
    });
});

app.post('/agregar', upload.single('foto'), (req, res) => {
    const { codigo, nombre, precio, stock } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : 'https://via.placeholder.com/150?text=Pantalon';
    
    db.run(`INSERT INTO productos (codigo, nombre, precio, stock, imagen) VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(codigo) DO UPDATE SET nombre=excluded.nombre, precio=excluded.precio, stock=stock+excluded.stock, imagen=excluded.imagen`,
    [codigo, nombre, precio, stock, imagen], () => res.redirect('/'));
});

app.post('/eliminar-articulo', (req, res) => {
    db.run("DELETE FROM productos WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.post('/vender', (req, res) => {
    const { carrito } = req.body;
    carrito.forEach(item => {
        db.run("UPDATE productos SET stock = stock - ? WHERE id = ?", [item.cantidad, item.id]);
    });
    res.json({ success: true });
});

// --- PUERTO PARA RENDER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor funcionando en puerto: ${PORT}`);
});