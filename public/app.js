const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

const initData = tg?.initData || "";

const headers = {
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": initData
};

let currentUser = null;
let products = [];
let balanceRefreshTimer = null;


/* =========================================================
   TRANSLATIONS
========================================================= */

const appTranslations = {

    ar: {
        buy: "شراء",
        confirmTitle: "تأكيد الطلب",
        price: "السعر",
        currentBalance: "رصيدك الحالي",
        confirmBuy: "تأكيد الشراء",

        noProducts: "لا توجد منتجات حالياً",
        noProductsDescription: "سيتم إضافة المنتجات قريباً.",

        loadingProducts: "جاري تحميل المنتجات...",
        productsError: "تعذر تحميل المنتجات.",

        connectionError: "حدث خطأ في الاتصال",
        telegramError: "تعذر التحقق من حساب Telegram",

        insufficientBalance: "الرصيد غير كافٍ",
        orderCreated: "تم إنشاء الطلب",

        product: "منتج",
        products: "منتجات",

        hello: "مرحباً"
    },

    en: {
        buy: "Buy",
        confirmTitle: "Confirm Order",
        price: "Price",
        currentBalance: "Current balance",
        confirmBuy: "Confirm Purchase",

        noProducts: "No products available",
        noProductsDescription: "Products will be added soon.",

        loadingProducts: "Loading products...",
        productsError: "Unable to load products.",

        connectionError: "Connection error",
        telegramError: "Unable to verify Telegram account",

        insufficientBalance: "Insufficient balance",
        orderCreated: "Order created",

        product: "Product",
        products: "Products",

        hello: "Hello"
    }
};


function getLanguage() {

    return (
        localStorage.getItem("libyan_store_language") ||
        "ar"
    );
}


function appT(key) {

    const language = getLanguage();

    return (
        appTranslations[language]?.[key] ||
        appTranslations.ar[key] ||
        key
    );
}


/* =========================================================
   HELPERS
========================================================= */

function showToast(message) {

    const toast =
        document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(
        window.__toastTimer
    );

    window.__toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 2500);
}


function closeModal() {

    const modal =
        document.getElementById("modal");

    if (!modal) return;

    modal.classList.remove("active");
    modal.classList.remove("show");
}


function formatNumber(value) {

    return Number(value || 0)
        .toLocaleString(
            getLanguage() === "ar"
                ? "ar-LY"
                : "en-US"
        );
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   LOAD USER
========================================================= */

async function loadUser(showError = true) {

    if (!initData) {

        console.warn(
            "Telegram initData is empty."
        );

        if (showError) {
            showToast(
                appT("telegramError")
            );
        }

        return false;
    }


    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    headers: {
                        "X-Telegram-Init-Data":
                            initData
                    },
                    cache: "no-store"
                }
            );


        const data =
            await response.json();


        console.log(
            "Telegram user response:",
            data
        );


        if (!response.ok || !data.success) {

            if (showError) {
                showToast(
                    data.message ||
                    appT("telegramError")
                );
            }

            return false;
        }


        /*
         * يدعم:
         *
         * data.user
         *
         * أو في حال كان السيرفر يعيد
         * البيانات مباشرة.
         */

        currentUser =
            data.user || data;


        updateUserInterface();

        updateBalance();

        return true;


    } catch (error) {

        console.error(
            "loadUser error:",
            error
        );

        if (showError) {
            showToast(
                appT("connectionError")
            );
        }

        return false;
    }
}


/* =========================================================
   USER INTERFACE
========================================================= */

function updateUserInterface() {

    if (!currentUser) {
        return;
    }


    const userName =
        document.getElementById(
            "userName"
        );

    const userId =
        document.getElementById(
            "userId"
        );

    const welcome =
        document.getElementById(
            "welcome"
        );


    const fullName =
        [
            currentUser.first_name || "",
            currentUser.last_name || ""
        ]
        .join(" ")
        .trim();


    if (userName) {

        userName.textContent =
            fullName ||
            currentUser.username ||
            "Telegram User";
    }


    if (userId) {

        userId.textContent =
            `ID: ${currentUser.id || "------"}`;
    }


    if (welcome) {

        welcome.textContent =
            currentUser.username
                ? `@${currentUser.username}`
                : appT("hello");
    }


    /*
     * في حال كان السيرفر يعيد صورة المستخدم.
     */

    const avatar =
        document.getElementById(
            "userAvatar"
        );


    if (
        avatar &&
        currentUser.photo_url
    ) {

        avatar.src =
            currentUser.photo_url;
    }
}


/* =========================================================
   BALANCE
========================================================= */

function updateBalance() {

    const balanceElement =
        document.getElementById(
            "balance"
        );


    if (!balanceElement) {
        return;
    }


    const balance =
        Number(
            currentUser?.balance || 0
        );


    balanceElement.textContent =
        formatNumber(balance);


    /*
     * تأثير بسيط عند تغير الرصيد.
     */

    balanceElement.animate(
        [
            {
                transform: "scale(1)"
            },
            {
                transform: "scale(1.08)"
            },
            {
                transform: "scale(1)"
            }
        ],
        {
            duration: 280,
            easing: "ease-out"
        }
    );
}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts(
    showError = true
) {

    const container =
        document.getElementById(
            "products"
        );


    if (container) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    ⏳
                </div>

                <h3>
                    ${escapeHtml(
                        appT("loadingProducts")
                    )}
                </h3>
            </div>
        `;
    }


    try {

        const response =
            await fetch(
                "/api/products",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        const data =
            await response.json();


        console.log(
            "Products response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Products request failed"
            );
        }


        /*
         * يدعم أكثر من شكل للـAPI:
         *
         * { products: [...] }
         *
         * أو
         *
         * { success: true, products: [...] }
         */

        products =
            Array.isArray(data)
                ? data
                : Array.isArray(data.products)
                    ? data.products
                    : [];


        renderProducts();

        updateProductCount();


        return true;


    } catch (error) {

        console.error(
            "loadProducts error:",
            error
        );


        if (container) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-state-icon">
                        ⚠️
                    </div>

                    <h3>
                        ${escapeHtml(
                            appT("productsError")
                        )}
                    </h3>

                </div>
            `;
        }


        if (showError) {

            showToast(
                appT("productsError")
            );
        }


        return false;
    }
}


/* =========================================================
   PRODUCT COUNT
========================================================= */

function updateProductCount() {

    const countElement =
        document.getElementById(
            "productsCount"
        );


    if (!countElement) {
        return;
    }


    const count =
        products.length;


    const language =
        getLanguage();


    if (language === "en") {

        countElement.textContent =
            `${count} ${
                count === 1
                    ? appT("product")
                    : appT("products")
            }`;

    } else {

        if (count === 0) {

            countElement.textContent =
                "0";

        } else if (
            count === 1
        ) {

            countElement.textContent =
                `1 ${appT("product")}`;

        } else {

            countElement.textContent =
                `${formatNumber(count)} ${appT("products")}`;
        }
    }
}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts() {

    const container =
        document.getElementById(
            "products"
        );


    if (!container) {
        return;
    }


    updateProductCount();


    if (!products.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    🛍️
                </div>

                <h3>
                    ${escapeHtml(
                        appT("noProducts")
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        appT("noProductsDescription")
                    )}
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        products.map(
            product => {

                const image =
                    product.image
                        ? `
                            <img
                                src="${escapeHtml(product.image)}"
                                alt="${escapeHtml(product.name)}"
                                loading="lazy"
                                onerror="this.style.display='none';this.parentElement.classList.add('image-error')"
                            >
                        `
                        : "";


                return `
                    <article
                        class="product-card"
                        data-product-id="${Number(product.id)}"
                    >

                        <div class="product-image">

                            ${
                                image ||
                                `
                                    <div
                                        style="
                                            width:100%;
                                            height:100%;
                                            display:grid;
                                            place-items:center;
                                            color:#f5b83d;
                                            font-size:30px;
                                        "
                                    >
                                        🛍️
                                    </div>
                                `
                            }

                        </div>


                        <div class="product-content">

                            <div class="product-name">
                                ${escapeHtml(
                                    product.name
                                )}
                            </div>


                            ${
                                product.description
                                    ? `
                                        <div class="product-description">
                                            ${escapeHtml(
                                                product.description
                                            )}
                                        </div>
                                    `
                                    : ""
                            }


                            <div class="product-footer">

                                <div class="product-price">
                                    ⭐
                                    ${formatNumber(
                                        product.price
                                    )}
                                </div>


                                <button
                                    type="button"
                                    class="buy-button"
                                    onclick="openBuy(${Number(product.id)})"
                                >
                                    ${escapeHtml(
                                        appT("buy")
                                    )}
                                </button>

                            </div>

                        </div>

                    </article>
                `;

            }
        ).join("");
}


/* =========================================================
   BUY MODAL
========================================================= */

function openBuy(productId) {

    const product =
        products.find(
            item =>
                Number(item.id) ===
                Number(productId)
        );


    if (!product) {

        showToast(
            appT("productsError")
        );

        return;
    }


    if (!currentUser) {

        showToast(
            appT("telegramError")
        );

        return;
    }


    const modal =
        document.getElementById(
            "modal"
        );

    const content =
        document.getElementById(
            "modalContent"
        );


    if (!modal || !content) {
        return;
    }


    const balance =
        Number(
            currentUser.balance || 0
        );


    const price =
        Number(
            product.price || 0
        );


    content.innerHTML = `

        <div
            style="
                padding-top:8px;
                text-align:center;
            "
        >

            ${
                product.image
                    ? `
                        <img
                            src="${escapeHtml(product.image)}"
                            alt="${escapeHtml(product.name)}"
                            style="
                                width:100%;
                                max-height:190px;
                                object-fit:cover;
                                border-radius:16px;
                                margin-bottom:16px;
                                border:1px solid rgba(83,154,221,.16);
                            "
                        >
                    `
                    : ""
            }


            <div
                style="
                    color:#fff;
                    font-size:19px;
                    font-weight:900;
                "
            >
                ${escapeHtml(
                    product.name
                )}
            </div>


            ${
                product.description
                    ? `
                        <div
                            style="
                                margin-top:7px;
                                color:#8192a8;
                                font-size:12px;
                                line-height:1.8;
                            "
                        >
                            ${escapeHtml(
                                product.description
                            )}
                        </div>
                    `
                    : ""
            }


            <div
                style="
                    margin-top:18px;
                    padding:13px;
                    border:1px solid rgba(245,184,61,.18);
                    border-radius:14px;
                    background:rgba(245,184,61,.045);
                "
            >

                <div
                    style="
                        color:#8192a8;
                        font-size:11px;
                    "
                >
                    ${escapeHtml(
                        appT("price")
                    )}
                </div>

                <strong
                    style="
                        display:block;
                        margin-top:3px;
                        color:#ffd86b;
                        font-size:19px;
                    "
                >
                    ⭐ ${formatNumber(price)}
                </strong>

            </div>


            <div
                style="
                    margin-top:9px;
                    color:#8192a8;
                    font-size:11px;
                "
            >
                ${escapeHtml(
                    appT("currentBalance")
                )}

                <strong
                    style="
                        color:#63e69a;
                        direction:ltr;
                        display:inline-block;
                        margin-right:4px;
                    "
                >
                    ⭐ ${formatNumber(balance)}
                </strong>
            </div>


            <button
                type="button"
                onclick="confirmBuy(${Number(product.id)})"
                style="
                    width:100%;
                    margin-top:18px;
                    min-height:46px;
                    border:0;
                    border-radius:13px;
                    color:#071321;
                    background:linear-gradient(135deg,#ffd86b,#f5b83d);
                    font-weight:900;
                    cursor:pointer;
                "
            >
                ${escapeHtml(
                    appT("confirmBuy")
                )}
            </button>

        </div>
    `;


    modal.classList.add("active");
}


/* =========================================================
   CONFIRM BUY
========================================================= */

async function confirmBuy(productId) {

    if (!currentUser) {

        showToast(
            appT("telegramError")
        );

        return;
    }


    const product =
        products.find(
            item =>
                Number(item.id) ===
                Number(productId)
        );


    if (!product) {
        return;
    }


    const price =
        Number(product.price || 0);

    const balance =
        Number(currentUser.balance || 0);


    if (balance < price) {

        showToast(
            appT("insufficientBalance")
        );

        return;
    }


    try {

        const response =
            await fetch(
                "/api/buy",
                {
                    method: "POST",

                    headers,

                    body: JSON.stringify({
                        product_id:
                            Number(productId)
                    })
                }
            );


        const data =
            await response.json();


        console.log(
            "Buy response:",
            data
        );


        if (!response.ok || !data.success) {

            showToast(
                data.message ||
                appT("insufficientBalance")
            );

            /*
             * تحديث الرصيد في حال تغير
             * من السيرفر حتى لو فشل الطلب.
             */

            await loadUser(false);

            return;
        }


        /*
         * تحديث الرصيد فوراً
         */

        if (
            typeof data.balance !==
            "undefined"
        ) {

            currentUser.balance =
                Number(data.balance);

        } else {

            currentUser.balance =
                Math.max(
                    0,
                    balance - price
                );
        }


        updateBalance();

        closeModal();


        showToast(
            `${appT("orderCreated")} #${data.order_id || ""}`
        );


        /*
         * نعيد جلب المستخدم من السيرفر
         * للتأكد أن الرصيد مطابق للقاعدة.
         */

        setTimeout(() => {

            loadUser(false);

        }, 500);


    } catch (error) {

        console.error(
            "confirmBuy error:",
            error
        );

        showToast(
            appT("connectionError")
        );
    }
}


/* =========================================================
   AUTO REFRESH BALANCE
========================================================= */

/*
 * مهم جداً:
 *
 * إذا أضاف الأدمن نقاطاً للزبون من:
 *
 * /addpoints ID AMOUNT
 *
 * فإن صفحة المتجر ستعيد جلب الرصيد
 * من السيرفر بشكل دوري.
 */

function startBalanceRefresh() {

    clearInterval(
        balanceRefreshTimer
    );


    balanceRefreshTimer =
        setInterval(() => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                loadUser(false);
            }

        }, 5000);
}


/* =========================================================
   REFRESH WHEN RETURNING TO WEB APP
========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            loadUser(false);

            loadProducts(false);
        }
    }
);


window.addEventListener(
    "focus",
    () => {

        loadUser(false);
    }
);


/* =========================================================
   LANGUAGE CHANGE
========================================================= */

window.renderProducts =
    renderProducts;

window.updateProductCount =
    updateProductCount;


/*
 * عندما يغير المستخدم اللغة من index.html
 * يتم إعادة رسم المنتجات بالنص الصحيح.
 */

window.setLanguage =
    window.setLanguage;


/* =========================================================
   START
========================================================= */

async function initStore() {

    /*
     * نجلب الاثنين معاً.
     */

    await Promise.all([
        loadUser(true),
        loadProducts(true)
    ]);


    /*
     * تحديث الرصيد كل 5 ثوانٍ.
     */

    startBalanceRefresh();
}


initStore();