/* =========================================================
   TELEGRAM DIGITAL STORE
   APP.JS
   VERSION: 2.0.0
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
let orders = [];

let currentProductId = null;

let purchaseInProgress = false;

let balanceRefreshTimer = null;

let currentTab = "store";

let currentSearch = "";

let currentDeliveryFilter = "all";

let currentPriceFilter = "all";

/* =========================================================
   INIT TELEGRAM
========================================================= */

if (tg) {

    try {

        tg.ready();
        tg.expand();

        if (
            typeof tg.enableClosingConfirmation ===
            "function"
        ) {

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

        balance: "الرصيد",

        price: "السعر",

        product: "المنتج",

        orderNumber: "رقم الطلب",

        remainingBalance:
            "الرصيد المتبقي",

        code: "الكود",

        copy: "نسخ",

        copied: "تم نسخ الكود",

        loading:
            "جاري التحميل...",

        cancel:
            "إلغاء",

        confirm:
            "تأكيد",

        insufficientBalance:
            "رصيدك غير كافٍ",

        authenticationRequired:
            "يجب فتح المتجر من داخل تيليجرام",

        noProducts:
            "لا توجد منتجات متاحة حالياً",

        noOrders:
            "لا توجد عمليات شراء حتى الآن",

        automaticDelivery:
            "تسليم تلقائي",

        manualDelivery:
            "تنفيذ يدوي",

        available:
            "متوفر",

        outOfStock:
            "نفد المخزون",

        error:
            "حدث خطأ غير متوقع",

        store:
            "المتجر",

        history:
            "سجل الشراء",

        settings:
            "الإعدادات",

        all:
            "الكل",

        automatic:
            "تلقائي",

        manual:
            "يدوي",

        allPrices:
            "كل الأسعار",

        cheap:
            "أقل من 50",

        medium:
            "50 - 200",

        expensive:
            "أكثر من 200",

        processing:
            "جاري تنفيذ الطلب...",

        orderCreated:
            "تم إنشاء طلبك",

        purchaseSuccess:
            "تمت عملية الشراء بنجاح",

        pending:
            "قيد التنفيذ",

        completed:
            "مكتمل",

        rejected:
            "مرفوض",

        refunded:
            "تم استرجاع المبلغ",

        close:
            "إغلاق",

        search:
            "ابحث عن منتج...",

        refresh:
            "تحديث",

        automaticDescription:
            "يتم تسليم المنتج مباشرة بعد الدفع.",

        manualDescription:
            "سيتم تنفيذ الطلب يدوياً والتواصل معك.",

        purchaseHistory:
            "عمليات الشراء السابقة",

        account:
            "الحساب",

        telegramId:
            "معرف تيليجرام",

        username:
            "اسم المستخدم",

        wallet:
            "المحفظة",

        currentBalance:
            "الرصيد الحالي",

        delivery:
            "طريقة التسليم",

        orderDate:
            "تاريخ الطلب",

        noImage:
            "منتج",

        purchase:
            "شراء المنتج",

        confirmPurchase:
            "تأكيد عملية الشراء",

        confirmOrder:
            "هل تريد تأكيد شراء هذا المنتج؟",

        automaticReady:
            "سيتم تسليم الكود تلقائياً بعد نجاح العملية.",

        manualReady:
            "سيتم إنشاء طلب وسيتم تنفيذه من الإدارة.",

        orderSuccess:
            "تم إنشاء طلبك بنجاح",

        codeSuccess:
            "تم الشراء وتسليم الكود بنجاح",

        manualNotice:
            "سيتم تنفيذ طلبك يدوياً والتواصل معك عند اكتماله.",

        codeDelivered:
            "تم تسليم الكود تلقائياً",

        copyCode:
            "نسخ الكود",

        copiedSuccessfully:
            "تم نسخ الكود بنجاح",

        orderDetails:
            "تفاصيل الطلب",

        status:
            "الحالة",

        searchOrders:
            "ابحث في سجل الشراء...",

        topUp:
            "شحن الرصيد",

        topUpDescription:
            "يمكنك التواصل مع الإدارة لشحن رصيد حسابك.",

        contactAdmin:
            "التواصل مع الإدارة",

        accountInfo:
            "معلومات الحساب",

        storeBalance:
            "رصيد المتجر",

        refreshBalance:
            "تحديث الرصيد",

        products:
            "المنتجات",

        orders:
            "الطلبات"
    },

    en: {

        buy: "Buy",

        balance: "Balance",

        price: "Price",

        product: "Product",

        orderNumber: "Order",

        remainingBalance:
            "Remaining balance",

        code: "Code",

        copy: "Copy",

        copied: "Code copied",

        loading: "Loading...",

        cancel: "Cancel",

        confirm: "Confirm",

        insufficientBalance:
            "Insufficient balance",

        authenticationRequired:
            "Please open the store from Telegram",

        noProducts:
            "No products available",

        noOrders:
            "No purchases yet",

        automaticDelivery:
            "Automatic delivery",

        manualDelivery:
            "Manual fulfillment",

        available:
            "Available",

        outOfStock:
            "Out of stock",

        error:
            "Unexpected error",

        store: "Store",

        history: "Purchase History",

        settings: "Settings",

        all: "All",

        automatic: "Automatic",

        manual: "Manual",

        allPrices: "All prices",

        cheap: "Under 50",

        medium: "50 - 200",

        expensive: "Over 200",

        processing:
            "Processing...",

        orderCreated:
            "Your order has been created",

        purchaseSuccess:
            "Purchase completed",

        pending: "Pending",

        completed: "Completed",

        rejected: "Rejected",

        refunded: "Refunded",

        close: "Close",

        search:
            "Search products...",

        refresh: "Refresh",

        automaticDescription:
            "Delivered instantly after payment.",

        manualDescription:
            "The order will be fulfilled manually.",

        purchaseHistory:
            "Previous purchases",

        account: "Account",

        telegramId:
            "Telegram ID",

        username:
            "Username",

        wallet: "Wallet",

        currentBalance:
            "Current balance",

        delivery:
            "Delivery",

        orderDate:
            "Order date",

        noImage:
            "Product",

        purchase:
            "Purchase",

        confirmPurchase:
            "Confirm purchase",

        confirmOrder:
            "Confirm this purchase?",

        automaticReady:
            "The code will be delivered automatically.",

        manualReady:
            "An order will be created for manual fulfillment.",

        orderSuccess:
            "Order created successfully",

        codeSuccess:
            "Purchase completed successfully",

        manualNotice:
            "Your order will be processed manually.",

        codeDelivered:
            "Code delivered automatically",

        copyCode:
            "Copy code",

        copiedSuccessfully:
            "Code copied successfully",

        orderDetails:
            "Order details",

        status:
            "Status",

        searchOrders:
            "Search purchase history...",

        topUp:
            "Top up balance",

        topUpDescription:
            "Contact administration to add balance.",

        contactAdmin:
            "Contact admin",

        accountInfo:
            "Account information",

        storeBalance:
            "Store balance",

        refreshBalance:
            "Refresh balance",

        products:
            "Products",

        orders:
            "Orders"
    }
};

/* =========================================================
   LANGUAGE
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
   SVG ICONS
========================================================= */

function svgIcon(
    name,
    size = 20
) {

    const icons = {

        wallet: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v9a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7"/>
                <path d="M2 7a3 3 0 0 1 3-3h13a2 2 0 0 1 2 2v1"/>
                <path d="M16 14h.01"/>
            </svg>
        `,

        store: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M3 10l1-5h16l1 5"/>
                <path d="M5 10v9h14v-9"/>
                <path d="M3 10c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3"/>
                <path d="M9 19v-4h6v4"/>
            </svg>
        `,

        history: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M3 12a9 9 0 1 0 3-6.7"/>
                <path d="M3 4v5h5"/>
                <path d="M12 7v5l3 2"/>
            </svg>
        `,

        settings: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-2.5v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-2.5h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L8 7.7l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V6h2.5v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v2.5h-.1a1.7 1.7 0 0 0-1.5 1z"/>
            </svg>
        `,

        search: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="11" cy="11" r="7"/>
                <path d="m20 20-4-4"/>
            </svg>
        `,

        refresh: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M20 11a8.1 8.1 0 0 0-14.7-4.7L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M4 13a8.1 8.1 0 0 0 14.7 4.7L21 16"/>
                <path d="M21 21v-5h-5"/>
            </svg>
        `,

        bolt: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="m13 2-9 12h7l-1 8 9-12h-7z"/>
            </svg>
        `,

        wrench: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-3-3z"/>
            </svg>
        `,

        package: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="m16.5 9.4-9-5.2"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <path d="M3.3 7 12 12l8.7-5"/>
                <path d="M12 22V12"/>
            </svg>
        `,

        check: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="m5 12 4 4L19 6"/>
            </svg>
        `,

        close: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
        `,

        copy: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <rect x="9" y="9" width="11" height="11" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
        `,

        user: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 21a8 8 0 0 1 16 0"/>
            </svg>
        `,

        arrow: `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M5 12h14"/>
                <path d="m13 6 6 6-6 6"/>
            </svg>
        `
    };

    return icons[name] || "";
}

/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "info"
) {

    const toast =
        document.getElementById(
            "toast"
        );

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
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3500
        );
}

/* =========================================================
   HAPTIC
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
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

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
        "en-US",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}

/* =========================================================
   MONEY
========================================================= */

function money(
    number
) {

    return `
        <span class="money-value">
            ${formatNumber(number)}
            <small>د.ل</small>
        </span>
    `;
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
                data?.error ||
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

        if (
            !getTelegramInitData()
        ) {

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
                `/api/me?_=${Date.now()}`
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
            "loadUser:",
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

    document
        .querySelectorAll(
            "[data-user-name]"
        )
        .forEach(
            element => {

                element.textContent =
                    name;
            }
        );

    document
        .querySelectorAll(
            "[data-user-username]"
        )
        .forEach(
            element => {

                element.textContent =
                    username;
            }
        );

    document
        .querySelectorAll(
            "[data-user-id]"
        )
        .forEach(
            element => {

                element.textContent =
                    id;
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

    const welcomeName =
        document.getElementById(
            "welcomeName"
        );

    if (welcomeName) {

        welcomeName.textContent =
            name;
    }

    const userId =
        document.getElementById(
            "userId"
        );

    if (userId) {

        userId.textContent =
            id;
    }

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

    document
        .querySelectorAll(
            "[data-balance]"
        )
        .forEach(
            element => {

                element.innerHTML =
                    money(value);
            }
        );

    const balanceElement =
        document.getElementById(
            "balance"
        );

    if (balanceElement) {

        balanceElement.innerHTML =
            money(value);
    }

    const balanceValue =
        document.getElementById(
            "balanceValue"
        );

    if (balanceValue) {

        balanceValue.innerHTML =
            money(value);
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
                `/api/me?_=${Date.now()}`
            );

        if (
            data?.success &&
            data.user
        ) {

            currentUser =
                data.user;

            updateUserInterface();
        }

    } catch (error) {

        console.error(
            "refreshBalance:",
            error
        );
    }
}

/* =========================================================
   GET DELIVERY TYPE
========================================================= */

function getProductDeliveryType(
    product
) {

    if (
        product?.delivery_type ===
            "code" ||
        product?.delivery_type ===
            "automatic"
    ) {

        return "code";
    }

    return "manual";
}

/* =========================================================
   GET STOCK
========================================================= */

function getProductStock(
    product
) {

    return Number(
        product?.stock_count ??
        product?.stock ??
        0
    );
}

/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    try {

        const data =
            await apiRequest(
                `/api/products?_=${Date.now()}`
            );

        products =
            Array.isArray(
                data?.products
            )
                ? data.products
                : [];

        renderProducts();

        updateProductCount();

        return true;

    } catch (error) {

        console.error(
            "loadProducts:",
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
                        ${svgIcon("refresh", 34)}
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

    if (count) {

        count.textContent =
            products.length;
    }
}

/* =========================================================
   FILTER PRODUCTS
========================================================= */

function getFilteredProducts() {

    const search =
        currentSearch
            .trim()
            .toLowerCase();

    return products.filter(
        product => {

            const name =
                String(
                    product.name || ""
                )
                .toLowerCase();

            const description =
                String(
                    product.description || ""
                )
                .toLowerCase();

            const delivery =
                getProductDeliveryType(
                    product
                );

            const price =
                Number(
                    product.price || 0
                );

            if (
                search &&
                !name.includes(search) &&
                !description.includes(search)
            ) {

                return false;
            }

            if (
                currentDeliveryFilter !==
                "all"
            ) {

                if (
                    currentDeliveryFilter !==
                    delivery
                ) {

                    return false;
                }
            }

            if (
                currentPriceFilter ===
                "cheap" &&
                price >= 50
            ) {

                return false;
            }

            if (
                currentPriceFilter ===
                "medium" &&
                (
                    price < 50 ||
                    price > 200
                )
            ) {

                return false;
            }

            if (
                currentPriceFilter ===
                "expensive" &&
                price <= 200
            ) {

                return false;
            }

            return true;
        }
    );
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

    const filtered =
        getFilteredProducts();

    updateProductCount();

    if (!filtered.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ${svgIcon("package", 36)}
                </div>

                <div class="empty-title">
                    ${
                        products.length
                            ? "لا توجد نتائج مطابقة"
                            : escapeHtml(
                                t("noProducts")
                            )
                    }
                </div>

            </div>
        `;

        return;
    }

    container.innerHTML =
        filtered
            .map(
                product =>
                    createProductCard(
                        product
                    )
            )
            .join("");
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
            product.name || ""
        );

    const description =
        escapeHtml(
            product.description || ""
        );

    const image =
        escapeHtml(
            product.image || ""
        );

    const price =
        Number(
            product.price || 0
        );

    const delivery =
        getProductDeliveryType(
            product
        );

    const stock =
        getProductStock(
            product
        );

    const isCode =
        delivery === "code";

    const outOfStock =
        isCode &&
        stock <= 0;

    const deliveryLabel =
        isCode
            ? t("automaticDelivery")
            : t("manualDelivery");

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
                        this.parentElement.classList.add('no-image');
                    "
                >
            `
            : `
                <div class="product-image-placeholder">
                    ${svgIcon("package", 42)}
                </div>
            `;

    return `
        <article
            class="product-card
                ${outOfStock ? "sold-out" : ""}"
            data-product-id="${id}"
        >

            <div class="product-image-wrap">

                ${imageHtml}

                <span class="
                    product-delivery-badge
                    ${isCode ? "code" : "manual"}
                ">

                    ${svgIcon(
                        isCode
                            ? "bolt"
                            : "wrench",
                        14
                    )}

                    ${escapeHtml(
                        deliveryLabel
                    )}

                </span>

            </div>

            <div class="product-content">

                <div class="product-top">

                    <h3 class="product-name">
                        ${name}
                    </h3>

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

                ${
                    isCode
                        ? `
                            <div class="stock-line">

                                <span>
                                    ${svgIcon(
                                        "package",
                                        14
                                    )}

                                    ${
                                        outOfStock
                                            ? t(
                                                "outOfStock"
                                            )
                                            : `${t(
                                                "available"
                                            )}: ${stock}`
                                    }

                                </span>

                            </div>
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
                            ${formatNumber(
                                price
                            )}
                        </strong>

                        <small>
                            د.ل
                        </small>

                    </div>

                    <button
                        type="button"
                        class="buy-btn"
                        ${
                            outOfStock
                                ? "disabled"
                                : ""
                        }
                        onclick="
                            openBuy(${id})
                        "
                    >

                        <span>
                            ${
                                outOfStock
                                    ? t(
                                        "outOfStock"
                                    )
                                    : t("buy")
                            }
                        </span>

                        ${
                            outOfStock
                                ? ""
                                : svgIcon(
                                    "arrow",
                                    17
                                )
                        }

                    </button>

                </div>

            </div>

        </article>
    `;
}

/* =========================================================
   SEARCH
========================================================= */

function setupProductSearch() {

    const input =
        document.getElementById(
            "productSearch"
        );

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        () => {

            currentSearch =
                input.value || "";

            renderProducts();
        }
    );
}

/* =========================================================
   DELIVERY FILTER
========================================================= */

function setDeliveryFilter(
    filter
) {

    currentDeliveryFilter =
        filter;

    document
        .querySelectorAll(
            "[data-delivery-filter]"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.deliveryFilter ===
                    filter
                );
            }
        );

    renderProducts();
}

/* =========================================================
   PRICE FILTER
========================================================= */

function setPriceFilter(
    filter
) {

    currentPriceFilter =
        filter;

    document
        .querySelectorAll(
            "[data-price-filter]"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.priceFilter ===
                    filter
                );
            }
        );

    renderProducts();
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
            item =>
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

    const delivery =
        getProductDeliveryType(
            product
        );

    const stock =
        getProductStock(
            product
        );

    if (
        delivery === "code" &&
        stock <= 0
    ) {

        showToast(
            t("outOfStock"),
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

    const price =
        Number(
            product.price || 0
        );

    const balance =
        Number(
            currentUser?.balance || 0
        );

    const enough =
        balance >= price;

    const isCode =
        delivery === "code";

    content.innerHTML = `

        <div class="buy-modal">

            <button
                type="button"
                class="modal-close-icon"
                onclick="closeModal()"
                aria-label="${t("close")}"
            >
                ${svgIcon("close", 21)}
            </button>

            <div class="buy-modal-image-wrap">

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
                                ${svgIcon(
                                    "package",
                                    46
                                )}
                            </div>
                        `
                }

            </div>

            <div class="buy-modal-info">

                <div class="modal-kicker">
                    ${svgIcon(
                        isCode
                            ? "bolt"
                            : "wrench",
                        15
                    )}

                    ${
                        isCode
                            ? t(
                                "automaticDelivery"
                            )
                            : t(
                                "manualDelivery"
                            )
                    }
                </div>

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

                <div class="buy-info-card">

                    <div class="buy-info-row">

                        <span>
                            ${escapeHtml(
                                t("price")
                            )}
                        </span>

                        <strong>
                            ${money(price)}
                        </strong>

                    </div>

                    <div class="buy-info-row">

                        <span>
                            ${escapeHtml(
                                t("balance")
                            )}
                        </span>

                        <strong>
                            ${money(balance)}
                        </strong>

                    </div>

                    <div class="buy-info-row total-row">

                        <span>
                            بعد الشراء
                        </span>

                        <strong>
                            ${money(
                                Math.max(
                                    0,
                                    balance - price
                                )
                            )}
                        </strong>

                    </div>

                </div>

                <div class="
                    delivery-info
                    ${isCode ? "code" : "manual"}
                ">

                    ${svgIcon(
                        isCode
                            ? "bolt"
                            : "wrench",
                        18
                    )}

                    <div>

                        <strong>
                            ${
                                isCode
                                    ? "تسليم تلقائي وفوري"
                                    : "تنفيذ يدوي"
                            }
                        </strong>

                        <small>
                            ${
                                isCode
                                    ? t(
                                        "automaticReady"
                                    )
                                    : t(
                                        "manualReady"
                                    )
                            }
                        </small>

                    </div>

                </div>

                ${
                    !enough
                        ? `
                            <div class="insufficient-warning">

                                ${svgIcon(
                                    "wallet",
                                    18
                                )}

                                <span>
                                    رصيدك غير كافٍ.
                                    تحتاج إلى
                                    ${money(
                                        price -
                                        balance
                                    )}
                                    إضافية.
                                </span>

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
                            !enough
                                ? "disabled"
                                : ""
                        }
                        onclick="
                            confirmBuy(${Number(
                                product.id
                            )})
                        "
                    >

                        ${svgIcon(
                            isCode
                                ? "bolt"
                                : "check",
                            18
                        )}

                        ${
                            isCode
                                ? "شراء واستلام الكود"
                                : "تأكيد الطلب"
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
        }

    } catch (_) {}
}

/* =========================================================
   REQUEST ID
========================================================= */

function createClientRequestId() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
        "function"
    ) {

        return window.crypto.randomUUID();
    }

    return [
        Date.now(),
        Math.random()
            .toString(36)
            .slice(2),
        Math.random()
            .toString(36)
            .slice(2)
    ].join("-");
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
            item =>
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

    const balance =
        Number(
            currentUser?.balance || 0
        );

    const price =
        Number(
            product.price || 0
        );

    if (
        balance < price
    ) {

        showToast(
            t("insufficientBalance"),
            "error"
        );

        haptic("heavy");

        return;
    }

    purchaseInProgress =
        true;

    haptic("medium");

    const content =
        document.getElementById(
            "modalContent"
        );

    if (content) {

        content.innerHTML = `

            <div class="purchase-loading">

                <div class="loading-spinner">
                </div>

                <div class="loading-icon">
                    ${svgIcon(
                        "wallet",
                        28
                    )}
                </div>

                <h3>
                    ${escapeHtml(
                        t("processing")
                    )}
                </h3>

                <p>
                    يرجى عدم إغلاق المتجر حتى تكتمل العملية.
                </p>

            </div>
        `;
    }

    const clientRequestId =
        createClientRequestId();

    try {

        const response =
            await apiRequest(
                "/api/buy",
                {

                    method: "POST",

                    body:
                        JSON.stringify({

                            product_id:
                                Number(
                                    productId
                                ),

                            client_request_id:
                                clientRequestId

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

        if (
            typeof response.balance !==
            "undefined"
        ) {

            updateBalance(
                response.balance
            );
        }

        closeModal();

        if (
            response.code
        ) {

            showCodeResult(
                response,
                product
            );

            haptic("success");

        } else {

            showOrderResult(
                response,
                product
            );

            haptic("success");
        }

        await refreshBalance();

        await loadProducts();

        await loadOrders();

    } catch (error) {

        console.error(
            "Purchase error:",
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
   SHOW MANUAL RESULT
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
            `${t(
                "orderCreated"
            )} #${response.order_id}`,
            "success"
        );

        return;
    }

    content.innerHTML = `

        <div class="purchase-result">

            <div class="success-icon">
                ${svgIcon(
                    "check",
                    31
                )}
            </div>

            <h2>
                ${escapeHtml(
                    t("orderSuccess")
                )}
            </h2>

            <p class="result-subtitle">
                ${escapeHtml(
                    product.name
                )}
            </p>

            <div class="result-card">

                <div>

                    <span>
                        ${escapeHtml(
                            t("orderNumber")
                        )}
                    </span>

                    <strong>
                        #${escapeHtml(
                            response.order_id
                        )}
                    </strong>

                </div>

                <div>

                    <span>
                        ${escapeHtml(
                            t("price")
                        )}
                    </span>

                    <strong>
                        ${money(
                            product.price
                        )}
                    </strong>

                </div>

                <div>

                    <span>
                        ${escapeHtml(
                            t("remainingBalance")
                        )}
                    </span>

                    <strong>
                        ${money(
                            response.balance
                        )}
                    </strong>

                </div>

            </div>

            <div class="manual-notice">

                ${svgIcon(
                    "wrench",
                    19
                )}

                <span>
                    ${escapeHtml(
                        t("manualNotice")
                    )}
                </span>

            </div>

            <button
                type="button"
                class="result-close-btn"
                onclick="closeModal()"
            >
                ${escapeHtml(
                    t("close")
                )}
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
            t("codeSuccess"),
            "success"
        );

        return;
    }

    const code =
        String(
            response.code || ""
        );

    content.innerHTML = `

        <div class="purchase-result code-result">

            <div class="success-icon">
                ${svgIcon(
                    "check",
                    31
                )}
            </div>

            <h2>
                ${escapeHtml(
                    t("codeSuccess")
                )}
            </h2>

            <p class="result-subtitle">
                ${escapeHtml(
                    product?.name ||
                    ""
                )}
            </p>

            <div class="code-box">

                <span>
                    ${escapeHtml(
                        t("code")
                    )}
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
                                    ${escapeHtml(
                                        t("orderNumber")
                                    )}
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
                        ${escapeHtml(
                            t(
                                "remainingBalance"
                            )
                        )}
                    </span>

                    <strong>
                        ${money(
                            response.balance
                        )}
                    </strong>

                </div>

            </div>

            <button
                type="button"
                class="copy-code-btn"
                onclick="copyPurchasedCode()"
            >

                ${svgIcon(
                    "copy",
                    18
                )}

                ${escapeHtml(
                    t("copyCode")
                )}

            </button>

            <button
                type="button"
                class="result-close-btn"
                onclick="closeModal()"
            >
                ${escapeHtml(
                    t("close")
                )}
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
   COPY CODE
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

        await navigator
            .clipboard
            .writeText(code);

        showToast(
            t(
                "copiedSuccessfully"
            ),
            "success"
        );

        haptic("light");

    } catch (_) {

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
                t(
                    "copiedSuccessfully"
                ),
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
   CLOSE MODAL
========================================================= */

function closeModal() {

    const modal =
        document.getElementById(
            "modal"
        );

    if (!modal) {
        return;
    }

    if (
        purchaseInProgress
    ) {
        return;
    }

    modal.classList.remove(
        "active"
    );

    modal.style.display =
        "none";

    currentProductId =
        null;

    try {

        if (
            tg &&
            typeof tg.BackButton?.hide ===
            "function"
        ) {

            tg.BackButton.hide();
        }

    } catch (_) {}
}

/* =========================================================
   LOAD ORDERS
========================================================= */

async function loadOrders() {

    try {

        const data =
            await apiRequest(
                `/api/my-orders?_=${Date.now()}`
            );

        orders =
            Array.isArray(
                data?.orders
            )
                ? data.orders
                : [];

        renderOrders();

        updateOrdersCount();

        return true;

    } catch (error) {

        console.error(
            "loadOrders:",
            error
        );

        const container =
            document.getElementById(
                "orders"
            );

        if (container) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        ${svgIcon(
                            "history",
                            34
                        )}
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
   ORDERS COUNT
========================================================= */

function updateOrdersCount() {

    const count =
        document.getElementById(
            "ordersCount"
        );

    if (count) {

        count.textContent =
            orders.length;
    }
}

/* =========================================================
   ORDER STATUS
========================================================= */

function getOrderStatus(
    status
) {

    const normalized =
        String(
            status || "pending"
        ).toLowerCase();

    if (
        normalized ===
        "completed"
    ) {

        return {
            text: t("completed"),
            className: "completed"
        };
    }

    if (
        normalized ===
        "rejected"
    ) {

        return {
            text: t("rejected"),
            className: "rejected"
        };
    }

    if (
        normalized ===
        "refunded"
    ) {

        return {
            text: t("refunded"),
            className: "refunded"
        };
    }

    return {
        text: t("pending"),
        className: "pending"
    };
}

/* =========================================================
   ORDER DATE
========================================================= */

function formatOrderDate(
    value
) {

    if (!value) {
        return "";
    }

    try {

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(value);
        }

        return date.toLocaleString(
            "ar-LY",
            {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch (_) {

        return String(value);
    }
}

/* =========================================================
   ORDER SEARCH
========================================================= */

function getOrderSearchValue(
    order
) {

    return [
        order.id,
        order.order_id,
        order.product_name,
        order.status,
        order.code
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

/* =========================================================
   RENDER ORDERS
========================================================= */

function renderOrders(
    searchValue = ""
) {

    const container =
        document.getElementById(
            "orders"
        );

    if (!container) {
        return;
    }

    const search =
        String(
            searchValue || ""
        )
        .trim()
        .toLowerCase();

    const filtered =
        orders.filter(
            order => {

                if (!search) {
                    return true;
                }

                return getOrderSearchValue(
                    order
                ).includes(
                    search
                );
            }
        );

    if (!filtered.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ${svgIcon(
                        "history",
                        38
                    )}
                </div>

                <div class="empty-title">
                    ${escapeHtml(
                        t("noOrders")
                    )}
                </div>

            </div>
        `;

        return;
    }

    container.innerHTML =
        filtered
            .map(
                order =>
                    createOrderRow(
                        order
                    )
            )
            .join("");
}

/* =========================================================
   ORDER ROW
========================================================= */

function createOrderRow(
    order
) {

    const status =
        getOrderStatus(
            order.status
        );

    const id =
        order.id ||
        order.order_id ||
        "";

    const productName =
        escapeHtml(
            order.product_name ||
            order.name ||
            "منتج"
        );

    const price =
        Number(
            order.price || 0
        );

    const delivery =
        getProductDeliveryType(
            order
        );

    const hasCode =
        Boolean(
            order.code
        );

    return `
        <article
            class="order-row"
            data-order-id="${escapeHtml(
                id
            )}"
        >

            <div class="order-icon">
                ${svgIcon(
                    hasCode
                        ? "bolt"
                        : "package",
                    21
                )}
            </div>

            <div class="order-main">

                <div class="order-title-row">

                    <h3>
                        ${productName}
                    </h3>

                    <span class="
                        order-status
                        ${status.className}
                    ">
                        ${escapeHtml(
                            status.text
                        )}
                    </span>

                </div>

                <div class="order-meta">

                    <span>
                        #${escapeHtml(id)}
                    </span>

                    <span>
                        ${formatOrderDate(
                            order.created_at
                        )}
                    </span>

                </div>

                <div class="order-bottom">

                    <strong>
                        ${money(price)}
                    </strong>

                    <span class="
                        order-delivery
                        ${delivery}
                    ">

                        ${svgIcon(
                            delivery === "code"
                                ? "bolt"
                                : "wrench",
                            13
                        )}

                        ${
                            delivery === "code"
                                ? t(
                                    "automaticDelivery"
                                )
                                : t(
                                    "manualDelivery"
                                )
                        }

                    </span>

                </div>

                ${
                    hasCode
                        ? `
                            <div class="order-code">

                                <span>
                                    ${escapeHtml(
                                        t("code")
                                    )}
                                </span>

                                <strong>
                                    ${escapeHtml(
                                        order.code
                                    )}
                                </strong>

                                <button
                                    type="button"
                                    onclick="
                                        copyText(
                                            '${escapeHtml(
                                                String(
                                                    order.code
                                                )
                                            )}'
                                        )
                                    "
                                >
                                    ${svgIcon(
                                        "copy",
                                        15
                                    )}
                                </button>

                            </div>
                        `
                        : ""
                }

            </div>

        </article>
    `;
}

/* =========================================================
   COPY TEXT
========================================================= */

async function copyText(
    value
) {

    try {

        await navigator
            .clipboard
            .writeText(
                String(value)
            );

        showToast(
            t(
                "copiedSuccessfully"
            ),
            "success"
        );

        haptic("light");

    } catch (_) {

        showToast(
            "تعذر النسخ",
            "error"
        );
    }
}

/* =========================================================
   ORDER SEARCH SETUP
========================================================= */

function setupOrderSearch() {

    const input =
        document.getElementById(
            "orderSearch"
        );

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        () => {

            renderOrders(
                input.value
            );
        }
    );
}

/* =========================================================
   SWITCH TAB
========================================================= */

async function switchTab(
    tab
) {

    const allowed = [
        "store",
        "orders",
        "settings"
    ];

    if (
        !allowed.includes(tab)
    ) {

        tab = "store";
    }

    currentTab =
        tab;

    document
        .querySelectorAll(
            "[data-tab]"
        )
        .forEach(
            element => {

                element.classList.toggle(
                    "active",
                    element.dataset.tab ===
                    tab
                );
            }
        );

    document
        .querySelectorAll(
            ".view"
        )
        .forEach(
            view => {

                const viewName =
                    view.dataset.view ||
                    view.id?.replace(
                        "view-",
                        ""
                    );

                view.classList.toggle(
                    "active",
                    viewName === tab
                );
            }
        );

    document
        .querySelectorAll(
            "[data-view]"
        )
        .forEach(
            view => {

                view.classList.toggle(
                    "active",
                    view.dataset.view ===
                    tab
                );
            }
        );

    haptic("light");

    if (
        tab === "orders"
    ) {

        await loadOrders();
    }

    if (
        tab === "settings"
    ) {

        updateSettingsView();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* =========================================================
   NAVIGATION SETUP
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(
            "[data-tab]"
        )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        switchTab(
                            element.dataset.tab
                        );
                    }
                );
            }
        );
}

/* =========================================================
   SETTINGS VIEW
========================================================= */

function updateSettingsView() {

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
            : "—";

    const id =
        currentUser.id ||
        currentUser.telegram_id ||
        "—";

    const balance =
        Number(
            currentUser.balance || 0
        );

    document
        .querySelectorAll(
            "[data-settings-name]"
        )
        .forEach(
            el => {

                el.textContent =
                    name;
            }
        );

    document
        .querySelectorAll(
            "[data-settings-username]"
        )
        .forEach(
            el => {

                el.textContent =
                    username;
            }
        );

    document
        .querySelectorAll(
            "[data-settings-id]"
        )
        .forEach(
            el => {

                el.textContent =
                    id;
            }
        );

    document
        .querySelectorAll(
            "[data-settings-balance]"
        )
        .forEach(
            el => {

                el.innerHTML =
                    money(balance);
            }
        );
}

/* =========================================================
   CONTACT ADMIN
========================================================= */

function contactAdmin() {

    const username =
        window.STORE_ADMIN_USERNAME ||
        window.ADMIN_USERNAME ||
        "";

    if (username) {

        const clean =
            String(username)
                .replace(
                    /^@/,
                    ""
                );

        const url =
            `https://t.me/${clean}`;

        try {

            tg?.openTelegramLink
                ? tg.openTelegramLink(url)
                : window.open(
                    url,
                    "_blank"
                );

        } catch (_) {

            window.open(
                url,
                "_blank"
            );
        }

        return;
    }

    showToast(
        "تواصل مع الإدارة عبر قناة المتجر",
        "info"
    );
}

/* =========================================================
   REFRESH STORE
========================================================= */

async function refreshStore() {

    haptic("light");

    const button =
        document.getElementById(
            "refreshProducts"
        );

    if (button) {

        button.classList.add(
            "rotating"
        );
    }

    try {

        await Promise.all([
            refreshBalance(),
            loadProducts()
        ]);

        if (
            currentTab ===
            "orders"
        ) {

            await loadOrders();
        }

        showToast(
            "تم تحديث المتجر",
            "success"
        );

    } catch (_) {

        showToast(
            "تعذر تحديث المتجر",
            "error"
        );

    } finally {

        if (button) {

            setTimeout(
                () => {

                    button.classList.remove(
                        "rotating"
                    );

                },
                400
            );
        }
    }
}

/* =========================================================
   SETUP FILTERS
========================================================= */

function setupFilters() {

    document
        .querySelectorAll(
            "[data-delivery-filter]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        setDeliveryFilter(
                            button.dataset
                                .deliveryFilter
                        );
                    }
                );
            }
        );

    document
        .querySelectorAll(
            "[data-price-filter]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        setPriceFilter(
                            button.dataset
                                .priceFilter
                        );
                    }
                );
            }
        );
}

/* =========================================================
   MODAL OUTSIDE CLICK
========================================================= */

document.addEventListener(
    "click",
    event => {

        const modal =
            document.getElementById(
                "modal"
            );

        if (!modal) {
            return;
        }

        if (
            event.target ===
            modal &&
            !purchaseInProgress
        ) {

            closeModal();
        }
    }
);

/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape" &&
            !purchaseInProgress
        ) {

            closeModal();
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

                const modal =
                    document.getElementById(
                        "modal"
                    );

                if (
                    modal?.classList.contains(
                        "active"
                    )
                ) {

                    closeModal();

                    return;
                }

                switchTab(
                    "store"
                );

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
   VISIBILITY
========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            refreshBalance();

            if (
                currentTab ===
                "orders"
            ) {

                loadOrders();
            }
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
   GLOBAL REFRESH BUTTON
========================================================= */

function setupRefreshButton() {

    const button =
        document.getElementById(
            "refreshProducts"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        refreshStore
    );
}

/* =========================================================
   INITIALIZE UI
========================================================= */

function initializeUI() {

    setupNavigation();

    setupProductSearch();

    setupOrderSearch();

    setupFilters();

    setupRefreshButton();

    updateSettingsView();

    /*
     * Support buttons that already use
     * onclick="switchTab('store')"
     */
    window.switchTab =
        switchTab;

    window.setDeliveryFilter =
        setDeliveryFilter;

    window.setPriceFilter =
        setPriceFilter;

    window.refreshStore =
        refreshStore;

    window.contactAdmin =
        contactAdmin;
}

/* =========================================================
   INITIALIZE STORE
========================================================= */

async function initStore() {

    console.log(
        "Telegram Digital Store initializing..."
    );

    initializeUI();

    if (!tg) {

        console.warn(
            "Telegram WebApp object not found."
        );
    }

    const userLoaded =
        await loadUser();

    await loadProducts();

    /*
     * Load history in background.
     */
    await loadOrders();

    /*
     * Start automatic balance refresh.
     */
    startBalanceAutoRefresh();

    /*
     * Default tab.
     */
    switchTab(
        currentTab
    );

    console.log(
        "Telegram Digital Store initialized."
    );

    if (!userLoaded) {

        console.warn(
            "Telegram user authentication failed."
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

window.copyText =
    copyText;

window.loadOrders =
    loadOrders;

window.renderOrders =
    renderOrders;

window.switchTab =
    switchTab;

window.refreshStore =
    refreshStore;

window.setDeliveryFilter =
    setDeliveryFilter;

window.setPriceFilter =
    setPriceFilter;

window.contactAdmin =
    contactAdmin;

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
        initStore,
        {
            once: true
        }
    );

} else {

    initStore();
}