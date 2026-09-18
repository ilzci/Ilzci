require("dotenv").config();

const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const app = express();

/* =========================================================
   ENV
========================================================= */

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

/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/* =========================================================
   DATABASE
========================================================= */

const db = new Database(
    path.join(__dirname, "database.db")
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* =========================================================
   BASE TABLES
========================================================= */

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
    delivery_type TEXT DEFAULT 'service',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    delivery_type TEXT DEFAULT 'service',
    code_id INTEGER DEFAULT NULL,
    code_value TEXT DEFAULT '',
    username TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    balance_before INTEGER DEFAULT 0,
    balance_after INTEGER DEFAULT 0,
    completed_at DATETIME DEFAULT NULL,
    rejected_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT DEFAULT '',
    order_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    order_id INTEGER DEFAULT NULL,
    sold_to TEXT DEFAULT '',
    sold_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_codes_unique_code
ON product_codes(product_id, code);

CREATE INDEX IF NOT EXISTS idx_product_codes_product_status
ON product_codes(product_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_telegram
ON orders(telegram_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders(status);

/*
 * حماية من تكرار عملية الشراء.
 *
 * client_request_id يتم إنشاؤه في الواجهة
 * لكل عملية شراء جديدة.
 *
 * إذا تكرر نفس الطلب فلن يتم خصم الرصيد مرة أخرى.
 */
CREATE TABLE IF NOT EXISTS purchase_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT NOT NULL UNIQUE,
    telegram_id TEXT NOT NULL,
    order_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_user
ON purchase_requests(telegram_id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_order
ON purchase_requests(order_id);
`);

/* =========================================================
   DATABASE MIGRATIONS
========================================================= */

function addColumnIfMissing(
    table,
    column,
    definition
) {
    const columns = db
        .prepare(`PRAGMA table_info(${table})`)
        .all();

    const exists = columns.some(
        (item) => item.name === column
    );

    if (!exists) {

        try {

            db.exec(
                `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
            );

            console.log(
                `✅ Added database column: ${table}.${column}`
            );

        } catch (error) {

            console.error(
                `❌ Could not add ${table}.${column}:`,
                error.message
            );
        }
    }
}

addColumnIfMissing(
    "products",
    "delivery_type",
    "TEXT DEFAULT 'service'"
);

addColumnIfMissing(
    "orders",
    "delivery_type",
    "TEXT DEFAULT 'service'"
);

addColumnIfMissing(
    "orders",
    "code_id",
    "INTEGER DEFAULT NULL"
);

addColumnIfMissing(
    "orders",
    "code_value",
    "TEXT DEFAULT ''"
);

addColumnIfMissing(
    "orders",
    "username",
    "TEXT DEFAULT ''"
);

addColumnIfMissing(
    "orders",
    "first_name",
    "TEXT DEFAULT ''"
);

addColumnIfMissing(
    "orders",
    "balance_before",
    "INTEGER DEFAULT 0"
);

addColumnIfMissing(
    "orders",
    "balance_after",
    "INTEGER DEFAULT 0"
);

addColumnIfMissing(
    "orders",
    "completed_at",
    "DATETIME DEFAULT NULL"
);

addColumnIfMissing(
    "orders",
    "rejected_at",
    "DATETIME DEFAULT NULL"
);

addColumnIfMissing(
    "transactions",
    "order_id",
    "INTEGER DEFAULT NULL"
);

/* =========================================================
   NORMALIZE OLD PRODUCTS
========================================================= */

try {

    db.prepare(`
        UPDATE products
        SET delivery_type = 'service'
        WHERE delivery_type IS NULL
        OR delivery_type = ''
    `).run();

} catch (error) {

    console.error(
        "❌ Product migration error:",
        error
    );
}

/* =========================================================
   HELPERS
========================================================= */

function formatNumber(value) {

    return Number(value || 0)
        .toLocaleString("en-US");
}

function formatMoney(value) {

    return `${formatNumber(value)} د.ل`;
}

function normalizeDeliveryType(value) {

    return String(value || "service")
        .toLowerCase()
        .trim() === "code"
        ? "code"
        : "service";
}

function nowText() {

    return new Date()
        .toLocaleString("en-GB", {
            timeZone: "Africa/Tripoli",
            hour12: false
        });
}

function safeText(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/*
 * التحقق من client_request_id.
 */
function normalizeClientRequestId(value) {

    const id =
        String(value || "")
            .trim();

    if (
        !id ||
        id.length < 8 ||
        id.length > 100
    ) {
        return null;
    }

    /*
     * نسمح فقط بحروف وأرقام وبعض الرموز
     * الشائعة في UUID / request IDs.
     */
    if (
        !/^[a-zA-Z0-9._:-]+$/.test(id)
    ) {
        return null;
    }

    return id;
}

/* =========================================================
   USER
========================================================= */

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

/* =========================================================
   OWNER
========================================================= */

function isOwner(id) {

    return String(id) === OWNER_ID;
}

function ownerCommand(ctx) {

    return isOwner(ctx.from.id);
}

/* =========================================================
   TELEGRAM WEB APP VERIFY
========================================================= */

function verifyTelegramWebAppData(initData) {

    if (!initData) {
        return null;
    }

    try {

        const params =
            new URLSearchParams(initData);

        const hash =
            params.get("hash");

        if (!hash) {
            return null;
        }

        params.delete("hash");

        const authDate =
            Number(params.get("auth_date"));

        const currentTime =
            Math.floor(Date.now() / 1000);

        /*
         * منع initData القديمة جدًا.
         * 24 ساعة.
         */
        if (
            !Number.isFinite(authDate) ||
            currentTime - authDate > 86400
        ) {

            console.warn(
                "⚠️ Telegram initData expired"
            );

            return null;
        }

        /*
         * حماية إضافية من auth_date مستقبلي
         * بشكل غير منطقي.
         */
        if (
            authDate > currentTime + 60
        ) {

            console.warn(
                "⚠️ Telegram initData has future auth_date"
            );

            return null;
        }

        const dataCheckString =
            [...params.entries()]
                .sort(([a], [b]) =>
                    a.localeCompare(b)
                )
                .map(
                    ([key, value]) =>
                        `${key}=${value}`
                )
                .join("\n");

        const secretKey =
            crypto
                .createHmac(
                    "sha256",
                    "WebAppData"
                )
                .update(BOT_TOKEN)
                .digest();

        const calculatedHash =
            crypto
                .createHmac(
                    "sha256",
                    secretKey
                )
                .update(dataCheckString)
                .digest("hex");

        if (
            calculatedHash.length !==
            hash.length
        ) {
            return null;
        }

        if (
            !crypto.timingSafeEqual(
                Buffer.from(calculatedHash),
                Buffer.from(hash)
            )
        ) {
            return null;
        }

        const userData =
            params.get("user");

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

/* =========================================================
   WEB USER
========================================================= */

function getWebUser(req) {

    const initData =
        req.headers["x-telegram-init-data"] ||
        req.body?.initData ||
        req.query?.initData;

    return verifyTelegramWebAppData(
        initData
    );
}

/* =========================================================
   SEND TELEGRAM SAFELY
========================================================= */

async function sendTelegramMessage(
    chatId,
    message,
    extra = undefined
) {

    try {

        return await bot.telegram.sendMessage(
            String(chatId),
            message,
            extra
        );

    } catch (error) {

        console.error(
            `❌ Telegram message failed for ${chatId}:`,
            error.message
        );

        return null;
    }
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
    "/health",
    (req, res) => {

        res.json({
            success: true,
            server: "online",
            telegram: "running",
            database: "online",
            time: new Date().toISOString()
        });
    }
);

/* =========================================================
   ROOT
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.send(`
            <html>
                <head>
                    <title>Telegram Digital Store</title>
                    <meta charset="UTF-8">
                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1.0"
                    >
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

                        <h1>
                            Telegram Digital Store
                        </h1>

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
    }
);

/* =========================================================
   TELEGRAM BOT
========================================================= */

/* =========================================================
   /START
========================================================= */

bot.start(
    async (ctx) => {

        try {

            const user =
                ctx.from;

            console.log(
                `📩 /start from ${user.id} @${user.username || "no_username"}`
            );

            const dbUser =
                ensureUser(user);

            const keyboard =
                Markup.inlineKeyboard([

                    [
                        Markup.button.webApp(
                            "🛍️ فتح المتجر",
                            WEBAPP_URL
                        )
                    ],

                    [
                        Markup.button.callback(
                            "💰 رصيدي",
                            "my_balance"
                        )
                    ]

                ]);

            await ctx.reply(
                `مرحباً ${user.first_name || ""} 👋

🛍️ أهلاً بك في المتجر الرقمي.

يمكنك استخدام رصيدك لشراء الخدمات والمنتجات المتوفرة داخل المتجر.

💰 رصيدك الحالي:
${formatMoney(dbUser.balance)}`,
                keyboard
            );

        } catch (error) {

            console.error(
                "❌ /start error:",
                error
            );
        }
    }
);

/* =========================================================
   MY BALANCE
========================================================= */

bot.action(
    "my_balance",
    async (ctx) => {

        try {

            const user =
                ensureUser(ctx.from);

            await ctx.answerCbQuery();

            await ctx.reply(
                `💰 رصيدك الحالي:

${formatMoney(user.balance)}`
            );

        } catch (error) {

            console.error(
                "❌ Balance error:",
                error
            );
        }
    }
);

/* =========================================================
   ADMIN HELP
========================================================= */

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
/addproduct الاسم | الوصف | السعر | الصورة | النوع
/deleteproduct ID

🔑 أكواد المنتجات

/addcode PRODUCT_ID CODE
/codes PRODUCT_ID

🛒 الطلبات

/orders

📢 الإرسال

/broadcast الرسالة

ℹ️ النوع:

service = تنفيذ يدوي
code = تسليم كود تلقائي

مثال:

/addproduct Netflix | اشتراك Netflix | 50 | https://example.com/image.jpg | service

أو:

/addproduct Windows 11 | مفتاح Windows 11 | 100 | https://example.com/image.jpg | code`
        );
    }
);

/* =========================================================
   /ADDPOINTS
========================================================= */

bot.command(
    "addpoints",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const args =
            ctx.message.text
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

        const telegramId =
            String(args[0]);

        const amount =
            Number(args[1]);

        if (
            !telegramId ||
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            return ctx.reply(
                "❌ تأكد من ID والمبلغ."
            );
        }

        const user =
            db.prepare(`
                SELECT *
                FROM users
                WHERE telegram_id = ?
            `).get(telegramId);

        if (!user) {

            return ctx.reply(
                "❌ المستخدم غير موجود.\n\nيجب أن يفتح المستخدم البوت أولاً."
            );
        }

        const transaction =
            db.transaction(() => {

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
            });

        transaction();

        const newBalance =
            db.prepare(`
                SELECT balance
                FROM users
                WHERE telegram_id = ?
            `).get(telegramId).balance;

        await ctx.reply(
`✅ تمت إضافة الرصيد

👤 المستخدم:
${user.first_name || "غير معروف"}

🆔 ID:
${telegramId}

➕ المبلغ:
${formatMoney(amount)}

💰 الرصيد الجديد:
${formatMoney(newBalance)}`
        );

        sendTelegramMessage(
            telegramId,

`🎁 تم إضافة رصيد إلى حسابك

💰 +${formatMoney(amount)}

رصيدك الحالي:
${formatMoney(newBalance)}`
        );
    }
);

/* =========================================================
   /REMOVEPOINTS
========================================================= */

bot.command(
    "removepoints",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const args =
            ctx.message.text
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

        const telegramId =
            String(args[0]);

        const amount =
            Number(args[1]);

        if (
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            return ctx.reply(
                "❌ المبلغ غير صحيح."
            );
        }

        const user =
            db.prepare(`
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
${formatMoney(user.balance)}`
            );
        }

        const transaction =
            db.transaction(() => {

                const result =
                    db.prepare(`
                        UPDATE users
                        SET balance = balance - ?
                        WHERE telegram_id = ?
                        AND balance >= ?
                    `).run(
                        amount,
                        telegramId,
                        amount
                    );

                if (result.changes !== 1) {
                    throw new Error(
                        "BALANCE_UPDATE_FAILED"
                    );
                }

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
            });

        transaction();

        const newBalance =
            db.prepare(`
                SELECT balance
                FROM users
                WHERE telegram_id = ?
            `).get(telegramId).balance;

        await ctx.reply(
`✅ تم خصم الرصيد

👤 المستخدم:
${user.first_name || "غير معروف"}

🆔 ID:
${telegramId}

➖ المبلغ:
${formatMoney(amount)}

💰 الرصيد الجديد:
${formatMoney(newBalance)}`
        );

        sendTelegramMessage(
            telegramId,

`⚠️ تم خصم رصيد من حسابك

💰 -${formatMoney(amount)}

رصيدك الحالي:
${formatMoney(newBalance)}`
        );
    }
);

/* =========================================================
   /BALANCE
========================================================= */

bot.command(
    "balance",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const args =
            ctx.message.text
                .split(/\s+/)
                .slice(1);

        const telegramId =
            args[0];

        if (!telegramId) {

            return ctx.reply(
                "❌ الاستخدام:\n/balance ID"
            );
        }

        const user =
            db.prepare(`
                SELECT *
                FROM users
                WHERE telegram_id = ?
            `).get(
                String(telegramId)
            );

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
${user.username
    ? "@" + user.username
    : "بدون username"}

🆔 ID:
${user.telegram_id}

💰 الرصيد:
${formatMoney(user.balance)}`
        );
    }
);

/* =========================================================
   /USER
========================================================= */

bot.command(
    "user",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const args =
            ctx.message.text
                .split(/\s+/)
                .slice(1);

        const telegramId =
            args[0];

        if (!telegramId) {

            return ctx.reply(
                "❌ الاستخدام:\n/user ID"
            );
        }

        const user =
            db.prepare(`
                SELECT *
                FROM users
                WHERE telegram_id = ?
            `).get(
                String(telegramId)
            );

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
            `).all(
                String(telegramId)
            );

        let history = "";

        if (transactions.length) {

            history =
                transactions
                    .map((tx) => {

                        const sign =
                            tx.amount >= 0
                                ? "+"
                                : "";

                        return `${sign}${formatMoney(Math.abs(tx.amount))} — ${tx.note || tx.type}`;
                    })
                    .join("\n");

        } else {

            history =
                "لا توجد عمليات.";
        }

        await ctx.reply(
`👤 معلومات المستخدم

🆔 ID:
${user.telegram_id}

👤 الاسم:
${user.first_name || "غير معروف"}

🔹 Username:
${user.username
    ? "@" + user.username
    : "بدون username"}

💰 الرصيد:
${formatMoney(user.balance)}

📅 التسجيل:
${user.created_at}

━━━━━━━━━━━━━━

📊 آخر العمليات:

${history}`
        );
    }
);

/* =========================================================
   /USERS
========================================================= */

bot.command(
    "users",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const count =
            db.prepare(`
                SELECT COUNT(*) AS total
                FROM users
            `).get();

        const totalBalance =
            db.prepare(`
                SELECT COALESCE(
                    SUM(balance),
                    0
                ) AS total
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

        latest.forEach(
            (user, index) => {

                list +=
`${index + 1}. ${user.first_name || "بدون اسم"}
🆔 ${user.telegram_id}
💰 ${formatMoney(user.balance)}

`;
            }
        );

        await ctx.reply(
`👥 إحصائيات المستخدمين

👤 عدد المستخدمين:
${count.total}

💰 مجموع الأرصدة:
${formatMoney(totalBalance.total)}

━━━━━━━━━━━━━━

🆕 آخر المستخدمين:

${list || "لا يوجد مستخدمون."}`
        );
    }
);

/* =========================================================
   /PRODUCTS
========================================================= */

bot.command(
    "products",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const products =
            db.prepare(`
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

        products.forEach(
            (product) => {

                const type =
                    normalizeDeliveryType(
                        product.delivery_type
                    );

                let stockText = "";

                if (type === "code") {

                    const stock =
                        db.prepare(`
                            SELECT COUNT(*) AS total
                            FROM product_codes
                            WHERE product_id = ?
                            AND status = 'available'
                        `).get(product.id);

                    stockText =
                        `\n🔑 المخزون: ${stock.total}`;
                }

                text +=
`#${product.id}
📦 ${product.name}
📝 ${product.description || "بدون وصف"}
💰 ${formatMoney(product.price)}
⚙️ النوع: ${type === "code" ? "كود تلقائي" : "خدمة يدوية"}
📌 ${product.active ? "نشط" : "متوقف"}${stockText}

━━━━━━━━━━━━━━

`;
            }
        );

        await ctx.reply(text);
    }
);

/* =========================================================
   /ADDPRODUCT
========================================================= */

bot.command(
    "addproduct",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const text =
            ctx.message.text
                .replace(
                    /^\/addproduct\s*/i,
                    ""
                )
                .trim();

        const parts =
            text
                .split("|")
                .map(
                    (item) =>
                        item.trim()
                );

        if (parts.length < 3) {

            return ctx.reply(
`❌ الصيغة الصحيحة:

/addproduct الاسم | الوصف | السعر | الصورة | النوع

النوع:
service = خدمة يدوية
code = كود تلقائي

مثال خدمة:

/addproduct Telegram Premium | اشتراك تيليجرام | 50 | https://example.com/image.jpg | service

مثال كود:

/addproduct Windows 11 | مفتاح Windows 11 | 100 | https://example.com/image.jpg | code

الصورة والنوع اختياريان.`
            );
        }

        const name =
            parts[0];

        const description =
            parts[1] || "";

        const price =
            Number(parts[2]);

        const image =
            parts[3] || "";

        const deliveryType =
            normalizeDeliveryType(
                parts[4] || "service"
            );

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
                    image,
                    delivery_type
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                name,
                description,
                price,
                image,
                deliveryType
            );

        await ctx.reply(
`✅ تمت إضافة المنتج

🆔 ID:
#${result.lastInsertRowid}

📦 الاسم:
${name}

📝 الوصف:
${description || "بدون وصف"}

💰 السعر:
${formatMoney(price)}

⚙️ النوع:
${deliveryType === "code"
    ? "🔑 كود تلقائي"
    : "🛠️ خدمة يدوية"}

🖼️ الصورة:
${image || "بدون صورة"}

${
    deliveryType === "code"
        ? "\n💡 الآن أضف الأكواد:\n/addcode " +
          result.lastInsertRowid +
          " CODE"
        : ""
}`
        );
    }
);

/* =========================================================
   /ADDCODE
========================================================= */

bot.command(
    "addcode",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const args =
            ctx.message.text
                .replace(
                    /^\/addcode\s*/i,
                    ""
                )
                .trim();

        const firstSpace =
            args.indexOf(" ");

        if (firstSpace === -1) {

            return ctx.reply(
`❌ الاستخدام الصحيح:

/addcode PRODUCT_ID CODE

مثال:

/addcode 5 XXXXX-XXXXX-XXXXX`
            );
        }

        const productId =
            Number(
                args.slice(0, firstSpace)
            );

        const code =
            args
                .slice(firstSpace + 1)
                .trim();

        if (
            !Number.isInteger(productId) ||
            productId <= 0 ||
            !code
        ) {

            return ctx.reply(
                "❌ بيانات الكود غير صحيحة."
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

        if (
            normalizeDeliveryType(
                product.delivery_type
            ) !== "code"
        ) {

            return ctx.reply(
`❌ هذا المنتج ليس من نوع الأكواد.

قم بتعديله إلى code أولاً.`
            );
        }

        try {

            const result =
                db.prepare(`
                    INSERT INTO product_codes (
                        product_id,
                        code
                    )
                    VALUES (?, ?)
                `).run(
                    productId,
                    code
                );

            const stock =
                db.prepare(`
                    SELECT COUNT(*) AS total
                    FROM product_codes
                    WHERE product_id = ?
                    AND status = 'available'
                `).get(productId);

            await ctx.reply(
`✅ تم إضافة الكود

📦 المنتج:
${product.name}

🆔 Code ID:
#${result.lastInsertRowid}

🔑 الكود:
${code}

📊 المخزون الحالي:
${stock.total}`
            );

        } catch (error) {

            if (
                String(error.message)
                    .includes("UNIQUE")
            ) {

                return ctx.reply(
                    "❌ هذا الكود موجود مسبقًا لهذا المنتج."
                );
            }

            console.error(
                "❌ Add code error:",
                error
            );

            return ctx.reply(
                "❌ حدث خطأ أثناء إضافة الكود."
            );
        }
    }
);

/* =========================================================
   /CODES
========================================================= */

bot.command(
    "codes",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const productId =
            Number(
                ctx.message.text
                    .split(/\s+/)[1]
            );

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {

            return ctx.reply(
                "❌ الاستخدام:\n/codes PRODUCT_ID"
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

        const stats =
            db.prepare(`
                SELECT
                    COUNT(*) AS total,
                    SUM(
                        CASE
                            WHEN status = 'available'
                            THEN 1
                            ELSE 0
                        END
                    ) AS available,
                    SUM(
                        CASE
                            WHEN status = 'sold'
                            THEN 1
                            ELSE 0
                        END
                    ) AS sold
                FROM product_codes
                WHERE product_id = ?
            `).get(productId);

        const availableCodes =
            db.prepare(`
                SELECT id, code, created_at
                FROM product_codes
                WHERE product_id = ?
                AND status = 'available'
                ORDER BY id ASC
                LIMIT 30
            `).all(productId);

        let list = "";

        availableCodes.forEach(
            (item) => {

                list +=
`#${item.id} — ${item.code}
`;
            }
        );

        await ctx.reply(
`🔑 أكواد المنتج

📦 ${product.name}

📊 الإجمالي:
${stats.total || 0}

🟢 المتاح:
${stats.available || 0}

🔴 المباع:
${stats.sold || 0}

━━━━━━━━━━━━━━

${list || "لا توجد أكواد متاحة."}

${Number(stats.available || 0) > 30
    ? "\n⚠️ تم عرض أول 30 كود فقط."
    : ""}`
        );
    }
);

/* =========================================================
   /DELETEPRODUCT
========================================================= */

bot.command(
    "deleteproduct",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const productId =
            Number(
                ctx.message.text
                    .split(/\s+/)[1]
            );

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

/* =========================================================
   /ORDERS
========================================================= */

bot.command(
    "orders",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const orders =
            db.prepare(`
                SELECT *
                FROM orders
                ORDER BY id DESC
                LIMIT 30
            `).all();

        if (!orders.length) {

            return ctx.reply(
                "🛒 لا توجد طلبات حتى الآن."
            );
        }

        let text =
            "🛒 آخر الطلبات\n\n";

        orders.forEach(
            (order) => {

                const status =
                    order.status === "pending"
                        ? "⏳ قيد التنفيذ"
                        : order.status === "completed"
                            ? "✅ مكتمل"
                            : order.status === "rejected"
                                ? "❌ مرفوض"
                                : order.status;

                text +=
`🧾 #${order.id}
👤 ${order.first_name || "غير معروف"}
🔹 ${order.username
    ? "@" + order.username
    : "بدون username"}
🆔 ${order.telegram_id}

📦 ${order.product_name}
💰 ${formatMoney(order.price)}

📌 ${status}
📅 ${order.created_at}

━━━━━━━━━━━━━━

`;
            }
        );

        await ctx.reply(text);
    }
);

/* =========================================================
   ORDER OWNER MESSAGE
========================================================= */

function buildOwnerOrderMessage(
    order
) {

    const status =
        order.status === "pending"
            ? "⏳ قيد التنفيذ"
            : order.status === "completed"
                ? "✅ مكتمل"
                : order.status === "rejected"
                    ? "❌ مرفوض"
                    : order.status;

    return (
`🛒 طلب جديد

━━━━━━━━━━━━━━

🧾 رقم الطلب:
#${order.id}

👤 العميل:
${order.first_name || "غير معروف"}

🔹 Username:
${order.username
    ? "@" + order.username
    : "بدون username"}

🆔 Telegram ID:
${order.telegram_id}

━━━━━━━━━━━━━━

📦 المنتج:
${order.product_name}

💰 السعر:
${formatMoney(order.price)}

⚙️ النوع:
${order.delivery_type === "code"
    ? "🔑 كود تلقائي"
    : "🛠️ خدمة يدوية"}

━━━━━━━━━━━━━━

💰 الرصيد قبل:
${formatMoney(order.balance_before)}

💰 الرصيد بعد:
${formatMoney(order.balance_after)}

📌 الحالة:
${status}

📅 الوقت:
${order.created_at}`
    );
}

/* =========================================================
   SEND OWNER ORDER
========================================================= */

async function notifyOwnerNewOrder(
    order
) {

    const buttons = [];

    if (
        order.status === "pending" &&
        order.delivery_type === "service"
    ) {

        buttons.push([
            Markup.button.callback(
                "✅ تم التنفيذ",
                `order_complete:${order.id}`
            )
        ]);

        buttons.push([
            Markup.button.callback(
                "❌ رفض واسترجاع الرصيد",
                `order_reject:${order.id}`
            )
        ]);
    }

    if (order.username) {

        buttons.push([
            Markup.button.url(
                "👤 التواصل مع العميل",
                `https://t.me/${order.username.replace("@", "")}`
            )
        ]);

    } else {

        buttons.push([
            Markup.button.url(
                "👤 فتح محادثة العميل",
                `tg://user?id=${order.telegram_id}`
            )
        ]);
    }

    await sendTelegramMessage(
        OWNER_ID,
        buildOwnerOrderMessage(order),
        buttons.length
            ? Markup.inlineKeyboard(buttons)
            : undefined
    );
}

/* =========================================================
   ORDER COMPLETE
========================================================= */

bot.action(
    /^order_complete:(\d+)$/,
    async (ctx) => {

        if (!isOwner(ctx.from.id)) {

            return ctx.answerCbQuery(
                "⛔ غير مصرح",
                {
                    show_alert: true
                }
            );
        }

        const orderId =
            Number(ctx.match[1]);

        try {

            const result =
                db.transaction(() => {

                    const order =
                        db.prepare(`
                            SELECT *
                            FROM orders
                            WHERE id = ?
                        `).get(orderId);

                    if (!order) {

                        return {
                            error:
                                "الطلب غير موجود."
                        };
                    }

                    if (
                        order.status !== "pending"
                    ) {

                        return {
                            error:
                                `الطلب ليس قيد التنفيذ.\nالحالة الحالية: ${order.status}`
                        };
                    }

                    db.prepare(`
                        UPDATE orders
                        SET
                            status = 'completed',
                            completed_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        AND status = 'pending'
                    `).run(orderId);

                    return {
                        order
                    };
                })();

            if (result.error) {

                return ctx.answerCbQuery(
                    result.error,
                    {
                        show_alert: true
                    }
                );
            }

            await ctx.answerCbQuery(
                "✅ تم تنفيذ الطلب"
            );

            await ctx.editMessageText(
`${buildOwnerOrderMessage({
    ...result.order,
    status: "completed"
})}

━━━━━━━━━━━━━━

✅ تم تعليم الطلب كمكتمل.`
            );

            await sendTelegramMessage(
                result.order.telegram_id,

`✅ تم تنفيذ طلبك

🧾 الطلب:
#${result.order.id}

📦 المنتج:
${result.order.product_name}

💰 السعر:
${formatMoney(result.order.price)}

شكراً لطلبك من متجرنا ❤️`
            );

        } catch (error) {

            console.error(
                "❌ Complete order error:",
                error
            );

            await ctx.answerCbQuery(
                "حدث خطأ",
                {
                    show_alert: true
                }
            );
        }
    }
);

/* =========================================================
   ORDER REJECT + REFUND
========================================================= */

bot.action(
    /^order_reject:(\d+)$/,
    async (ctx) => {

        if (!isOwner(ctx.from.id)) {

            return ctx.answerCbQuery(
                "⛔ غير مصرح",
                {
                    show_alert: true
                }
            );
        }

        const orderId =
            Number(ctx.match[1]);

        try {

            const result =
                db.transaction(() => {

                    const order =
                        db.prepare(`
                            SELECT *
                            FROM orders
                            WHERE id = ?
                        `).get(orderId);

                    if (!order) {

                        return {
                            error:
                                "الطلب غير موجود."
                        };
                    }

                    if (
                        order.status !== "pending"
                    ) {

                        return {
                            error:
                                `تمت معالجة الطلب مسبقًا.\nالحالة: ${order.status}`
                        };
                    }

                    const user =
                        db.prepare(`
                            SELECT *
                            FROM users
                            WHERE telegram_id = ?
                        `).get(
                            order.telegram_id
                        );

                    if (!user) {

                        throw new Error(
                            "العميل غير موجود في قاعدة البيانات."
                        );
                    }

                    db.prepare(`
                        UPDATE users
                        SET balance = balance + ?
                        WHERE telegram_id = ?
                    `).run(
                        order.price,
                        order.telegram_id
                    );

                    db.prepare(`
                        UPDATE orders
                        SET
                            status = 'rejected',
                            rejected_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        AND status = 'pending'
                    `).run(orderId);

                    db.prepare(`
                        INSERT INTO transactions (
                            telegram_id,
                            type,
                            amount,
                            note,
                            order_id
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `).run(
                        order.telegram_id,
                        "refund",
                        order.price,
                        `استرجاع طلب #${order.id}`,
                        order.id
                    );

                    const updatedUser =
                        db.prepare(`
                            SELECT balance
                            FROM users
                            WHERE telegram_id = ?
                        `).get(
                            order.telegram_id
                        );

                    return {
                        order,
                        newBalance:
                            updatedUser.balance
                    };
                })();

            if (result.error) {

                return ctx.answerCbQuery(
                    result.error,
                    {
                        show_alert: true
                    }
                );
            }

            await ctx.answerCbQuery(
                "❌ تم رفض الطلب وإرجاع الرصيد"
            );

            await ctx.editMessageText(
`${buildOwnerOrderMessage({
    ...result.order,
    status: "rejected"
})}

━━━━━━━━━━━━━━

❌ تم رفض الطلب

💰 تم استرجاع:
${formatMoney(result.order.price)}`
            );

            await sendTelegramMessage(
                result.order.telegram_id,

`❌ تم رفض طلبك

🧾 الطلب:
#${result.order.id}

📦 المنتج:
${result.order.product_name}

💰 تم استرجاع:
${formatMoney(result.order.price)}

💰 رصيدك الحالي:
${formatMoney(result.newBalance)}

يمكنك التواصل مع الدعم إذا كان لديك استفسار.`
            );

        } catch (error) {

            console.error(
                "❌ Reject order error:",
                error
            );

            await ctx.answerCbQuery(
                "حدث خطأ أثناء استرجاع الرصيد",
                {
                    show_alert: true
                }
            );
        }
    }
);

/* =========================================================
   /BROADCAST
========================================================= */

bot.command(
    "broadcast",
    async (ctx) => {

        if (!ownerCommand(ctx)) {
            return ctx.reply(
                "⛔ هذا الأمر للمالك فقط."
            );
        }

        const message =
            ctx.message.text
                .replace(
                    /^\/broadcast\s*/i,
                    ""
                )
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

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            80
                        )
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

        const user =
            getWebUser(req);

        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "Telegram authentication required"
            });
        }

        const dbUser =
            ensureUser(user);

        res.json({

            success: true,

            user: {

                id:
                    dbUser.telegram_id,

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

        try {

            const products =
                db.prepare(`
                    SELECT
                        id,
                        name,
                        description,
                        price,
                        image,
                        active,
                        delivery_type,
                        created_at
                    FROM products
                    WHERE active = 1
                    ORDER BY id DESC
                `).all();

            const result =
                products.map(
                    (product) => {

                        let stock = null;

                        if (
                            normalizeDeliveryType(
                                product.delivery_type
                            ) === "code"
                        ) {

                            const count =
                                db.prepare(`
                                    SELECT COUNT(*) AS total
                                    FROM product_codes
                                    WHERE product_id = ?
                                    AND status = 'available'
                                `).get(
                                    product.id
                                );

                            stock =
                                count.total;
                        }

                        return {
                            ...product,
                            delivery_type:
                                normalizeDeliveryType(
                                    product.delivery_type
                                ),
                            stock
                        };
                    }
                );

            res.json({
                success: true,
                products: result
            });

        } catch (error) {

            console.error(
                "❌ Products API error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "حدث خطأ أثناء تحميل المنتجات"
            });
        }
    }
);

/* =========================================================
   API - BUY
========================================================= */

app.post(
    "/api/buy",
    (req, res) => {

        try {

            const user =
                getWebUser(req);

            if (!user) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Telegram authentication required"
                });
            }

            const productId =
                Number(
                    req.body.product_id
                );

            if (
                !Number.isInteger(productId) ||
                productId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid product"
                });
            }

            /*
             * مهم جدًا:
             * الواجهة يجب أن ترسل هذا المعرف
             * مع كل عملية شراء جديدة.
             */
            const clientRequestId =
                normalizeClientRequestId(
                    req.body.client_request_id
                );

            if (!clientRequestId) {

                return res.status(400).json({
                    success: false,
                    message:
                        "معرّف عملية الشراء غير صالح"
                });
            }

            const dbUser =
                ensureUser(user);

            /*
             * كل عملية الشراء داخل Transaction.
             *
             * بالإضافة إلى حماية الرصيد والكود،
             * يتم استخدام purchase_requests لمنع
             * تنفيذ نفس الطلب مرتين.
             */
            const purchase =
                db.transaction(() => {

                    /*
                     * أولًا نتحقق هل هذا الطلب
                     * تم تنفيذه مسبقًا.
                     *
                     * هذا يحدث داخل Transaction حتى
                     * لا يوجد سباق بين طلبين متزامنين.
                     */
                    const existingRequest =
                        db.prepare(`
                            SELECT *
                            FROM purchase_requests
                            WHERE client_request_id = ?
                        `).get(
                            clientRequestId
                        );

                    if (existingRequest) {

                        /*
                         * نفس request ID ولكن مستخدم آخر.
                         * نرفض العملية.
                         */
                        if (
                            String(existingRequest.telegram_id) !==
                            String(dbUser.telegram_id)
                        ) {

                            throw new Error(
                                "REQUEST_ID_CONFLICT"
                            );
                        }

                        /*
                         * إذا كان الطلب مرتبطًا بطلب
                         * سابق بالفعل، نعيد نفس النتيجة.
                         */
                        if (existingRequest.order_id) {

                            const existingOrder =
                                db.prepare(`
                                    SELECT *
                                    FROM orders
                                    WHERE id = ?
                                `).get(
                                    existingRequest.order_id
                                );

                            if (existingOrder) {

                                const currentUser =
                                    db.prepare(`
                                        SELECT balance
                                        FROM users
                                        WHERE telegram_id = ?
                                    `).get(
                                        dbUser.telegram_id
                                    );

                                return {
                                    order:
                                        existingOrder,

                                    balance:
                                        currentUser
                                            ? currentUser.balance
                                            : existingOrder.balance_after,

                                    code:
                                        existingOrder.code_value || null,

                                    replayed:
                                        true
                                };
                            }
                        }

                        /*
                         * في حالة وجود سجل بدون order_id
                         * نسمح بإكمال العملية بدلًا من إنشاء
                         * request ID جديد.
                         */
                    } else {

                        /*
                         * إنشاء سجل العملية قبل الخصم.
                         *
                         * UNIQUE على client_request_id
                         * يمنع التكرار.
                         */
                        db.prepare(`
                            INSERT INTO purchase_requests (
                                client_request_id,
                                telegram_id
                            )
                            VALUES (?, ?)
                        `).run(
                            clientRequestId,
                            dbUser.telegram_id
                        );
                    }

                    const freshUser =
                        db.prepare(`
                            SELECT *
                            FROM users
                            WHERE telegram_id = ?
                        `).get(
                            dbUser.telegram_id
                        );

                    if (!freshUser) {

                        throw new Error(
                            "USER_NOT_FOUND"
                        );
                    }

                    const product =
                        db.prepare(`
                            SELECT *
                            FROM products
                            WHERE id = ?
                            AND active = 1
                        `).get(
                            productId
                        );

                    if (!product) {

                        throw new Error(
                            "PRODUCT_NOT_FOUND"
                        );
                    }

                    const deliveryType =
                        normalizeDeliveryType(
                            product.delivery_type
                        );

                    if (
                        freshUser.balance <
                        product.price
                    ) {

                        throw new Error(
                            "INSUFFICIENT_BALANCE"
                        );
                    }

                    let code = null;

                    /*
                     * إذا كان المنتج كود،
                     * نحجز أول كود متاح.
                     */
                    if (
                        deliveryType === "code"
                    ) {

                        code =
                            db.prepare(`
                                SELECT *
                                FROM product_codes
                                WHERE product_id = ?
                                AND status = 'available'
                                ORDER BY id ASC
                                LIMIT 1
                            `).get(
                                product.id
                            );

                        if (!code) {

                            throw new Error(
                                "OUT_OF_STOCK"
                            );
                        }
                    }

                    const balanceBefore =
                        freshUser.balance;

                    const balanceAfter =
                        freshUser.balance -
                        product.price;

                    /*
                     * خصم الرصيد مع شرط
                     * balance >= price.
                     */
                    const debitResult =
                        db.prepare(`
                            UPDATE users
                            SET balance = balance - ?
                            WHERE telegram_id = ?
                            AND balance >= ?
                        `).run(
                            product.price,
                            freshUser.telegram_id,
                            product.price
                        );

                    if (
                        debitResult.changes !== 1
                    ) {

                        throw new Error(
                            "BALANCE_UPDATE_FAILED"
                        );
                    }

                    /*
                     * إنشاء الطلب.
                     */
                    const orderResult =
                        db.prepare(`
                            INSERT INTO orders (
                                telegram_id,
                                product_id,
                                product_name,
                                price,
                                status,
                                delivery_type,
                                code_id,
                                code_value,
                                username,
                                first_name,
                                balance_before,
                                balance_after
                            )
                            VALUES (
                                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                            )
                        `).run(
                            freshUser.telegram_id,
                            product.id,
                            product.name,
                            product.price,
                            deliveryType === "code"
                                ? "completed"
                                : "pending",
                            deliveryType,
                            code
                                ? code.id
                                : null,
                            code
                                ? code.code
                                : "",
                            freshUser.username || "",
                            freshUser.first_name || "",
                            balanceBefore,
                            balanceAfter
                        );

                    const orderId =
                        orderResult.lastInsertRowid;

                    /*
                     * إذا كان كود، نعلّم الكود كمباع.
                     */
                    if (
                        deliveryType === "code"
                    ) {

                        const soldResult =
                            db.prepare(`
                                UPDATE product_codes
                                SET
                                    status = 'sold',
                                    order_id = ?,
                                    sold_to = ?,
                                    sold_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                                AND status = 'available'
                            `).run(
                                orderId,
                                freshUser.telegram_id,
                                code.id
                            );

                        if (
                            soldResult.changes !== 1
                        ) {

                            throw new Error(
                                "CODE_RESERVATION_FAILED"
                            );
                        }
                    }

                    /*
                     * تسجيل عملية الخصم.
                     */
                    db.prepare(`
                        INSERT INTO transactions (
                            telegram_id,
                            type,
                            amount,
                            note,
                            order_id
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `).run(
                        freshUser.telegram_id,
                        "purchase",
                        -product.price,
                        `شراء: ${product.name}`,
                        orderId
                    );

                    /*
                     * ربط client_request_id بالطلب.
                     */
                    db.prepare(`
                        UPDATE purchase_requests
                        SET order_id = ?
                        WHERE client_request_id = ?
                        AND telegram_id = ?
                    `).run(
                        orderId,
                        clientRequestId,
                        freshUser.telegram_id
                    );

                    const order =
                        db.prepare(`
                            SELECT *
                            FROM orders
                            WHERE id = ?
                        `).get(orderId);

                    return {
                        order,

                        balance:
                            balanceAfter,

                        code:
                            code
                                ? code.code
                                : null,

                        replayed:
                            false
                    };
                })();

            const order =
                purchase.order;

            /*
             * إذا كانت العملية Replay،
             * نعيد نفس النتيجة بدون إرسال
             * إشعارات مكررة وبدون خصم جديد.
             */
            if (purchase.replayed) {

                return res.json({

                    success: true,

                    replayed: true,

                    delivery_type:
                        order.delivery_type,

                    order_id:
                        order.id,

                    balance:
                        purchase.balance,

                    code:
                        order.delivery_type === "code"
                            ? order.code_value
                            : null,

                    product_name:
                        order.product_name,

                    message:
                        order.delivery_type === "code"
                            ? "تم استرجاع نتيجة عملية الشراء السابقة"
                            : "تم استرجاع الطلب السابق"
                });
            }

            /*
             * -------------------------------------------------
             * CODE PRODUCT
             * -------------------------------------------------
             */

            if (
                order.delivery_type === "code"
            ) {

                sendTelegramMessage(
                    order.telegram_id,

`🎉 تم شراء المنتج بنجاح

📦 المنتج:
${order.product_name}

🧾 رقم الطلب:
#${order.id}

💰 السعر:
${formatMoney(order.price)}

━━━━━━━━━━━━━━

🔑 الكود الخاص بك:

${order.code_value}

━━━━━━━━━━━━━━

💰 رصيدك الحالي:
${formatMoney(order.balance_after)}

احتفظ بالكود في مكان آمن.`
                );

                sendTelegramMessage(
                    OWNER_ID,

`💳 تم بيع كود

🧾 الطلب:
#${order.id}

👤 العميل:
${order.first_name || "غير معروف"}

🔹 Username:
${order.username
    ? "@" + order.username
    : "بدون username"}

🆔 ID:
${order.telegram_id}

📦 المنتج:
${order.product_name}

💰 السعر:
${formatMoney(order.price)}

🔑 الكود:
${order.code_value}

💰 الرصيد بعد الشراء:
${formatMoney(order.balance_after)}

📅 الوقت:
${order.created_at}`
                );

                return res.json({

                    success: true,

                    replayed: false,

                    delivery_type:
                        "code",

                    order_id:
                        order.id,

                    balance:
                        purchase.balance,

                    code:
                        order.code_value,

                    product_name:
                        order.product_name,

                    message:
                        "تم تسليم الكود بنجاح"
                });
            }

            /*
             * -------------------------------------------------
             * SERVICE PRODUCT
             * -------------------------------------------------
             */

            notifyOwnerNewOrder(
                order
            );

            sendTelegramMessage(
                order.telegram_id,

`✅ تم إنشاء طلبك

🧾 رقم الطلب:
#${order.id}

📦 المنتج:
${order.product_name}

💰 السعر:
${formatMoney(order.price)}

💰 رصيدك الحالي:
${formatMoney(order.balance_after)}

📌 الحالة:
⏳ قيد التنفيذ

سيتم تنفيذ طلبك وإبلاغك عند الانتهاء.`
            );

            return res.json({

                success: true,

                replayed: false,

                delivery_type:
                    "service",

                order_id:
                    order.id,

                balance:
                    purchase.balance,

                message:
                    "تم إنشاء الطلب بنجاح"
            });

        } catch (error) {

            console.error(
                "❌ Buy error:",
                error
            );

            if (
                error.message ===
                "REQUEST_ID_CONFLICT"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "معرّف عملية الشراء مستخدم مسبقًا"
                });
            }

            if (
                error.message ===
                "INSUFFICIENT_BALANCE"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "رصيدك غير كافٍ"
                });
            }

            if (
                error.message ===
                "PRODUCT_NOT_FOUND"
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "المنتج غير موجود أو متوقف"
                });
            }

            if (
                error.message ===
                "OUT_OF_STOCK"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "هذا المنتج غير متوفر حاليًا"
                });
            }

            if (
                error.message ===
                "USER_NOT_FOUND"
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "المستخدم غير موجود"
                });
            }

            if (
                error.message ===
                "CODE_RESERVATION_FAILED"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "حدث تعارض أثناء حجز الكود. حاول مرة أخرى."
                });
            }

            if (
                error.message ===
                "BALANCE_UPDATE_FAILED"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "تعذر تحديث الرصيد. حاول مرة أخرى."
                });
            }

            res.status(500).json({
                success: false,
                message:
                    "حدث خطأ أثناء تنفيذ الطلب"
            });
        }
    }
);

/* =========================================================
   API - CUSTOMER ORDERS
========================================================= */

app.get(
    "/api/orders",
    (req, res) => {

        try {

            const user =
                getWebUser(req);

            if (!user) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Telegram authentication required"
                });
            }

            const orders =
                db.prepare(`
                    SELECT
                        id,
                        product_id,
                        product_name,
                        price,
                        status,
                        delivery_type,
                        code_value,
                        balance_before,
                        balance_after,
                        completed_at,
                        rejected_at,
                        created_at
                    FROM orders
                    WHERE telegram_id = ?
                    ORDER BY id DESC
                    LIMIT 50
                `).all(
                    String(user.id)
                );

            res.json({
                success: true,
                orders
            });

        } catch (error) {

            console.error(
                "❌ Customer orders error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "حدث خطأ أثناء تحميل الطلبات"
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

    req.owner =
        user;

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

        const transaction =
            db.transaction(() => {

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
            });

        transaction();

        const newBalance =
            db.prepare(`
                SELECT balance
                FROM users
                WHERE telegram_id = ?
            `).get(telegramId).balance;

        sendTelegramMessage(
            telegramId,

`🎁 تم إضافة رصيد إلى حسابك

💰 +${formatMoney(amount)}

رصيدك الحالي:
${formatMoney(newBalance)}`
        );

        res.json({

            success: true,

            message:
                "تمت إضافة الرصيد",

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

        const transaction =
            db.transaction(() => {

                const result =
                    db.prepare(`
                        UPDATE users
                        SET balance = balance - ?
                        WHERE telegram_id = ?
                        AND balance >= ?
                    `).run(
                        amount,
                        telegramId,
                        amount
                    );

                if (
                    result.changes !== 1
                ) {

                    throw new Error(
                        "BALANCE_UPDATE_FAILED"
                    );
                }

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
            });

        transaction();

        const newBalance =
            db.prepare(`
                SELECT balance
                FROM users
                WHERE telegram_id = ?
            `).get(telegramId).balance;

        sendTelegramMessage(
            telegramId,

`⚠️ تم خصم رصيد من حسابك

💰 -${formatMoney(amount)}

رصيدك الحالي:
${formatMoney(newBalance)}`
        );

        res.json({

            success: true,

            message:
                "تم خصم الرصيد",

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
            image,
            delivery_type
        } = req.body;

        const numericPrice =
            Number(price);

        if (
            !name ||
            !Number.isInteger(
                numericPrice
            ) ||
            numericPrice <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "اسم المنتج والسعر مطلوبان"
            });
        }

        const type =
            normalizeDeliveryType(
                delivery_type
            );

        const result =
            db.prepare(`
                INSERT INTO products (
                    name,
                    description,
                    price,
                    image,
                    delivery_type
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                name,
                description || "",
                numericPrice,
                image || "",
                type
            );

        res.json({

            success: true,

            product_id:
                result.lastInsertRowid,

            delivery_type:
                type
        });
    }
);

/* =========================================================
   OWNER - ADD CODE API
========================================================= */

app.post(
    "/api/admin/products/:id/codes",
    ownerOnly,
    (req, res) => {

        const productId =
            Number(req.params.id);

        const code =
            String(
                req.body.code || ""
            ).trim();

        if (
            !Number.isInteger(productId) ||
            productId <= 0 ||
            !code
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "بيانات غير صحيحة"
            });
        }

        const product =
            db.prepare(`
                SELECT *
                FROM products
                WHERE id = ?
            `).get(productId);

        if (!product) {

            return res.status(404).json({
                success: false,
                message:
                    "المنتج غير موجود"
            });
        }

        if (
            normalizeDeliveryType(
                product.delivery_type
            ) !== "code"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "المنتج ليس من نوع الأكواد"
            });
        }

        try {

            const result =
                db.prepare(`
                    INSERT INTO product_codes (
                        product_id,
                        code
                    )
                    VALUES (?, ?)
                `).run(
                    productId,
                    code
                );

            res.json({

                success: true,

                code_id:
                    result.lastInsertRowid
            });

        } catch (error) {

            if (
                String(error.message)
                    .includes("UNIQUE")
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "الكود موجود مسبقًا"
                });
            }

            console.error(
                "❌ Add code API error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "حدث خطأ أثناء إضافة الكود"
            });
        }
    }
);

/* =========================================================
   OWNER - ADD MULTIPLE CODES API
========================================================= */

app.post(
    "/api/admin/products/:id/codes/bulk",
    ownerOnly,
    (req, res) => {

        const productId =
            Number(req.params.id);

        let codes =
            req.body.codes;

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "رقم المنتج غير صحيح"
            });
        }

        if (
            typeof codes === "string"
        ) {

            codes =
                codes
                    .split(/\r?\n/)
                    .map(
                        (code) =>
                            code.trim()
                    )
                    .filter(Boolean);
        }

        if (
            !Array.isArray(codes) ||
            !codes.length
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "لم يتم إرسال أكواد"
            });
        }

        const product =
            db.prepare(`
                SELECT *
                FROM products
                WHERE id = ?
            `).get(productId);

        if (!product) {

            return res.status(404).json({
                success: false,
                message:
                    "المنتج غير موجود"
            });
        }

        if (
            normalizeDeliveryType(
                product.delivery_type
            ) !== "code"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "المنتج ليس من نوع الأكواد"
            });
        }

        const insert =
            db.prepare(`
                INSERT OR IGNORE INTO product_codes (
                    product_id,
                    code
                )
                VALUES (?, ?)
            `);

        let added = 0;
        let skipped = 0;

        const transaction =
            db.transaction(() => {

                for (
                    const rawCode of codes
                ) {

                    const code =
                        String(
                            rawCode || ""
                        ).trim();

                    if (!code) {
                        skipped++;
                        continue;
                    }

                    const result =
                        insert.run(
                            productId,
                            code
                        );

                    if (
                        result.changes === 1
                    ) {

                        added++;

                    } else {

                        skipped++;
                    }
                }
            });

        transaction();

        const stock =
            db.prepare(`
                SELECT COUNT(*) AS total
                FROM product_codes
                WHERE product_id = ?
                AND status = 'available'
            `).get(productId);

        res.json({

            success: true,

            added,

            skipped,

            available:
                stock.total
        });
    }
);

/* =========================================================
   OWNER - CODE STOCK API
========================================================= */

app.get(
    "/api/admin/products/:id/codes",
    ownerOnly,
    (req, res) => {

        const productId =
            Number(req.params.id);

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "رقم المنتج غير صحيح"
            });
        }

        const codes =
            db.prepare(`
                SELECT
                    id,
                    product_id,
                    code,
                    status,
                    order_id,
                    sold_to,
                    sold_at,
                    created_at
                FROM product_codes
                WHERE product_id = ?
                ORDER BY id DESC
            `).all(productId);

        res.json({

            success: true,

            codes
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

        const productId =
            Number(req.params.id);

        db.prepare(`
            UPDATE products
            SET active = 0
            WHERE id = ?
        `).run(productId);

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
   OWNER - COMPLETE ORDER API
========================================================= */

app.post(
    "/api/admin/orders/:id/complete",
    ownerOnly,
    async (req, res) => {

        const orderId =
            Number(req.params.id);

        try {

            const result =
                db.transaction(() => {

                    const order =
                        db.prepare(`
                            SELECT *
                            FROM orders
                            WHERE id = ?
                        `).get(orderId);

                    if (!order) {

                        throw new Error(
                            "ORDER_NOT_FOUND"
                        );
                    }

                    if (
                        order.status !==
                        "pending"
                    ) {

                        throw new Error(
                            "ORDER_ALREADY_PROCESSED"
                        );
                    }

                    const updateResult =
                        db.prepare(`
                            UPDATE orders
                            SET
                                status = 'completed',
                                completed_at =
                                    CURRENT_TIMESTAMP
                            WHERE id = ?
                            AND status = 'pending'
                        `).run(orderId);

                    if (
                        updateResult.changes !== 1
                    ) {

                        throw new Error(
                            "ORDER_ALREADY_PROCESSED"
                        );
                    }

                    return order;
                })();

            await sendTelegramMessage(
                result.telegram_id,

`✅ تم تنفيذ طلبك

🧾 الطلب:
#${result.id}

📦 المنتج:
${result.product_name}

💰 السعر:
${formatMoney(result.price)}

شكراً لطلبك من متجرنا ❤️`
            );

            res.json({

                success: true,

                order:
                    db.prepare(`
                        SELECT *
                        FROM orders
                        WHERE id = ?
                    `).get(orderId)
            });

        } catch (error) {

            if (
                error.message ===
                "ORDER_NOT_FOUND"
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "الطلب غير موجود"
                });
            }

            if (
                error.message ===
                "ORDER_ALREADY_PROCESSED"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "الطلب تمت معالجته مسبقًا"
                });
            }

            console.error(
                "❌ Complete API error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "حدث خطأ"
            });
        }
    }
);

/* =========================================================
   OWNER - REJECT ORDER API
========================================================= */

app.post(
    "/api/admin/orders/:id/reject",
    ownerOnly,
    async (req, res) => {

        const orderId =
            Number(req.params.id);

        try {

            const result =
                db.transaction(() => {

                    const order =
                        db.prepare(`
                            SELECT *
                            FROM orders
                            WHERE id = ?
                        `).get(orderId);

                    if (!order) {

                        throw new Error(
                            "ORDER_NOT_FOUND"
                        );
                    }

                    if (
                        order.status !==
                        "pending"
                    ) {

                        throw new Error(
                            "ORDER_ALREADY_PROCESSED"
                        );
                    }

                    const user =
                        db.prepare(`
                            SELECT *
                            FROM users
                            WHERE telegram_id = ?
                        `).get(
                            order.telegram_id
                        );

                    if (!user) {

                        throw new Error(
                            "USER_NOT_FOUND"
                        );
                    }

                    db.prepare(`
                        UPDATE users
                        SET balance = balance + ?
                        WHERE telegram_id = ?
                    `).run(
                        order.price,
                        order.telegram_id
                    );

                    const updateResult =
                        db.prepare(`
                            UPDATE orders
                            SET
                                status = 'rejected',
                                rejected_at =
                                    CURRENT_TIMESTAMP
                            WHERE id = ?
                            AND status = 'pending'
                        `).run(orderId);

                    if (
                        updateResult.changes !== 1
                    ) {

                        throw new Error(
                            "ORDER_ALREADY_PROCESSED"
                        );
                    }

                    db.prepare(`
                        INSERT INTO transactions (
                            telegram_id,
                            type,
                            amount,
                            note,
                            order_id
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `).run(
                        order.telegram_id,
                        "refund",
                        order.price,
                        `استرجاع طلب #${order.id}`,
                        order.id
                    );

                    const updatedUser =
                        db.prepare(`
                            SELECT balance
                            FROM users
                            WHERE telegram_id = ?
                        `).get(
                            order.telegram_id
                        );

                    return {
                        order,
                        newBalance:
                            updatedUser.balance
                    };
                })();

            await sendTelegramMessage(
                result.order.telegram_id,

`❌ تم رفض طلبك

🧾 الطلب:
#${result.order.id}

📦 المنتج:
${result.order.product_name}

💰 تم استرجاع:
${formatMoney(result.order.price)}

💰 رصيدك الحالي:
${formatMoney(result.newBalance)}`
            );

            res.json({

                success: true,

                balance:
                    result.newBalance,

                order:
                    db.prepare(`
                        SELECT *
                        FROM orders
                        WHERE id = ?
                    `).get(orderId)
            });

        } catch (error) {

            if (
                error.message ===
                "ORDER_NOT_FOUND"
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "الطلب غير موجود"
                });
            }

            if (
                error.message ===
                "ORDER_ALREADY_PROCESSED"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "الطلب تمت معالجته مسبقًا"
                });
            }

            if (
                error.message ===
                "USER_NOT_FOUND"
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "المستخدم غير موجود"
                });
            }

            console.error(
                "❌ Reject API error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "حدث خطأ أثناء رفض الطلب"
            });
        }
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
            "🔑 Code inventory: ENABLED"
        );

        console.log(
            "🛒 Orders: ENABLED"
        );

        console.log(
            "💰 Balance system: ENABLED"
        );

        console.log(
            "🛡️ Purchase idempotency: ENABLED"
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