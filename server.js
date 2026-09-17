require("dotenv").config();

const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const app = express();

/* =========================
   ENV
========================= */

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = String(process.env.OWNER_ID || "");
const WEBAPP_URL = process.env.WEBAPP_URL || "";
const PORT = Number(process.env.PORT) || 3000;

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN is missing!");
    process.exit(1);
}

if (!OWNER_ID) {
    console.error("❌ OWNER_ID is missing!");
    process.exit(1);
}

if (!WEBAPP_URL) {
    console.warn("⚠️ WEBAPP_URL is missing!");
}

const bot = new Telegraf(BOT_TOKEN);

/* =========================
   EXPRESS
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/* =========================
   DATABASE
========================= */

const db = new Database(
    path.join(__dirname, "database.db")
);

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

/* =========================
   USER
========================= */

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
        SELECT *
        FROM users
        WHERE telegram_id = ?
    `).get(id);
}

/* =========================
   OWNER
========================= */

function isOwner(id) {
    return String(id) === OWNER_ID;
}

function ownerCommand(ctx) {
    return isOwner(ctx.from.id);
}

/* =========================
   TELEGRAM WEB APP VERIFY
========================= */

function verifyTelegramWebAppData(initData) {

    if (!initData) {
        return null;
    }

    try {

        const params = new URLSearchParams(initData);

        const hash = params.get("hash");

        if (!hash) {
            return null;
        }

        params.delete("hash");

        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");

        const secretKey = crypto
            .createHmac(
                "sha256",
                "WebAppData"
            )
            .update(BOT_TOKEN)
            .digest();

        const calculatedHash = crypto
            .createHmac(
                "sha256",
                secretKey
            )
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

        if (!userData) {
            return null;
        }

        return JSON.parse(userData);

    } catch (error) {

        console.error(
            "❌ Telegram verification error:",
            error
        );

        return null;
    }
}

/* =========================
   WEB USER
========================= */

function getWebUser(req) {

    const initData =
        req.headers["x-telegram-init-data"] ||
        req.body?.initData ||
        req.query?.initData;

    return verifyTelegramWebAppData(initData);
}

/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (req, res) => {

    res.json({
        success: true,
        server: "online",
        telegram: "running",
        time: new Date().toISOString()
    });
});

/* =========================
   ROOT
========================= */

app.get("/", (req, res) => {

    res.send(`
        <html>
            <head>
                <title>Telegram Digital Store</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>

            <body style="
                background:#071321;
                color:#d9b45b;
                font-family:Arial,sans-serif;
                display:flex;
                align-items:center;
                justify-content:center;
                min-height:100vh;
                margin:0;
            ">

                <div style="text-align:center">

                    <h1>Telegram Digital Store</h1>

                    <p style="color:#aaa">
                        Server is online
                    </p>

                    <p style="color:#7ee06a">
                        ● Telegram Bot Running
                    </p>

                </div>

            </body>
        </html>
    `);
});

/* =========================================================
   TELEGRAM BOT
========================================================= */

/* =========================
   /START
========================= */

bot.start(async (ctx) => {

    try {

        const user = ctx.from;

        console.log(
            `📩 /start from ${user.id} @${user.username || "no_username"}`
        );

        ensureUser(user);

        const keyboard = Markup.inlineKeyboard([

            [
                Markup.button.webApp(
                    "🛍️ فتح المتجر",
                    WEBAPP_URL
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

    } catch (error) {

        console.error(
            "❌ /start error:",
            error
        );
    }
});

/* =========================
   MY BALANCE BUTTON
========================= */

bot.action(
    "my_balance",
    async (ctx) => {

        try {

            const user = ensureUser(
                ctx.from
            );

            await ctx.answerCbQuery();

            await ctx.reply(
                `⭐ رصيدك الحالي:

${user.balance.toLocaleString()} نقطة`
            );

        } catch (error) {

            console.error(
                "❌ Balance error:",
                error
            );
        }
    }
);

/* =========================
   /ADMIN
========================= */

bot.command(
    "admin",
    async (ctx) => {

        if (!ownerCommand(ctx)) {

            return ctx.reply(
                "⛔ هذا الأمر مخصص للمالك فقط."
            );
        }

        await ctx.reply(
`👑 لوحة تحكم المتجر

💰 الرصيد
/addpoints ID AMOUNT
/removepoints ID AMOUNT
/balance ID
/user ID

👥 المستخدمون
/users

📦 المنتجات
/products
/addproduct الاسم | الوصف | السعر | الصورة
/deleteproduct ID

🛒 الطلبات
/orders

📢 الإرسال
/broadcast الرسالة

ℹ️ المساعدة
/admin`
        );
    }
);

/* =========================
   /ADDPOINTS
========================= */

bot.command(
    "addpoints",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const args = ctx.message.text
            .split(/\s+/)
            .slice(1);

        if (args.length < 2) {

            return ctx.reply(
                `❌ الاستخدام الصحيح:

/addpoints ID AMOUNT

مثال:
/addpoints 123456789 500`
            );
        }

        const telegramId = String(args[0]);
        const amount = Number(args[1]);

        if (
            !telegramId ||
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            return ctx.reply(
                "❌ تأكد من ID والمبلغ."
            );
        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE telegram_id = ?
        `).get(telegramId);

        if (!user) {

            return ctx.reply(
                "❌ المستخدم غير موجود.\n\nيجب أن يفتح المستخدم البوت أولاً."
            );
        }

        db.prepare(`
            UPDATE users
            SET balance = balance + ?
            WHERE telegram_id = ?
        `).run(
            amount,
            telegramId
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
            telegramId,
            "credit",
            amount,
            "إضافة رصيد من المالك"
        );

        const newBalance =
            user.balance + amount;

        await ctx.reply(
`✅ تمت إضافة الرصيد

👤 المستخدم:
${user.first_name || "غير معروف"}

🆔 ID:
${telegramId}

➕ المبلغ:
${amount.toLocaleString()} نقطة

💰 الرصيد الجديد:
${newBalance.toLocaleString()} نقطة`
        );

        bot.telegram
            .sendMessage(
                telegramId,
`🎁 تم إضافة رصيد إلى حسابك

⭐ +${amount.toLocaleString()} نقطة

💰 رصيدك الحالي:
${newBalance.toLocaleString()} نقطة`
            )
            .catch(console.error);
    }
);

/* =========================
   /REMOVEPOINTS
========================= */

bot.command(
    "removepoints",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const args = ctx.message.text
            .split(/\s+/)
            .slice(1);

        if (args.length < 2) {

            return ctx.reply(
                `❌ الاستخدام الصحيح:

/removepoints ID AMOUNT

مثال:
/removepoints 123456789 100`
            );
        }

        const telegramId = String(args[0]);
        const amount = Number(args[1]);

        if (
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            return ctx.reply(
                "❌ المبلغ غير صحيح."
            );
        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE telegram_id = ?
        `).get(telegramId);

        if (!user) {

            return ctx.reply(
                "❌ المستخدم غير موجود."
            );
        }

        if (user.balance < amount) {

            return ctx.reply(
                `❌ الرصيد غير كافٍ.

💰 الرصيد الحالي:
${user.balance.toLocaleString()} نقطة`
            );
        }

        db.prepare(`
            UPDATE users
            SET balance = balance - ?
            WHERE telegram_id = ?
        `).run(
            amount,
            telegramId
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
            telegramId,
            "debit",
            -amount,
            "خصم رصيد من المالك"
        );

        const newBalance =
            user.balance - amount;

        await ctx.reply(
`✅ تم خصم الرصيد

👤 المستخدم:
${user.first_name || "غير معروف"}

🆔 ID:
${telegramId}

➖ المبلغ:
${amount.toLocaleString()} نقطة

💰 الرصيد الجديد:
${newBalance.toLocaleString()} نقطة`
        );

        bot.telegram
            .sendMessage(
                telegramId,
`⚠️ تم خصم رصيد من حسابك

⭐ -${amount.toLocaleString()} نقطة

💰 رصيدك الحالي:
${newBalance.toLocaleString()} نقطة`
            )
            .catch(console.error);
    }
);

/* =========================
   /BALANCE
========================= */

bot.command(
    "balance",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const args = ctx.message.text
            .split(/\s+/)
            .slice(1);

        const telegramId = args[0];

        if (!telegramId) {

            return ctx.reply(
                "❌ الاستخدام:\n/balance ID"
            );
        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE telegram_id = ?
        `).get(String(telegramId));

        if (!user) {

            return ctx.reply(
                "❌ المستخدم غير موجود."
            );
        }

        await ctx.reply(
`💰 معلومات الرصيد

👤 الاسم:
${user.first_name || "غير معروف"}

🔹 Username:
${user.username ? "@" + user.username : "بدون username"}

🆔 ID:
${user.telegram_id}

⭐ الرصيد:
${user.balance.toLocaleString()} نقطة`
        );
    }
);

/* =========================
   /USER
========================= */

bot.command(
    "user",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const args = ctx.message.text
            .split(/\s+/)
            .slice(1);

        const telegramId = args[0];

        if (!telegramId) {

            return ctx.reply(
                "❌ الاستخدام:\n/user ID"
            );
        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE telegram_id = ?
        `).get(String(telegramId));

        if (!user) {

            return ctx.reply(
                "❌ المستخدم غير موجود."
            );
        }

        const transactions =
            db.prepare(`
                SELECT *
                FROM transactions
                WHERE telegram_id = ?
                ORDER BY id DESC
                LIMIT 5
            `).all(String(telegramId));

        let history = "";

        if (transactions.length) {

            history = transactions
                .map((tx) => {

                    const sign =
                        tx.amount >= 0
                            ? "+"
                            : "";

                    return `${sign}${tx.amount} — ${tx.note || tx.type}`;
                })
                .join("\n");

        } else {

            history = "لا توجد عمليات.";
        }

        await ctx.reply(
`👤 معلومات المستخدم

🆔 ID:
${user.telegram_id}

👤 الاسم:
${user.first_name || "غير معروف"}

🔹 Username:
${user.username ? "@" + user.username : "بدون username"}

⭐ الرصيد:
${user.balance.toLocaleString()} نقطة

📅 التسجيل:
${user.created_at}

━━━━━━━━━━━━━━

📊 آخر العمليات:

${history}`
        );
    }
);

/* =========================
   /USERS
========================= */

bot.command(
    "users",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const count = db.prepare(`
            SELECT COUNT(*) AS total
            FROM users
        `).get();

        const totalBalance = db.prepare(`
            SELECT COALESCE(SUM(balance), 0) AS total
            FROM users
        `).get();

        const latest =
            db.prepare(`
                SELECT *
                FROM users
                ORDER BY rowid DESC
                LIMIT 10
            `).all();

        let list = "";

        latest.forEach((user, index) => {

            list +=
`${index + 1}. ${user.first_name || "بدون اسم"}
🆔 ${user.telegram_id}
⭐ ${user.balance.toLocaleString()}

`;
        });

        await ctx.reply(
`👥 إحصائيات المستخدمين

👤 عدد المستخدمين:
${count.total}

⭐ مجموع الأرصدة:
${totalBalance.total.toLocaleString()} نقطة

━━━━━━━━━━━━━━

🆕 آخر المستخدمين:

${list || "لا يوجد مستخدمون."}`
        );
    }
);

/* =========================
   /PRODUCTS
========================= */

bot.command(
    "products",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const products = db.prepare(`
            SELECT *
            FROM products
            ORDER BY id DESC
        `).all();

        if (!products.length) {

            return ctx.reply(
                "📦 لا توجد منتجات."
            );
        }

        let text =
            "📦 قائمة المنتجات\n\n";

        products.forEach((product) => {

            text +=
`#${product.id}
📦 ${product.name}
📝 ${product.description || "بدون وصف"}
⭐ ${product.price.toLocaleString()} نقطة
📌 ${product.active ? "نشط" : "متوقف"}

━━━━━━━━━━━━━━

`;
        });

        await ctx.reply(text);
    }
);

/* =========================
   /ADDPRODUCT
========================= */

bot.command(
    "addproduct",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const text = ctx.message.text
            .replace(/^\/addproduct\s*/i, "")
            .trim();

        const parts = text
            .split("|")
            .map((item) => item.trim());

        if (parts.length < 3) {

            return ctx.reply(
`❌ الصيغة الصحيحة:

/addproduct الاسم | الوصف | السعر | الصورة

مثال:

/addproduct Telegram Premium | اشتراك تيليجرام | 50 | https://example.com/image.jpg

الصورة اختيارية.`
            );
        }

        const name = parts[0];
        const description = parts[1];
        const price = Number(parts[2]);
        const image = parts[3] || "";

        if (!name) {

            return ctx.reply(
                "❌ اسم المنتج مطلوب."
            );
        }

        if (
            !Number.isInteger(price) ||
            price <= 0
        ) {

            return ctx.reply(
                "❌ السعر يجب أن يكون رقمًا صحيحًا أكبر من صفر."
            );
        }

        const result =
            db.prepare(`
                INSERT INTO products (
                    name,
                    description,
                    price,
                    image
                )
                VALUES (?, ?, ?, ?)
            `).run(
                name,
                description,
                price,
                image
            );

        await ctx.reply(
`✅ تمت إضافة المنتج

🆔 ID:
#${result.lastInsertRowid}

📦 الاسم:
${name}

📝 الوصف:
${description || "بدون وصف"}

⭐ السعر:
${price.toLocaleString()} نقطة

🖼️ الصورة:
${image || "بدون صورة"}`
        );
    }
);

/* =========================
   /DELETEPRODUCT
========================= */

bot.command(
    "deleteproduct",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const args = ctx.message.text
            .split(/\s+/)
            .slice(1);

        const productId =
            Number(args[0]);

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {

            return ctx.reply(
                "❌ الاستخدام:\n/deleteproduct ID"
            );
        }

        const product =
            db.prepare(`
                SELECT *
                FROM products
                WHERE id = ?
            `).get(productId);

        if (!product) {

            return ctx.reply(
                "❌ المنتج غير موجود."
            );
        }

        db.prepare(`
            UPDATE products
            SET active = 0
            WHERE id = ?
        `).run(productId);

        await ctx.reply(
`🗑️ تم إيقاف المنتج

🆔 #${product.id}
📦 ${product.name}`
        );
    }
);

/* =========================
   /ORDERS
========================= */

bot.command(
    "orders",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const orders =
            db.prepare(`
                SELECT *
                FROM orders
                ORDER BY id DESC
                LIMIT 20
            `).all();

        if (!orders.length) {

            return ctx.reply(
                "🛒 لا توجد طلبات حتى الآن."
            );
        }

        let text =
            "🛒 آخر الطلبات\n\n";

        orders.forEach((order) => {

            text +=
`🧾 #${order.id}
👤 ${order.telegram_id}
📦 ${order.product_name}
⭐ ${order.price.toLocaleString()} نقطة
📌 ${order.status}
📅 ${order.created_at}

━━━━━━━━━━━━━━

`;
        });

        await ctx.reply(text);
    }
);

/* =========================
   /BROADCAST
========================= */

bot.command(
    "broadcast",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply("⛔ هذا الأمر للمالك فقط.");
        }

        const message =
            ctx.message.text
                .replace(/^\/broadcast\s*/i, "")
                .trim();

        if (!message) {

            return ctx.reply(
`❌ اكتب الرسالة بعد الأمر.

مثال:

/broadcast 🔥 عرض جديد اليوم!`
            );
        }

        const users =
            db.prepare(`
                SELECT telegram_id
                FROM users
            `).all();

        await ctx.reply(
            `📢 بدء إرسال الرسالة إلى ${users.length} مستخدم...`
        );

        let success = 0;
        let failed = 0;

        for (const user of users) {

            try {

                await bot.telegram.sendMessage(
                    user.telegram_id,
                    message
                );

                success++;

                /*
                 * تأخير بسيط لتقليل ضغط الإرسال.
                 */
                await new Promise(
                    resolve =>
                        setTimeout(resolve, 80)
                );

            } catch (error) {

                failed++;

                console.error(
                    `Broadcast failed for ${user.telegram_id}:`,
                    error.message
                );
            }
        }

        await ctx.reply(
`✅ انتهى الإرسال

📨 تم الإرسال:
${success}

❌ فشل:
${failed}

👥 الإجمالي:
${users.length}`
        );
    }
);

/* =========================================================
   API - ME
========================================================= */

app.get(
    "/api/me",
    (req, res) => {

        const user = getWebUser(req);

        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "Telegram authentication required"
            });
        }

        const dbUser = ensureUser(user);

        res.json({

            success: true,

            user: {

                id: dbUser.telegram_id,

                username:
                    dbUser.username,

                first_name:
                    dbUser.first_name,

                balance:
                    dbUser.balance
            }
        });
    }
);

/* =========================================================
   API - PRODUCTS
========================================================= */

app.get(
    "/api/products",
    (req, res) => {

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
    }
);

/* =========================================================
   API - BUY
========================================================= */

app.post(
    "/api/buy",
    (req, res) => {

        try {

            const user = getWebUser(req);

            if (!user) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Telegram authentication required"
                });
            }

            const productId =
                Number(req.body.product_id);

            if (!productId) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid product"
                });
            }

            const dbUser =
                ensureUser(user);

            const product =
                db.prepare(`
                    SELECT *
                    FROM products
                    WHERE id = ?
                    AND active = 1
                `).get(productId);

            if (!product) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Product not found"
                });
            }

            if (
                dbUser.balance <
                product.price
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "رصيدك غير كافٍ"
                });
            }

            const transaction =
                db.transaction(() => {

                    db.prepare(`
                        UPDATE users
                        SET balance = balance - ?
                        WHERE telegram_id = ?
                    `).run(
                        product.price,
                        dbUser.telegram_id
                    );

                    const order =
                        db.prepare(`
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

            const orderId =
                transaction();

            bot.telegram
                .sendMessage(
                    OWNER_ID,

                    `🛒 طلب جديد

👤 العميل:
${dbUser.first_name || "غير معروف"}

🆔 ID:
${dbUser.telegram_id}

📦 المنتج:
${product.name}

⭐ السعر:
${product.price.toLocaleString()} نقطة

🧾 رقم الطلب:
#${orderId}`
                )
                .catch(console.error);

            bot.telegram
                .sendMessage(
                    dbUser.telegram_id,

                    `✅ تم إنشاء طلبك

📦 ${product.name}

⭐ ${product.price.toLocaleString()} نقطة

🧾 الطلب:
#${orderId}

سيتم التواصل معك بخصوص تنفيذ الخدمة.`
                )
                .catch(console.error);

            const updatedUser =
                db.prepare(`
                    SELECT balance
                    FROM users
                    WHERE telegram_id = ?
                `).get(
                    dbUser.telegram_id
                );

            res.json({

                success: true,

                order_id: orderId,

                balance:
                    updatedUser.balance
            });

        } catch (error) {

            console.error(
                "❌ Buy error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "حدث خطأ أثناء تنفيذ الطلب"
            });
        }
    }
);

/* =========================================================
   OWNER AUTH
========================================================= */

function ownerOnly(
    req,
    res,
    next
) {

    const user =
        getWebUser(req);

    if (!user) {

        return res.status(401).json({
            success: false,
            message:
                "Authentication required"
        });
    }

    if (!isOwner(user.id)) {

        return res.status(403).json({
            success: false,
            message:
                "Owner only"
        });
    }

    req.owner = user;

    next();
}

/* =========================================================
   OWNER - ADD POINTS API
========================================================= */

app.post(
    "/api/admin/add-points",
    ownerOnly,
    (req, res) => {

        const telegramId =
            String(
                req.body.telegram_id || ""
            );

        const amount =
            Number(req.body.amount);

        const note =
            req.body.note ||
            "إضافة رصيد";

        if (
            !telegramId ||
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "بيانات غير صحيحة"
            });
        }

        const user =
            db.prepare(`
                SELECT *
                FROM users
                WHERE telegram_id = ?
            `).get(telegramId);

        if (!user) {

            return res.status(404).json({
                success: false,
                message:
                    "المستخدم غير موجود. يجب أن يفتح البوت أولاً."
            });
        }

        db.prepare(`
            UPDATE users
            SET balance = balance + ?
            WHERE telegram_id = ?
        `).run(
            amount,
            telegramId
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
            telegramId,
            "credit",
            amount,
            note
        );

        const newBalance =
            user.balance + amount;

        bot.telegram
            .sendMessage(
                telegramId,

                `🎁 تم إضافة رصيد إلى حسابك

⭐ +${amount.toLocaleString()} نقطة

💰 رصيدك الحالي:
${newBalance.toLocaleString()} نقطة`
            )
            .catch(console.error);

        res.json({

            success: true,

            message:
                "تمت إضافة النقاط",

            balance:
                newBalance
        });
    }
);

/* =========================================================
   OWNER - REMOVE POINTS API
========================================================= */

app.post(
    "/api/admin/remove-points",
    ownerOnly,
    (req, res) => {

        const telegramId =
            String(
                req.body.telegram_id || ""
            );

        const amount =
            Number(req.body.amount);

        if (
            !telegramId ||
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "بيانات غير صحيحة"
            });
        }

        const user =
            db.prepare(`
                SELECT *
                FROM users
                WHERE telegram_id = ?
            `).get(telegramId);

        if (!user) {

            return res.status(404).json({
                success: false,
                message:
                    "المستخدم غير موجود"
            });
        }

        if (
            user.balance < amount
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "رصيد المستخدم غير كافٍ"
            });
        }

        db.prepare(`
            UPDATE users
            SET balance = balance - ?
            WHERE telegram_id = ?
        `).run(
            amount,
            telegramId
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
            telegramId,
            "debit",
            -amount,
            "خصم من المالك"
        );

        const newBalance =
            user.balance - amount;

        bot.telegram
            .sendMessage(
                telegramId,

                `⚠️ تم خصم رصيد من حسابك

⭐ -${amount.toLocaleString()} نقطة

💰 رصيدك الحالي:
${newBalance.toLocaleString()} نقطة`
            )
            .catch(console.error);

        res.json({

            success: true,

            message:
                "تم خصم النقاط",

            balance:
                newBalance
        });
    }
);

/* =========================================================
   OWNER - SEARCH USER API
========================================================= */

app.get(
    "/api/admin/user/:id",
    ownerOnly,
    (req, res) => {

        const user =
            db.prepare(`
                SELECT *
                FROM users
                WHERE telegram_id = ?
            `).get(
                String(req.params.id)
            );

        if (!user) {

            return res.status(404).json({
                success: false,
                message:
                    "المستخدم غير موجود"
            });
        }

        res.json({

            success: true,

            user
        });
    }
);

/* =========================================================
   OWNER - ADD PRODUCT API
========================================================= */

app.post(
    "/api/admin/products",
    ownerOnly,
    (req, res) => {

        const {
            name,
            description,
            price,
            image
        } = req.body;

        if (
            !name ||
            !Number.isInteger(
                Number(price)
            ) ||
            Number(price) <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "اسم المنتج والسعر مطلوبان"
            });
        }

        const result =
            db.prepare(`
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

            product_id:
                result.lastInsertRowid
        });
    }
);

/* =========================================================
   OWNER - DELETE PRODUCT API
========================================================= */

app.delete(
    "/api/admin/products/:id",
    ownerOnly,
    (req, res) => {

        db.prepare(`
            UPDATE products
            SET active = 0
            WHERE id = ?
        `).run(
            Number(req.params.id)
        );

        res.json({
            success: true
        });
    }
);

/* =========================================================
   OWNER - ORDERS API
========================================================= */

app.get(
    "/api/admin/orders",
    ownerOnly,
    (req, res) => {

        const orders =
            db.prepare(`
                SELECT *
                FROM orders
                ORDER BY id DESC
                LIMIT 100
            `).all();

        res.json({

            success: true,

            orders
        });
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "❌ Express error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Internal server error"
        });
    }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "🚀 Telegram Digital Store"
        );
        console.log(
            "========================================"
        );
        console.log(
            `🌐 Port: ${PORT}`
        );
        console.log(
            `👑 Owner: ${OWNER_ID}`
        );
        console.log(
            `🌐 WebApp: ${WEBAPP_URL}`
        );
        console.log(
            "========================================"
        );
        console.log("");
    }
);

/* =========================================================
   START TELEGRAM
========================================================= */

async function startTelegram() {

    try {

        console.log(
            "🤖 Connecting to Telegram..."
        );

        const botInfo =
            await bot.telegram.getMe();

        console.log(
            "✅ Telegram connected"
        );

        console.log(
            `🤖 Bot: @${botInfo.username}`
        );

        console.log(
            `🆔 Bot ID: ${botInfo.id}`
        );

        await bot.launch();

        console.log(
            "✅ Telegram bot is running"
        );

        console.log(
            "📩 Waiting for messages..."
        );

    } catch (error) {

        console.error("");
        console.error(
            "========================================"
        );
        console.error(
            "❌ TELEGRAM BOT ERROR"
        );
        console.error(
            "========================================"
        );
        console.error(error);
        console.error(
            "========================================"
        );
        console.error("");
    }
}

startTelegram();

/* =========================================================
   SHUTDOWN
========================================================= */

process.once(
    "SIGINT",
    () => {

        console.log(
            "🛑 Stopping Telegram bot..."
        );

        bot.stop("SIGINT");
    }
);

process.once(
    "SIGTERM",
    () => {

        console.log(
            "🛑 Stopping Telegram bot..."
        );

        bot.stop("SIGTERM");
    }
);