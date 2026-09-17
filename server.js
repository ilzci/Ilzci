require("dotenv").config();

const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 3000;
const OWNER_ID = String(process.env.OWNER_ID);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const db = new Database("database.db");

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    username TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    balance INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price INTEGER NOT NULL,
    image TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

function ensureUser(user) {
    const id = String(user.id);

    db.prepare(`
        INSERT INTO users (
            telegram_id,
            username,
            first_name
        )
        VALUES (?, ?, ?)
        ON CONFLICT(telegram_id)
        DO UPDATE SET
            username = excluded.username,
            first_name = excluded.first_name
    `).run(
        id,
        user.username || "",
        user.first_name || ""
    );

    return db.prepare(`
        SELECT * FROM users WHERE telegram_id = ?
    `).get(id);
}

function isOwner(id) {
    return String(id) === OWNER_ID;
}

function verifyTelegramWebAppData(initData) {
    if (!initData) return null;

    try {
        const params = new URLSearchParams(initData);
        const hash = params.get("hash");

        if (!hash) return null;

        params.delete("hash");

        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");

        const secretKey = crypto
            .createHmac("sha256", "WebAppData")
            .update(process.env.BOT_TOKEN)
            .digest();

        const calculatedHash = crypto
            .createHmac("sha256", secretKey)
            .update(dataCheckString)
            .digest("hex");

        if (
            calculatedHash.length !== hash.length ||
            !crypto.timingSafeEqual(
                Buffer.from(calculatedHash),
                Buffer.from(hash)
            )
        ) {
            return null;
        }

        const userData = params.get("user");

        if (!userData) return null;

        return JSON.parse(userData);

    } catch (error) {
        console.error("Telegram verification error:", error);
        return null;
    }
}

function getWebUser(req) {
    const initData =
        req.headers["x-telegram-init-data"] ||
        req.body?.initData ||
        req.query?.initData;

    return verifyTelegramWebAppData(initData);
}

/* =========================
   Telegram Bot
========================= */

bot.start(async (ctx) => {

    const user = ctx.from;

    ensureUser(user);

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.webApp(
                "🛍️ فتح المتجر",
                process.env.WEBAPP_URL
            )
        ],
        [
            Markup.button.callback(
                "⭐ رصيدي",
                "my_balance"
            )
        ]
    ]);

    await ctx.reply(
        `مرحباً ${user.first_name || ""} 👋

🛍️ أهلاً بك في المتجر الرقمي.

يمكنك استخدام رصيدك لشراء الخدمات المتوفرة داخل المتجر.`,
        keyboard
    );
});

bot.action("my_balance", async (ctx) => {

    const user = ensureUser(ctx.from);

    await ctx.answerCbQuery();

    await ctx.reply(
        `⭐ رصيدك الحالي:

${user.balance.toLocaleString()} نقطة`
    );
});

/* =========================
   API - User
========================= */

app.get("/api/me", (req, res) => {

    const user = getWebUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Telegram authentication required"
        });
    }

    const dbUser = ensureUser(user);

    res.json({
        success: true,
        user: {
            id: dbUser.telegram_id,
            username: dbUser.username,
            first_name: dbUser.first_name,
            balance: dbUser.balance
        }
    });
});

/* =========================
   API - Products
========================= */

app.get("/api/products", (req, res) => {

    const products = db.prepare(`
        SELECT *
        FROM products
        WHERE active = 1
        ORDER BY id DESC
    `).all();

    res.json({
        success: true,
        products
    });
});

/* =========================
   API - Buy Product
========================= */

app.post("/api/buy", (req, res) => {

    const user = getWebUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Telegram authentication required"
        });
    }

    const productId = Number(req.body.product_id);

    if (!productId) {
        return res.status(400).json({
            success: false,
            message: "Invalid product"
        });
    }

    const dbUser = ensureUser(user);

    const product = db.prepare(`
        SELECT *
        FROM products
        WHERE id = ?
        AND active = 1
    `).get(productId);

    if (!product) {
        return res.status(404).json({
            success: false,
            message: "Product not found"
        });
    }

    if (dbUser.balance < product.price) {
        return res.status(400).json({
            success: false,
            message: "رصيدك غير كافٍ"
        });
    }

    const transaction = db.transaction(() => {

        db.prepare(`
            UPDATE users
            SET balance = balance - ?
            WHERE telegram_id = ?
        `).run(
            product.price,
            dbUser.telegram_id
        );

        const order = db.prepare(`
            INSERT INTO orders (
                telegram_id,
                product_id,
                product_name,
                price
            )
            VALUES (?, ?, ?, ?)
        `).run(
            dbUser.telegram_id,
            product.id,
            product.name,
            product.price
        );

        db.prepare(`
            INSERT INTO transactions (
                telegram_id,
                type,
                amount,
                note
            )
            VALUES (?, ?, ?, ?)
        `).run(
            dbUser.telegram_id,
            "purchase",
            -product.price,
            `شراء: ${product.name}`
        );

        return order.lastInsertRowid;
    });

    const orderId = transaction();

    bot.telegram.sendMessage(
        OWNER_ID,
        `🛒 طلب جديد

👤 العميل: ${dbUser.first_name}
🆔 ID: ${dbUser.telegram_id}

📦 المنتج: ${product.name}
⭐ السعر: ${product.price.toLocaleString()} نقطة

🧾 رقم الطلب: #${orderId}`
    ).catch(console.error);

    bot.telegram.sendMessage(
        dbUser.telegram_id,
        `✅ تم إنشاء طلبك

📦 ${product.name}
⭐ ${product.price.toLocaleString()} نقطة
🧾 الطلب: #${orderId}

سيتم التواصل معك بخصوص تنفيذ الخدمة.`
    ).catch(console.error);

    const updatedUser = db.prepare(`
        SELECT balance
        FROM users
        WHERE telegram_id = ?
    `).get(dbUser.telegram_id);

    res.json({
        success: true,
        order_id: orderId,
        balance: updatedUser.balance
    });
});

/* =========================
   OWNER AUTH
========================= */

function ownerOnly(req, res, next) {

    const user = getWebUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    if (!isOwner(user.id)) {
        return res.status(403).json({
            success: false,
            message: "Owner only"
        });
    }

    req.owner = user;

    next();
}

/* =========================
   OWNER - Add Points
========================= */

app.post("/api/admin/add-points", ownerOnly, (req, res) => {

    const telegramId = String(req.body.telegram_id);
    const amount = Number(req.body.amount);
    const note = req.body.note || "إضافة رصيد";

    if (!telegramId || !Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({
            success: false,
            message: "بيانات غير صحيحة"
        });
    }

    const user = db.prepare(`
        SELECT *
        FROM users
        WHERE telegram_id = ?
    `).get(telegramId);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "المستخدم غير موجود. يجب أن يفتح البوت أولاً."
        });
    }

    db.prepare(`
        UPDATE users
        SET balance = balance + ?
        WHERE telegram_id = ?
    `).run(amount, telegramId);

    db.prepare(`
        INSERT INTO transactions (
            telegram_id,
            type,
            amount,
            note
        )
        VALUES (?, ?, ?, ?)
    `).run(
        telegramId,
        "credit",
        amount,
        note
    );

    bot.telegram.sendMessage(
        telegramId,
        `🎁 تم إضافة رصيد إلى حسابك

⭐ +${amount.toLocaleString()} نقطة

💰 رصيدك الحالي:
${(user.balance + amount).toLocaleString()} نقطة`
    ).catch(console.error);

    res.json({
        success: true,
        message: "تمت إضافة النقاط"
    });
});

/* =========================
   OWNER - Remove Points
========================= */

app.post("/api/admin/remove-points", ownerOnly, (req, res) => {

    const telegramId = String(req.body.telegram_id);
    const amount = Number(req.body.amount);

    if (!telegramId || !Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({
            success: false,
            message: "بيانات غير صحيحة"
        });
    }

    const user = db.prepare(`
        SELECT *
        FROM users
        WHERE telegram_id = ?
    `).get(telegramId);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "المستخدم غير موجود"
        });
    }

    if (user.balance < amount) {
        return res.status(400).json({
            success: false,
            message: "رصيد المستخدم غير كافٍ"
        });
    }

    db.prepare(`
        UPDATE users
        SET balance = balance - ?
        WHERE telegram_id = ?
    `).run(amount, telegramId);

    db.prepare(`
        INSERT INTO transactions (
            telegram_id,
            type,
            amount,
            note
        )
        VALUES (?, ?, ?, ?)
    `).run(
        telegramId,
        "debit",
        -amount,
        "خصم من المالك"
    );

    res.json({
        success: true,
        message: "تم خصم النقاط"
    });
});

/* =========================
   OWNER - Search User
========================= */

app.get("/api/admin/user/:id", ownerOnly, (req, res) => {

    const user = db.prepare(`
        SELECT *
        FROM users
        WHERE telegram_id = ?
    `).get(String(req.params.id));

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "المستخدم غير موجود"
        });
    }

    res.json({
        success: true,
        user
    });
});

/* =========================
   OWNER - Products
========================= */

app.post("/api/admin/products", ownerOnly, (req, res) => {

    const {
        name,
        description,
        price,
        image
    } = req.body;

    if (!name || !Number.isInteger(Number(price))) {
        return res.status(400).json({
            success: false,
            message: "اسم المنتج والسعر مطلوبان"
        });
    }

    const result = db.prepare(`
        INSERT INTO products (
            name,
            description,
            price,
            image
        )
        VALUES (?, ?, ?, ?)
    `).run(
        name,
        description || "",
        Number(price),
        image || ""
    );

    res.json({
        success: true,
        product_id: result.lastInsertRowid
    });
});

app.delete("/api/admin/products/:id", ownerOnly, (req, res) => {

    db.prepare(`
        UPDATE products
        SET active = 0
        WHERE id = ?
    `).run(Number(req.params.id));

    res.json({
        success: true
    });
});

/* =========================
   OWNER - Orders
========================= */

app.get("/api/admin/orders", ownerOnly, (req, res) => {

    const orders = db.prepare(`
        SELECT *
        FROM orders
        ORDER BY id DESC
        LIMIT 100
    `).all();

    res.json({
        success: true,
        orders
    });
});

/* =========================
   Start
========================= */

app.listen(PORT, () => {

    console.log(`
========================================
 Telegram Digital Store
========================================

 Server: http://localhost:${PORT}
 Owner: ${OWNER_ID}

========================================
`);
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));