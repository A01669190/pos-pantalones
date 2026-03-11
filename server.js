const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURACIÓN DE BASE DE DATOS (REPARADA) ---
const isRender = process.env.RENDER === 'true';
// Si estamos en Render, intentamos usar el disco persistente, si no, la carpeta del proyecto
let dbPath = isRender ? '/data/pos.db' : './pos.db';

// Verificación de seguridad: Si /data no es escribible, usamos la ruta local
if (isRender) {
    try {
        if (!fs.existsSync('/data')) {
            console.log("⚠️ Carpeta /data no encontrada, usando base de datos local.");
            dbPath = './pos.db';
        }
    } catch (e) {
        dbPath = './pos.db';
    }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Error grave al abrir DB. Reintentando localmente...", err.message);
        dbPath = './pos.db'; // Último recurso
    } else {
        console.log(`🏠 Base de datos conectada en: ${dbPath}`);
    }
});

// --- CONFIGURACIÓN DE IMÁGENES ---
// Crear carpeta de subidas si no existe
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

// --- CREACIÓN DE TABLAS ---
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

app.get('/api/producto/:codigo', (req, res) => {
    db.get("SELECT * FROM productos WHERE codigo = ?", [req.params.codigo], (err, row) => {
        res.json(row || { error: "No encontrado" });
    });
});

app.post('/agregar', upload.single('foto'), (req, res) => {
    const { codigo, nombre, precio, stock } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : 'https://via.placeholder.com/150?text=Pantalon';
    
    const query = `INSERT INTO productos (codigo, nombre, precio, stock, imagen) 
                   VALUES (?, ?, ?, ?, ?) 
                   ON CONFLICT(codigo) DO UPDATE SET 
                   nombre=excluded.nombre, precio=excluded.precio, stock=stock+excluded.stock, imagen=excluded.imagen`;
    
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
    db.run("INSERT INTO ventas (total) VALUES (?)", [totalVenta], () => {
        res.json({ success: true });
    });
});

// --- ENCENDIDO (PUERTO DINÁMICO) ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 El servidor está corriendo en el puerto: ${PORT}`);
});