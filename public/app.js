/* =========================================================
   TELEGRAM DIGITAL STORE
   APP.JS
========================================================= */

"use strict";

/* =========================================================
   TELEGRAM
========================================================= */

const tg =
    window.Telegram?.WebApp || null;

/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let products = [];

let balanceRefreshTimer = null;

let currentProductId = null;

let purchaseInProgress = false;

/* =========================================================
   INIT TELEGRAM
========================================================= */

if (tg) {

    try {

        tg.ready();
        tg.expand();

        if (typeof tg.enableClosingConfirmation === "function") {
            tg.enableClosingConfirmation();
        }

    } catch (error) {

        console.error(
            "Telegram WebApp init error:",
            error
        );
    }
}

/* =========================================================
   TELEGRAM INIT DATA
========================================================= */

function getTelegramInitData() {

    return tg?.initData || "";
}

/* =========================================================
   HEADERS
========================================================= */

function getHeaders() {

    return {

        "Content-Type":
            "application/json",

        "X-Telegram-Init-Data":
            getTelegramInitData()
    };
}

/* =========================================================
   TRANSLATIONS
========================================================= */

const translations = {

    ar: {

        buy: "شراء",

        balance:
            "الرصيد",

        insufficientBalance:
            "رصيدك غير كافٍ",

        loading:
            "جاري التحميل...",

        confirmPurchase:
            "تأكيد الشراء",

        cancel:
            "إلغاء",

        confirm:
            "تأكيد",

        processing:
            "جاري تنفيذ الطلب...",

        purchaseSuccess:
            "تمت عملية الشراء بنجاح",

        orderCreated:
            "تم إنشاء طلبك",

        automaticDelivery:
            "تسليم تلقائي",

        manualDelivery:
            "تنفيذ يدوي",

        available:
            "متوفر",

        outOfStock:
            "نفد المخزون",

        noProducts:
            "لا توجد منتجات متاحة حالياً",

        error:
            "حدث خطأ غير متوقع",

        authenticationRequired:
            "يجب فتح المتجر من داخل تيليجرام",

        close:
            "إغلاق",

        orderNumber:
            "رقم الطلب",

        remainingBalance:
            "الرصيد المتبقي",

        product:
            "المنتج",

        price:
            "السعر",

        code:
            "الكود",

        copy:
            "نسخ",

        copied:
            "تم نسخ الكود",

        contactOwner:
            "سيتم تنفيذ طلبك والتواصل معك قريباً."

    },

    en: {

        buy:
            "Buy",

        balance:
            "Balance",

        insufficientBalance:
            "Insufficient balance",

        loading:
            "Loading...",

        confirmPurchase:
            "Confirm purchase",

        cancel:
            "Cancel",

        confirm:
            "Confirm",

        processing:
            "Processing...",

        purchaseSuccess:
            "Purchase completed successfully",

        orderCreated:
            "Your order has been created",

        automaticDelivery:
            "Automatic delivery",

        manualDelivery:
            "Manual fulfillment",

        available:
            "Available",

        outOfStock:
            "Out of stock",

        noProducts:
            "No products available",

        error:
            "Unexpected error",

        authenticationRequired:
            "Please open the store from Telegram",

        close:
            "Close",

        orderNumber:
            "Order",

        remainingBalance:
            "Remaining balance",

        product:
            "Product",

        price:
            "Price",

        code:
            "Code",

        copy:
            "Copy",

        copied:
            "Code copied",

        contactOwner:
            "Your order will be processed shortly."
    }
};

/* =========================================================
   CURRENT LANGUAGE
========================================================= */

function getLanguage() {

    return (
        document.documentElement.lang ||
        "ar"
    );
}

function t(key) {

    const lang =
        getLanguage();

    return (
        translations[lang]?.[key] ||
        translations.ar[key] ||
        key
    );
}

/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "info"
) {

    const toast =
        document.getElementById("toast");

    if (!toast) {

        console.log(
            `[${type}]`,
            message
        );

        return;
    }

    toast.textContent =
        message;

    toast.className =
        `toast ${type}`;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        toast._timer
    );

    toast._timer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 3500);
}

/* =========================================================
   MODAL
========================================================= */

function closeModal() {

    const modal =
        document.getElementById("modal");

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "active"
    );

    modal.style.display =
        "none";

    currentProductId =
        null;
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

/* =========================================================
   FORMAT NUMBER
========================================================= */

function formatNumber(
    number
) {

    return Number(
        number || 0
    ).toLocaleString(
        "en-US"
    );
}

/* =========================================================
   TELEGRAM HAPTIC
========================================================= */

function haptic(
    type = "light"
) {

    try {

        if (
            tg &&
            tg.HapticFeedback
        ) {

            tg.HapticFeedback
                .impactOccurred(
                    type
                );
        }

    } catch (_) {}
}

/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(
    url,
    options = {}
) {

    const finalOptions = {

        ...options,

        headers: {

            ...getHeaders(),

            ...(options.headers || {})
        }
    };

    const response =
        await fetch(
            url,
            finalOptions
        );

    let data = null;

    try {

        data =
            await response.json();

    } catch (_) {

        data = null;
    }

    if (
        !response.ok
    ) {

        const error =
            new Error(
                data?.message ||
                `HTTP ${response.status}`
            );

        error.status =
            response.status;

        error.data =
            data;

        throw error;
    }

    return data;
}

/* =========================================================
   LOAD USER
========================================================= */

async function loadUser() {

    try {

        if (!getTelegramInitData()) {

            showToast(
                t(
                    "authenticationRequired"
                ),
                "error"
            );

            return false;
        }

        const data =
            await apiRequest(
                `/api/me?_=${Date.now()}`,
                {
                    method: "GET"
                }
            );

        if (
            !data ||
            !data.success
        ) {

            throw new Error(
                data?.message ||
                t("error")
            );
        }

        currentUser =
            data.user ||
            data;

        updateUserInterface();

        return true;

    } catch (error) {

        console.error(
            "❌ loadUser:",
            error
        );

        if (
            error.status === 401
        ) {

            showToast(
                t(
                    "authenticationRequired"
                ),
                "error"
            );

        } else {

            showToast(
                error.message ||
                t("error"),
                "error"
            );
        }

        return false;
    }
}

/* =========================================================
   UPDATE USER INTERFACE
========================================================= */

function updateUserInterface() {

    if (!currentUser) {
        return;
    }

    const name =
        currentUser.first_name ||
        currentUser.username ||
        "User";

    const username =
        currentUser.username
            ? `@${currentUser.username}`
            : "";

    const id =
        currentUser.id ||
        currentUser.telegram_id ||
        "";

    const balance =
        Number(
            currentUser.balance || 0
        );

    /* NAME */

    const nameElements =
        document.querySelectorAll(
            "[data-user-name]"
        );

    nameElements.forEach(
        (element) => {

            element.textContent =
                name;
        }
    );

    const userName =
        document.getElementById(
            "userName"
        );

    if (userName) {

        userName.textContent =
            name;
    }

    /* USERNAME */

    const usernameElements =
        document.querySelectorAll(
            "[data-user-username]"
        );

    usernameElements.forEach(
        (element) => {

            element.textContent =
                username;
        }
    );

    /* ID */

    const userId =
        document.getElementById(
            "userId"
        );

    if (userId) {

        userId.textContent =
            id;
    }

    /* WELCOME */

    const welcomeName =
        document.getElementById(
            "welcomeName"
        );

    if (welcomeName) {

        welcomeName.textContent =
            name;
    }

    /* AVATAR */

    const avatar =
        document.getElementById(
            "userAvatar"
        );

    if (avatar) {

        avatar.textContent =
            name
                .charAt(0)
                .toUpperCase();
    }

    /* BALANCE */

    updateBalance(
        balance
    );
}

/* =========================================================
   UPDATE BALANCE
========================================================= */

function updateBalance(
    balance
) {

    const value =
        Number(
            balance || 0
        );

    if (currentUser) {

        currentUser.balance =
            value;
    }

    const balanceElements =
        document.querySelectorAll(
            "[data-balance]"
        );

    balanceElements.forEach(
        (element) => {

            element.textContent =
                formatNumber(value);
        }
    );

    const balanceElement =
        document.getElementById(
            "balance"
        );

    if (balanceElement) {

        balanceElement.textContent =
            formatNumber(value);
    }

    const balanceValue =
        document.getElementById(
            "balanceValue"
        );

    if (balanceValue) {

        balanceValue.textContent =
            formatNumber(value);
    }
}

/* =========================================================
   REFRESH BALANCE
========================================================= */

async function refreshBalance() {

    try {

        if (
            !getTelegramInitData()
        ) {
            return;
        }

        const data =
            await apiRequest(
                `/api/me?_=${Date.now()}`,
                {
                    method: "GET"
                }
            );

        if (
            data &&
            data.success &&
            data.user
        ) {

            currentUser =
                data.user;

            updateUserInterface();
        }

    } catch (error) {

        console.error(
            "❌ refreshBalance:",
            error
        );
    }
}

/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    try {

        const data =
            await apiRequest(
                `/api/products?_=${Date.now()}`,
                {
                    method: "GET"
                }
            );

        products =
            Array.isArray(
                data.products
            )
                ? data.products
                : [];

        renderProducts();

        return true;

    } catch (error) {

        console.error(
            "❌ loadProducts:",
            error
        );

        const container =
            document.getElementById(
                "products"
            );

        if (container) {

            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        ⚠️
                    </div>

                    <div class="empty-title">
                        ${escapeHtml(
                            error.message ||
                            t("error")
                        )}
                    </div>
                </div>
            `;
        }

        return false;
    }
}

/* =========================================================
   PRODUCT COUNT
========================================================= */

function updateProductCount() {

    const count =
        document.getElementById(
            "productsCount"
        );

    if (!count) {
        return;
    }

    count.textContent =
        products.length;
}

/* =========================================================
   PRODUCT DELIVERY
========================================================= */

function getProductDeliveryType(
    product
) {

    if (
        product.delivery_type ===
            "code" ||
        product.delivery_type ===
            "automatic"
    ) {

        return "code";
    }

    return "manual";
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

                <div class="empty-icon">
                    📦
                </div>

                <div class="empty-title">
                    ${escapeHtml(
                        t("noProducts")
                    )}
                </div>

            </div>
        `;

        return;
    }

    container.innerHTML =
        products
            .map(
                (product) =>
                    createProductCard(
                        product
                    )
            )
            .join("");

    try {

        if (
            window.lucide &&
            typeof window.lucide.createIcons ===
                "function"
        ) {

            window.lucide.createIcons();
        }

    } catch (_) {}
}

/* =========================================================
   PRODUCT CARD
========================================================= */

function createProductCard(
    product
) {

    const id =
        Number(product.id);

    const name =
        escapeHtml(
            product.name
        );

    const description =
        escapeHtml(
            product.description ||
            ""
        );

    const image =
        escapeHtml(
            product.image ||
            ""
        );

    const price =
        formatNumber(
            product.price
        );

    const deliveryType =
        getProductDeliveryType(
            product
        );

    const deliveryLabel =
        deliveryType === "code"
            ? t("automaticDelivery")
            : t("manualDelivery");

    const deliveryIcon =
        deliveryType === "code"
            ? "⚡"
            : "🛠️";

    const imageHtml =
        image
            ? `
                <img
                    src="${image}"
                    alt="${name}"
                    class="product-image"
                    loading="lazy"
                    onerror="
                        this.style.display='none';
                        this.parentElement
                            .classList.add('no-image');
                    "
                >
            `
            : `
                <div class="product-image-placeholder">
                    📦
                </div>
            `;

    return `
        <article
            class="product-card"
            data-product-id="${id}"
        >

            <div class="product-image-wrap">
                ${imageHtml}
            </div>

            <div class="product-content">

                <div class="product-top">

                    <h3 class="product-name">
                        ${name}
                    </h3>

                    <span class="
                        product-delivery-badge
                        ${deliveryType}
                    ">
                        ${deliveryIcon}
                        ${escapeHtml(
                            deliveryLabel
                        )}
                    </span>

                </div>

                ${
                    description
                        ? `
                            <p class="product-description">
                                ${description}
                            </p>
                        `
                        : ""
                }

                <div class="product-bottom">

                    <div class="product-price">

                        <span class="price-label">
                            ${escapeHtml(
                                t("price")
                            )}
                        </span>

                        <strong>
                            ${price}
                        </strong>

                        <span>
                            ⭐
                        </span>

                    </div>

                    <button
                        type="button"
                        class="buy-btn"
                        onclick="openBuy(${id})"
                    >
                        <span>
                            ${escapeHtml(
                                t("buy")
                            )}
                        </span>

                        <span>
                            →
                        </span>
                    </button>

                </div>

            </div>

        </article>
    `;
}

/* =========================================================
   OPEN BUY MODAL
========================================================= */

function openBuy(
    productId
) {

    if (
        purchaseInProgress
    ) {
        return;
    }

    const product =
        products.find(
            (item) =>
                Number(item.id) ===
                Number(productId)
        );

    if (!product) {

        showToast(
            "المنتج غير موجود",
            "error"
        );

        return;
    }

    currentProductId =
        Number(productId);

    const modal =
        document.getElementById(
            "modal"
        );

    const content =
        document.getElementById(
            "modalContent"
        );

    if (!modal || !content) {

        console.error(
            "Modal elements not found"
        );

        return;
    }

    const deliveryType =
        getProductDeliveryType(
            product
        );

    const deliveryLabel =
        deliveryType === "code"
            ? "⚡ تسليم تلقائي وفوري"
            : "🛠️ تنفيذ يدوي";

    const userBalance =
        Number(
            currentUser?.balance || 0
        );

    const productPrice =
        Number(
            product.price || 0
        );

    const enoughBalance =
        userBalance >=
        productPrice;

    content.innerHTML = `
        <div class="buy-modal">

            ${
                product.image
                    ? `
                        <img
                            src="${escapeHtml(
                                product.image
                            )}"
                            alt="${escapeHtml(
                                product.name
                            )}"
                            class="buy-modal-image"
                        >
                    `
                    : `
                        <div class="buy-modal-placeholder">
                            📦
                        </div>
                    `
            }

            <div class="buy-modal-info">

                <h2>
                    ${escapeHtml(
                        product.name
                    )}
                </h2>

                ${
                    product.description
                        ? `
                            <p>
                                ${escapeHtml(
                                    product.description
                                )}
                            </p>
                        `
                        : ""
                }

                <div class="buy-info-row">

                    <span>
                        ${escapeHtml(
                            t("price")
                        )}
                    </span>

                    <strong>
                        ${formatNumber(
                            productPrice
                        )}
                        ⭐
                    </strong>

                </div>

                <div class="buy-info-row">

                    <span>
                        ${escapeHtml(
                            t("balance")
                        )}
                    </span>

                    <strong>
                        ${formatNumber(
                            userBalance
                        )}
                        ⭐
                    </strong>

                </div>

                <div class="
                    delivery-info
                    ${deliveryType}
                ">
                    ${escapeHtml(
                        deliveryLabel
                    )}
                </div>

                ${
                    !enoughBalance
                        ? `
                            <div class="insufficient-warning">
                                ⚠️ رصيدك غير كافٍ لإتمام عملية الشراء.
                            </div>
                        `
                        : ""
                }

                <div class="buy-actions">

                    <button
                        type="button"
                        class="modal-cancel-btn"
                        onclick="closeModal()"
                    >
                        ${escapeHtml(
                            t("cancel")
                        )}
                    </button>

                    <button
                        type="button"
                        class="modal-confirm-btn"
                        ${
                            !enoughBalance
                                ? "disabled"
                                : ""
                        }
                        onclick="confirmBuy(${Number(
                            product.id
                        )})"
                    >
                        ${
                            deliveryType ===
                            "code"
                                ? "⚡ شراء واستلام الكود"
                                : "🛒 تأكيد الطلب"
                        }
                    </button>

                </div>

            </div>

        </div>
    `;

    modal.classList.add(
        "active"
    );

    modal.style.display =
        "flex";

    haptic("light");

    try {

        if (
            tg &&
            typeof tg.BackButton?.show ===
                "function"
        ) {

            tg.BackButton.show();

            tg.BackButton.onClick(
                closeModal
            );
        }

    } catch (_) {}
}

/* =========================================================
   CONFIRM BUY
========================================================= */

async function confirmBuy(
    productId
) {

    if (
        purchaseInProgress
    ) {
        return;
    }

    const product =
        products.find(
            (item) =>
                Number(item.id) ===
                Number(productId)
        );

    if (!product) {

        showToast(
            "المنتج غير موجود",
            "error"
        );

        return;
    }

    const currentBalance =
        Number(
            currentUser?.balance || 0
        );

    const price =
        Number(
            product.price || 0
        );

    if (
        currentBalance <
        price
    ) {

        showToast(
            t(
                "insufficientBalance"
            ),
            "error"
        );

        haptic("heavy");

        return;
    }

    purchaseInProgress =
        true;

    haptic("medium");

    const modalContent =
        document.getElementById(
            "modalContent"
        );

    if (modalContent) {

        modalContent.innerHTML = `
            <div class="purchase-loading">

                <div class="loading-spinner"></div>

                <h3>
                    جاري تنفيذ عملية الشراء...
                </h3>

                <p>
                    يرجى عدم إغلاق المتجر.
                </p>

            </div>
        `;
    }

    try {

        const response =
            await apiRequest(
                "/api/buy",
                {
                    method: "POST",

                    body: JSON.stringify({
                        product_id:
                            Number(productId)
                    })
                }
            );

        if (
            !response ||
            !response.success
        ) {

            throw new Error(
                response?.message ||
                "فشل تنفيذ عملية الشراء"
            );
        }

        /* =========================================
           UPDATE BALANCE
        ========================================= */

        if (
            typeof response.balance !==
            "undefined"
        ) {

            updateBalance(
                response.balance
            );
        }

        /* =========================================
           CLOSE OLD MODAL
        ========================================= */

        closeModal();

        /* =========================================
           AUTOMATIC CODE
        ========================================= */

        if (
            response.code
        ) {

            showCodeResult(
                response
            );

            haptic("success");

        } else {

            /* =====================================
               MANUAL ORDER
            ===================================== */

            showOrderResult(
                response,
                product
            );

            haptic("success");
        }

        /* =========================================
           REFRESH USER
        ========================================= */

        await refreshBalance();

        /* =========================================
           REFRESH PRODUCTS
        ========================================= */

        await loadProducts();

    } catch (error) {

        console.error(
            "❌ Purchase error:",
            error
        );

        if (
            error.status === 401
        ) {

            showToast(
                t(
                    "authenticationRequired"
                ),
                "error"
            );

        } else {

            showToast(
                error.message ||
                "حدث خطأ أثناء تنفيذ الطلب",
                "error"
            );
        }

        haptic("heavy");

    } finally {

        purchaseInProgress =
            false;
    }
}

/* =========================================================
   SHOW MANUAL ORDER RESULT
========================================================= */

function showOrderResult(
    response,
    product
) {

    const modal =
        document.getElementById(
            "modal"
        );

    const content =
        document.getElementById(
            "modalContent"
        );

    if (!modal || !content) {

        showToast(
            `تم إنشاء الطلب #${response.order_id}`,
            "success"
        );

        return;
    }

    content.innerHTML = `

        <div class="purchase-result">

            <div class="success-icon">
                ✓
            </div>

            <h2>
                تم إنشاء طلبك بنجاح
            </h2>

            <p class="result-subtitle">
                ${escapeHtml(
                    product.name
                )}
            </p>

            <div class="result-card">

                <div>
                    <span>
                        رقم الطلب
                    </span>

                    <strong>
                        #${escapeHtml(
                            response.order_id
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        المبلغ
                    </span>

                    <strong>
                        ${formatNumber(
                            product.price
                        )}
                        ⭐
                    </strong>
                </div>

                <div>
                    <span>
                        الرصيد المتبقي
                    </span>

                    <strong>
                        ${formatNumber(
                            response.balance
                        )}
                        ⭐
                    </strong>
                </div>

            </div>

            <div class="manual-notice">

                🛠️ سيتم تنفيذ طلبك يدوياً.

                <br>

                سيتم التواصل معك عند اكتمال الطلب.

            </div>

            <button
                type="button"
                class="result-close-btn"
                onclick="closeModal()"
            >
                إغلاق
            </button>

        </div>
    `;

    modal.classList.add(
        "active"
    );

    modal.style.display =
        "flex";
}

/* =========================================================
   SHOW CODE RESULT
========================================================= */

function showCodeResult(
    response
) {

    const modal =
        document.getElementById(
            "modal"
        );

    const content =
        document.getElementById(
            "modalContent"
        );

    if (!modal || !content) {

        showToast(
            "تم شراء الكود بنجاح",
            "success"
        );

        return;
    }

    const code =
        String(
            response.code
        );

    content.innerHTML = `

        <div class="purchase-result code-result">

            <div class="success-icon">
                ✓
            </div>

            <h2>
                تم الشراء بنجاح
            </h2>

            <p class="result-subtitle">
                تم تسليم الكود تلقائياً
            </p>

            <div class="code-box">

                <span>
                    الكود الخاص بك
                </span>

                <strong
                    id="purchasedCode"
                >
                    ${escapeHtml(
                        code
                    )}
                </strong>

            </div>

            <div class="result-card">

                ${
                    response.order_id
                        ? `
                            <div>
                                <span>
                                    رقم الطلب
                                </span>

                                <strong>
                                    #${escapeHtml(
                                        response.order_id
                                    )}
                                </strong>
                            </div>
                        `
                        : ""
                }

                <div>

                    <span>
                        الرصيد المتبقي
                    </span>

                    <strong>
                        ${formatNumber(
                            response.balance
                        )}
                        ⭐
                    </strong>

                </div>

            </div>

            <button
                type="button"
                class="copy-code-btn"
                onclick="copyPurchasedCode()"
            >
                📋 نسخ الكود
            </button>

            <button
                type="button"
                class="result-close-btn"
                onclick="closeModal()"
            >
                إغلاق
            </button>

        </div>
    `;

    modal.classList.add(
        "active"
    );

    modal.style.display =
        "flex";

    haptic("heavy");
}

/* =========================================================
   COPY PURCHASED CODE
========================================================= */

async function copyPurchasedCode() {

    const element =
        document.getElementById(
            "purchasedCode"
        );

    if (!element) {
        return;
    }

    const code =
        element.textContent.trim();

    try {

        await navigator.clipboard.writeText(
            code
        );

        showToast(
            t("copied"),
            "success"
        );

        haptic("light");

    } catch (error) {

        /* fallback */

        try {

            const textarea =
                document.createElement(
                    "textarea"
                );

            textarea.value =
                code;

            textarea.style.position =
                "fixed";

            textarea.style.opacity =
                "0";

            document.body.appendChild(
                textarea
            );

            textarea.select();

            document.execCommand(
                "copy"
            );

            textarea.remove();

            showToast(
                t("copied"),
                "success"
            );

        } catch (_) {

            showToast(
                "انسخ الكود يدوياً",
                "info"
            );
        }
    }
}

/* =========================================================
   MODAL CLICK OUTSIDE
========================================================= */

document.addEventListener(
    "click",
    (event) => {

        const modal =
            document.getElementById(
                "modal"
            );

        if (
            !modal ||
            modal.style.display !==
                "flex"
        ) {
            return;
        }

        if (
            event.target ===
            modal
        ) {

            if (
                !purchaseInProgress
            ) {

                closeModal();
            }
        }
    }
);

/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Escape"
        ) {

            if (
                !purchaseInProgress
            ) {

                closeModal();
            }
        }
    }
);

/* =========================================================
   TELEGRAM BACK BUTTON
========================================================= */

if (tg) {

    try {

        tg.BackButton.onClick(
            () => {

                if (
                    purchaseInProgress
                ) {
                    return;
                }

                closeModal();

                try {

                    tg.BackButton.hide();

                } catch (_) {}
            }
        );

    } catch (_) {}
}

/* =========================================================
   BALANCE AUTO REFRESH
========================================================= */

function startBalanceAutoRefresh() {

    clearInterval(
        balanceRefreshTimer
    );

    balanceRefreshTimer =
        setInterval(
            () => {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    refreshBalance();
                }

            },
            5000
        );
}

/* =========================================================
   VISIBILITY CHANGE
========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            refreshBalance();
        }
    }
);

/* =========================================================
   WINDOW FOCUS
========================================================= */

window.addEventListener(
    "focus",
    () => {

        refreshBalance();
    }
);

/* =========================================================
   PAGE SHOW
========================================================= */

window.addEventListener(
    "pageshow",
    () => {

        refreshBalance();
    }
);

/* =========================================================
   INITIALIZE STORE
========================================================= */

async function initStore() {

    console.log(
        "🛍️ Initializing Telegram Store..."
    );

    if (!tg) {

        console.warn(
            "⚠️ Telegram WebApp object not found."
        );
    }

    const userLoaded =
        await loadUser();

    await loadProducts();

    startBalanceAutoRefresh();

    console.log(
        "✅ Store initialized"
    );

    if (!userLoaded) {

        console.warn(
            "⚠️ User authentication failed."
        );
    }
}

/* =========================================================
   WINDOW EXPORTS
========================================================= */

window.openBuy =
    openBuy;

window.confirmBuy =
    confirmBuy;

window.closeModal =
    closeModal;

window.showToast =
    showToast;

window.loadProducts =
    loadProducts;

window.refreshBalance =
    refreshBalance;

window.copyPurchasedCode =
    copyPurchasedCode;

window.initStore =
    initStore;

/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initStore
    );

} else {

    initStore();
}