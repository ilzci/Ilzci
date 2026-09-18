/* =========================================================
   المتجر الليبي - Telegram Web App
   app.js v3.0.0
   ========================================================= */

(() => {
    "use strict";

    /* =========================================================
       TELEGRAM
    ========================================================= */

    const tg = window.Telegram?.WebApp || null;

    if (tg) {
        try {
            tg.ready();
            tg.expand();

            if (typeof tg.enableClosingConfirmation === "function") {
                tg.enableClosingConfirmation();
            }

            if (typeof tg.setHeaderColor === "function") {
                tg.setHeaderColor("#081326");
            }

            if (typeof tg.setBackgroundColor === "function") {
                tg.setBackgroundColor("#081326");
            }
        } catch (error) {
            console.warn("Telegram WebApp initialization:", error);
        }
    }

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
    let currentOrderSearch = "";

    let currentCategory = "all";
    let currentDeliveryFilter = "all";
    let currentPriceFilter = "all";

    let navigationInitialized = false;
    let eventsInitialized = false;

    /* =========================================================
       TRANSLATIONS
    ========================================================= */

    const translations = {
        ar: {
            loading: "جاري التحميل...",
            noProducts: "لا توجد منتجات",
            noProductsText: "لا توجد منتجات متاحة حاليًا.",
            noSearchProducts: "لم يتم العثور على منتجات",
            noSearchProductsText: "جرّب البحث بكلمة مختلفة.",
            noOrders: "لا يوجد سجل شراء",
            noOrdersText: "لم تقم بأي عملية شراء حتى الآن.",
            noSearchOrders: "لا توجد نتائج",
            noSearchOrdersText: "لم يتم العثور على طلب مطابق.",
            automatic: "تسليم تلقائي",
            manual: "تنفيذ يدوي",
            buy: "شراء",
            unavailable: "غير متوفر",
            confirmBuy: "تأكيد الشراء",
            cancel: "إلغاء",
            balanceNotEnough: "رصيدك غير كافٍ لإتمام عملية الشراء.",
            purchaseSuccess: "تم تنفيذ عملية الشراء بنجاح.",
            purchasePending: "تم إنشاء طلبك وسيتم تنفيذ الطلب يدويًا.",
            purchaseError: "تعذر تنفيذ عملية الشراء.",
            copied: "تم نسخ الكود.",
            supportUnavailable: "لم يتم تحديد حساب الدعم.",
            loadingProducts: "جاري تحميل المنتجات...",
            loadingOrders: "جاري تحميل سجل الشراء...",
            refreshSuccess: "تم تحديث البيانات.",
            networkError: "تعذر الاتصال بالخادم.",
            pending: "قيد الانتظار",
            completed: "مكتمل",
            rejected: "مرفوض",
            cancelled: "ملغي",
            orderNumber: "رقم الطلب",
            price: "السعر",
            delivery: "التسليم",
            date: "التاريخ",
            code: "كود المنتج",
            deliveredCode: "الكود المستلم",
            user: "المستخدم",
            id: "المعرف",
            unknown: "غير معروف"
        }
    };

    const t = translations.ar;

    /* =========================================================
       SVG ICONS
    ========================================================= */

    const icons = {
        package: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="m21 8-9-5-9 5 9 5 9-5z"/>
                <path d="M3 8v8l9 5 9-5V8"/>
                <path d="M12 13v8"/>
            </svg>
        `,

        search: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7"/>
                <path d="m20 20-4-4"/>
            </svg>
        `,

        cart: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="20" r="1"/>
                <circle cx="18" cy="20" r="1"/>
                <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.4L21 8H6"/>
            </svg>
        `,

        refresh: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 11a8.1 8.1 0 0 0-14.8-4.5L3 9"/>
                <path d="M3 4v5h5"/>
                <path d="M4 13a8.1 8.1 0 0 0 14.8 4.5L21 15"/>
                <path d="M21 20v-5h-5"/>
            </svg>
        `,

        check: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="m5 12 4 4L19 6"/>
            </svg>
        `,

        alert: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.3 3.8 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/>
                <path d="M12 9v4"/>
                <circle cx="12" cy="17" r=".8"/>
            </svg>
        `,

        copy: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="11" height="11" rx="2"/>
                <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>
            </svg>
        `,

        clock: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 7v5l3 2"/>
            </svg>
        `,

        box: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="m21 8-9-5-9 5 9 5 9-5z"/>
                <path d="M3 8v8l9 5 9-5V8"/>
                <path d="M12 13v8"/>
            </svg>
        `,

        close: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
            </svg>
        `,

        support: `
            <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
            </svg>
        `
    };

    /* =========================================================
       HELPERS
    ========================================================= */

    function $(selector, root = document) {
        return root.querySelector(selector);
    }

    function $all(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatNumber(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "0.00";
        }

        return number.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function money(value) {
        return `${formatNumber(value)} د.ل`;
    }

    function getTelegramUser() {
        return tg?.initDataUnsafe?.user || null;
    }

    function getInitData() {
        return tg?.initData || "";
    }

    function getHeaders() {
        const headers = {
            "Content-Type": "application/json"
        };

        const initData = getInitData();

        if (initData) {
            headers["X-Telegram-Init-Data"] = initData;
            headers["Authorization"] = `tma ${initData}`;
        }

        return headers;
    }

    function haptic(type = "light") {
        try {
            tg?.HapticFeedback?.impactOccurred?.(type);
        } catch (_) {}
    }

    function showToast(message, type = "success") {
        const toast = $("#toast");
        const toastMessage = $("#toastMessage");
        const toastIcon = $("#toastIcon");

        if (!toast || !toastMessage || !toastIcon) {
            return;
        }

        toast.classList.remove("success", "error", "show");
        toast.classList.add(type === "error" ? "error" : "success");

        toastMessage.textContent = message;
        toastIcon.innerHTML = type === "error"
            ? icons.alert
            : icons.check;

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        clearTimeout(showToast.timer);

        showToast.timer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2800);
    }

    function setLoading(button, loading) {
        if (!button) return;

        button.classList.toggle("loading", loading);
        button.disabled = loading;
    }

    function createClientRequestId() {
        try {
            if (window.crypto?.randomUUID) {
                return window.crypto.randomUUID();
            }
        } catch (_) {}

        return [
            Date.now(),
            Math.random().toString(36).slice(2),
            Math.random().toString(36).slice(2)
        ].join("-");
    }

    function formatOrderDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString("ar-LY", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getInitials(name) {
        const text = String(name || "?").trim();

        if (!text) {
            return "؟";
        }

        const words = text.split(/\s+/).filter(Boolean);

        if (words.length === 1) {
            return words[0].slice(0, 1).toUpperCase();
        }

        return (
            words[0].slice(0, 1) +
            words[words.length - 1].slice(0, 1)
        ).toUpperCase();
    }

    function normalizeImageUrl(value) {
        const raw = String(value || "").trim();

        if (!raw) {
            return "";
        }

        if (
            /^https?:\/\//i.test(raw) ||
            /^data:image\//i.test(raw) ||
            /^blob:/i.test(raw)
        ) {
            return raw;
        }

        if (raw.startsWith("/")) {
            return raw;
        }

        if (raw.startsWith("./")) {
            return raw.substring(1);
        }

        return `/${raw}`;
    }

    function getProductDeliveryType(product) {
        const type = String(
            product?.delivery_type ||
            product?.deliveryType ||
            product?.type ||
            ""
        ).toLowerCase();

        if (
            type === "code" ||
            type === "automatic" ||
            type === "auto"
        ) {
            return "code";
        }

        return "manual";
    }

    function getProductCategory(product) {
        const raw = String(
            product?.category ||
            product?.category_name ||
            product?.type ||
            ""
        ).toLowerCase();

        if (
            raw.includes("subscription") ||
            raw.includes("اشتراك") ||
            raw.includes("premium")
        ) {
            return "subscription";
        }

        if (
            raw.includes("game") ||
            raw.includes("gaming") ||
            raw.includes("لعبة") ||
            raw.includes("ألعاب")
        ) {
            return "games";
        }

        if (
            raw.includes("software") ||
            raw.includes("program") ||
            raw.includes("برنامج") ||
            raw.includes("windows") ||
            raw.includes("office")
        ) {
            return "software";
        }

        return "other";
    }

    function getStock(product) {
        if (product == null) {
            return 0;
        }

        if (product.stock != null) {
            return Number(product.stock) || 0;
        }

        if (product.stock_count != null) {
            return Number(product.stock_count) || 0;
        }

        if (product.available_stock != null) {
            return Number(product.available_stock) || 0;
        }

        return 0;
    }

    function productIsAvailable(product) {
        if (!product) return false;

        if (
            product.active === false ||
            product.active === 0 ||
            product.active === "0"
        ) {
            return false;
        }

        if (getProductDeliveryType(product) === "code") {
            return getStock(product) > 0;
        }

        return true;
    }

    /* =========================================================
       AVATAR
    ========================================================= */

    function renderUserAvatar() {
        const avatar = $("#userAvatar");

        if (!avatar) {
            return;
        }

        const tgUser = getTelegramUser();

        const firstName =
            currentUser?.first_name ||
            tgUser?.first_name ||
            "";

        const lastName =
            currentUser?.last_name ||
            tgUser?.last_name ||
            "";

        const fullName =
            `${firstName} ${lastName}`.trim() ||
            currentUser?.username ||
            tgUser?.username ||
            "المستخدم";

        const photoUrl =
            currentUser?.photo_url ||
            tgUser?.photo_url ||
            "";

        const letter = getInitials(fullName);

        avatar.innerHTML = "";

        if (photoUrl) {
            const img = document.createElement("img");

            img.src = photoUrl;
            img.alt = fullName;
            img.referrerPolicy = "no-referrer";

            img.onerror = () => {
                avatar.innerHTML = "";
                const span = document.createElement("span");
                span.textContent = letter;
                avatar.appendChild(span);
            };

            avatar.appendChild(img);
        } else {
            const span = document.createElement("span");
            span.textContent = letter;
            avatar.appendChild(span);
        }
    }

    /* =========================================================
       USER
    ========================================================= */

    async function loadUser(options = {}) {
        const silent = options.silent === true;

        try {
            const response = await fetch(
                `/api/me?_=${Date.now()}`,
                {
                    method: "GET",
                    headers: getHeaders(),
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data?.success && !data?.user) {
                throw new Error(
                    data?.message || "تعذر تحميل بيانات المستخدم"
                );
            }

            const serverUser = data.user || {};

            const tgUser = getTelegramUser() || {};

            currentUser = {
                ...serverUser,

                id:
                    serverUser.id ??
                    serverUser.telegram_id ??
                    tgUser.id ??
                    null,

                username:
                    serverUser.username ??
                    tgUser.username ??
                    "",

                first_name:
                    serverUser.first_name ??
                    tgUser.first_name ??
                    "",

                last_name:
                    serverUser.last_name ??
                    tgUser.last_name ??
                    "",

                photo_url:
                    serverUser.photo_url ??
                    tgUser.photo_url ??
                    ""
            };

            updateUserInterface();

            return currentUser;

        } catch (error) {
            console.error("loadUser:", error);

            /*
             * إذا فشل /api/me ولكن Telegram أعطانا المستخدم،
             * نستخدم بيانات Telegram الأساسية حتى لا تختفي الهوية.
             */
            const tgUser = getTelegramUser();

            if (tgUser) {
                currentUser = {
                    id: tgUser.id || null,
                    username: tgUser.username || "",
                    first_name: tgUser.first_name || "",
                    last_name: tgUser.last_name || "",
                    photo_url: tgUser.photo_url || "",
                    balance: currentUser?.balance || 0
                };

                updateUserInterface();
            }

            if (!silent) {
                showToast(
                    error.message === "Failed to fetch"
                        ? t.networkError
                        : "تعذر تحميل بيانات الحساب.",
                    "error"
                );
            }

            return null;
        }
    }

    function updateUserInterface() {
        const tgUser = getTelegramUser() || {};

        const firstName =
            currentUser?.first_name ||
            tgUser.first_name ||
            "";

        const lastName =
            currentUser?.last_name ||
            tgUser.last_name ||
            "";

        const fullName =
            `${firstName} ${lastName}`.trim() ||
            currentUser?.username ||
            tgUser.username ||
            t.unknown;

        const username =
            currentUser?.username ||
            tgUser.username ||
            "";

        const telegramId =
            currentUser?.id ??
            currentUser?.telegram_id ??
            tgUser.id ??
            "—";

        const balance =
            Number(
                currentUser?.balance ??
                currentUser?.points ??
                0
            ) || 0;

        const nameElements = [
            $("[data-user-name]"),
            $("#userName"),
            $("#welcomeName"),
            $("#settingsName")
        ].filter(Boolean);

        nameElements.forEach(element => {
            element.textContent = fullName;
        });

        const usernameText = username
            ? `@${String(username).replace(/^@/, "")}`
            : "بدون اسم مستخدم";

        const usernameElements = [
            $("[data-user-username]"),
            $("#userUsername"),
            $("#settingsUsername")
        ].filter(Boolean);

        usernameElements.forEach(element => {
            element.textContent = usernameText;
        });

        const idElements = [
            $("[data-user-id]"),
            $("#userId"),
            $("#settingsTelegramId")
        ].filter(Boolean);

        idElements.forEach(element => {
            element.textContent = String(telegramId);
        });

        const balanceElements = [
            $("[data-user-balance]"),
            $("#balance"),
            $("#balanceValue"),
            $("#settingsBalance")
        ].filter(Boolean);

        balanceElements.forEach(element => {
            element.textContent = money(balance);
        });

        renderUserAvatar();
    }

    /* =========================================================
       PRODUCTS
    ========================================================= */

    async function loadProducts(options = {}) {
        const silent = options.silent === true;
        const refreshButton = $("#refreshProductsBtn");

        if (!silent) {
            setLoading(refreshButton, true);
        }

        try {
            const response = await fetch(
                `/api/products?_=${Date.now()}`,
                {
                    method: "GET",
                    headers: getHeaders(),
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            let list = [];

            if (Array.isArray(data)) {
                list = data;
            } else if (Array.isArray(data?.products)) {
                list = data.products;
            } else if (Array.isArray(data?.data)) {
                list = data.data;
            }

            products = list.map(product => ({
                ...product,
                id: product.id ?? product.product_id,
                name: product.name ?? product.title ?? "منتج",
                description:
                    product.description ??
                    product.details ??
                    "",
                price: Number(product.price) || 0,
                image:
                    product.image ??
                    product.image_url ??
                    product.imageUrl ??
                    "",
                active:
                    product.active !== false &&
                    product.active !== 0 &&
                    product.active !== "0"
            }));

            renderProducts();

            return products;

        } catch (error) {
            console.error("loadProducts:", error);

            const container = $("#productsContainer");

            if (container && products.length === 0) {
                container.innerHTML = createStateBox(
                    icons.alert,
                    "تعذر تحميل المنتجات",
                    "تحقق من اتصال الخادم ثم حاول مرة أخرى."
                );
            }

            if (!silent) {
                showToast(t.networkError, "error");
            }

            return [];

        } finally {
            if (!silent) {
                setLoading(refreshButton, false);
            }
        }
    }

    function getFilteredProducts() {
        let result = products.filter(product => {
            if (!product.active) {
                return false;
            }

            const search = currentSearch.trim().toLowerCase();

            if (search) {
                const searchable = [
                    product.name,
                    product.description,
                    product.category,
                    product.delivery_type
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                if (!searchable.includes(search)) {
                    return false;
                }
            }

            if (
                currentCategory !== "all" &&
                getProductCategory(product) !== currentCategory
            ) {
                return false;
            }

            if (currentDeliveryFilter !== "all") {
                if (
                    getProductDeliveryType(product) !==
                    currentDeliveryFilter
                ) {
                    return false;
                }
            }

            return true;
        });

        if (currentPriceFilter === "low") {
            result.sort(
                (a, b) =>
                    Number(a.price || 0) -
                    Number(b.price || 0)
            );
        }

        if (currentPriceFilter === "high") {
            result.sort(
                (a, b) =>
                    Number(b.price || 0) -
                    Number(a.price || 0)
            );
        }

        return result;
    }

    function renderProducts() {
        const container = $("#productsContainer");

        if (!container) {
            console.error(
                "productsContainer غير موجود في index.html"
            );
            return;
        }

        const filtered = getFilteredProducts();

        if (filtered.length === 0) {
            if (products.length === 0) {
                container.innerHTML = createStateBox(
                    icons.package,
                    t.noProducts,
                    t.noProductsText
                );
            } else {
                container.innerHTML = createStateBox(
                    icons.search,
                    t.noSearchProducts,
                    t.noSearchProductsText
                );
            }

            return;
        }

        container.innerHTML = filtered
            .map(createProductCard)
            .join("");

        attachProductButtons();
    }

    function createStateBox(icon, title, text) {
        return `
            <div class="state-box" style="grid-column:1/-1">
                <div class="state-icon">
                    ${icon}
                </div>

                <div class="state-title">
                    ${escapeHtml(title)}
                </div>

                <div class="state-text">
                    ${escapeHtml(text)}
                </div>
            </div>
        `;
    }

    function createProductCard(product) {
        const id = product.id;
        const name = escapeHtml(product.name || "منتج");
        const description = escapeHtml(
            product.description || "خدمة رقمية"
        );

        const image = normalizeImageUrl(product.image);

        const deliveryType =
            getProductDeliveryType(product);

        const stock = getStock(product);

        const available =
            productIsAvailable(product);

        const deliveryLabel =
            deliveryType === "code"
                ? t.automatic
                : t.manual;

        const statusClass =
            deliveryType === "code"
                ? "auto"
                : "manual";

        const stockText =
            deliveryType === "code"
                ? stock > 0
                    ? `${stock} متوفر`
                    : "غير متوفر"
                : "متاح";

        const imageHtml = image
            ? `
                <img
                    src="${escapeHtml(image)}"
                    alt="${name}"
                    loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"
                >
                <div
                    class="product-placeholder"
                    style="display:none"
                >
                    ${icons.package}
                </div>
            `
            : `
                <div class="product-placeholder">
                    ${icons.package}
                </div>
            `;

        return `
            <article
                class="product-card"
                data-product-id="${escapeHtml(id)}"
            >

                <div class="product-image">

                    ${imageHtml}

                    <div
                        class="product-status ${statusClass}"
                    >
                        ${deliveryType === "code"
                            ? icons.check
                            : icons.clock}

                        ${escapeHtml(deliveryLabel)}
                    </div>

                </div>

                <div class="product-body">

                    <h3 class="product-name">
                        ${name}
                    </h3>

                    <div class="product-description">
                        ${description}
                    </div>

                    <div class="product-footer">

                        <div>
                            <div class="product-price">
                                ${money(product.price)}
                            </div>

                            <div
                                style="
                                    color:var(--muted);
                                    font-size:8px;
                                    margin-top:2px;
                                "
                            >
                                ${escapeHtml(stockText)}
                            </div>
                        </div>

                        <button
                            class="buy-btn"
                            type="button"
                            data-buy-product="${escapeHtml(id)}"
                            ${available ? "" : "disabled"}
                        >
                            ${icons.cart}
                            <span>
                                ${available
                                    ? t.buy
                                    : t.unavailable}
                            </span>
                        </button>

                    </div>

                </div>

            </article>
        `;
    }

    function attachProductButtons() {
        $all("[data-buy-product]").forEach(button => {
            button.addEventListener("click", () => {
                const productId =
                    button.getAttribute(
                        "data-buy-product"
                    );

                openBuy(productId);
            });
        });
    }

    /* =========================================================
       BUY MODAL
    ========================================================= */

    function openBuy(productId) {
        const product = products.find(
            item =>
                String(item.id) === String(productId)
        );

        if (!product) {
            showToast(
                "تعذر العثور على المنتج.",
                "error"
            );
            return;
        }

        currentProductId = product.id;

        const modal = $("#buyModal");

        const name = $("#buyProductName");
        const description = $("#buyProductDescription");
        const price = $("#buyProductPrice");
        const imageContainer = $("#buyProductImage");
        const warning = $("#balanceWarning");
        const confirmButton = $("#confirmBuyBtn");

        if (!modal) {
            return;
        }

        if (name) {
            name.textContent =
                product.name || "منتج";
        }

        if (description) {
            description.textContent =
                product.description || "خدمة رقمية";
        }

        if (price) {
            price.textContent =
                money(product.price);
        }

        if (imageContainer) {
            const image =
                normalizeImageUrl(product.image);

            if (image) {
                imageContainer.innerHTML = `
                    <img
                        src="${escapeHtml(image)}"
                        alt="${escapeHtml(product.name)}"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='block'"
                    >
                    <span style="display:none">
                        ${icons.package}
                    </span>
                `;
            } else {
                imageContainer.innerHTML =
                    icons.package;
            }
        }

        const balance =
            Number(currentUser?.balance) || 0;

        const productPrice =
            Number(product.price) || 0;

        const insufficient =
            balance < productPrice;

        if (warning) {
            warning.classList.toggle(
                "show",
                insufficient
            );
        }

        if (confirmButton) {
            confirmButton.disabled =
                insufficient ||
                !productIsAvailable(product) ||
                purchaseInProgress;
        }

        modal.classList.add("open");

        document.body.style.overflow = "hidden";

        haptic("light");
    }

    function closeModal() {
        const modal = $("#buyModal");

        if (!modal) return;

        modal.classList.remove("open");
        document.body.style.overflow = "";

        currentProductId = null;
        purchaseInProgress = false;

        const confirmButton =
            $("#confirmBuyBtn");

        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent =
                t.confirmBuy;
        }
    }

    async function confirmBuy() {
        if (purchaseInProgress) {
            return;
        }

        if (!currentProductId) {
            return;
        }

        const product = products.find(
            item =>
                String(item.id) ===
                String(currentProductId)
        );

        if (!product) {
            showToast(
                "المنتج غير موجود.",
                "error"
            );
            return;
        }

        const balance =
            Number(currentUser?.balance) || 0;

        const price =
            Number(product.price) || 0;

        if (balance < price) {
            $("#balanceWarning")?.classList.add("show");

            haptic("error");

            showToast(
                t.balanceNotEnough,
                "error"
            );

            return;
        }

        if (!productIsAvailable(product)) {
            showToast(
                t.unavailable,
                "error"
            );

            return;
        }

        const button = $("#confirmBuyBtn");

        purchaseInProgress = true;

        if (button) {
            button.disabled = true;
            button.innerHTML = `
                <span>جاري التنفيذ...</span>
            `;
        }

        const clientRequestId =
            createClientRequestId();

        try {
            const response = await fetch(
                "/api/buy",
                {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        product_id:
                            Number(currentProductId),

                        client_request_id:
                            clientRequestId
                    })
                }
            );

            const data =
                await response.json()
                    .catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    data?.message ||
                    data?.error ||
                    "تعذر تنفيذ عملية الشراء"
                );
            }

            /*
             * تحديث الرصيد فورًا
             */
            if (data.balance != null) {
                currentUser.balance =
                    Number(data.balance) || 0;
            } else if (
                data.user?.balance != null
            ) {
                currentUser.balance =
                    Number(data.user.balance) || 0;
            } else {
                currentUser.balance =
                    Math.max(
                        0,
                        balance - price
                    );
            }

            updateUserInterface();

            closeModal();

            haptic("success");

            const code =
                data.code ||
                data.product_code ||
                data.delivery_code ||
                data.data?.code ||
                null;

            const status =
                data.order?.status ||
                data.status ||
                (code
                    ? "completed"
                    : "pending");

            if (code) {
                showCodeResult(
                    product,
                    code,
                    data
                );
            } else {
                showOrderResult(
                    product,
                    status,
                    data
                );
            }

            /*
             * تحديث المنتجات والطلبات بعد الشراء
             */
            await Promise.all([
                loadProducts({
                    silent: true
                }),
                loadOrders({
                    silent: true
                }),
                loadUser({
                    silent: true
                })
            ]);

        } catch (error) {
            console.error("confirmBuy:", error);

            purchaseInProgress = false;

            if (button) {
                button.disabled = false;
                button.textContent =
                    t.confirmBuy;
            }

            haptic("error");

            showToast(
                error.message ||
                t.purchaseError,
                "error"
            );
        }
    }

    function showOrderResult(
        product,
        status,
        data
    ) {
        const normalizedStatus =
            String(status || "pending")
                .toLowerCase();

        const title =
            normalizedStatus === "completed"
                ? "تم الشراء بنجاح"
                : "تم استلام طلبك";

        const text =
            normalizedStatus === "completed"
                ? t.purchaseSuccess
                : t.purchasePending;

        showToast(
            `${title} — ${product.name}`,
            "success"
        );

        /*
         * Telegram popup إن كان مدعومًا
         */
        try {
            if (tg?.showPopup) {
                tg.showPopup({
                    title,
                    message: text,
                    buttons: [
                        {
                            id: "ok",
                            type: "default",
                            text: "حسنًا"
                        }
                    ]
                });
            }
        } catch (_) {}
    }

    function showCodeResult(
        product,
        code,
        data
    ) {
        const safeCode =
            String(code || "");

        try {
            if (tg?.showPopup) {
                tg.showPopup({
                    title: "تم الشراء بنجاح",
                    message:
                        `تم تسليم ${product.name}\n\n` +
                        `الكود:\n${safeCode}`,
                    buttons: [
                        {
                            id: "ok",
                            type: "default",
                            text: "حسنًا"
                        }
                    ]
                });
            }
        } catch (_) {}

        showToast(
            "تم شراء المنتج وتسليم الكود.",
            "success"
        );
    }

    /* =========================================================
       ORDERS
       ========================================================= */

    async function loadOrders(options = {}) {
        const silent = options.silent === true;
        const refreshButton =
            $("#refreshOrdersBtn");

        if (!silent) {
            setLoading(refreshButton, true);
        }

        try {
            /*
             * مهم:
             * Backend الحالي يستخدم /api/orders
             * وليس /api/my-orders
             */
            const response = await fetch(
                `/api/orders?_=${Date.now()}`,
                {
                    method: "GET",
                    headers: getHeaders(),
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data =
                await response.json();

            let list = [];

            if (Array.isArray(data)) {
                list = data;
            } else if (
                Array.isArray(data?.orders)
            ) {
                list = data.orders;
            } else if (
                Array.isArray(data?.data)
            ) {
                list = data.data;
            }

            orders = list;

            renderOrders();

            return orders;

        } catch (error) {
            console.error(
                "loadOrders:",
                error
            );

            const container =
                $("#ordersContainer");

            if (container) {
                container.innerHTML =
                    createStateBox(
                        icons.alert,
                        "تعذر تحميل سجل الشراء",
                        "حاول تحديث الصفحة أو اضغط زر التحديث."
                    );
            }

            if (!silent) {
                showToast(
                    t.networkError,
                    "error"
                );
            }

            return [];

        } finally {
            if (!silent) {
                setLoading(
                    refreshButton,
                    false
                );
            }
        }
    }

    function getFilteredOrders() {
        const search =
            currentOrderSearch
                .trim()
                .toLowerCase();

        if (!search) {
            return orders;
        }

        return orders.filter(order => {
            const searchable = [
                order.id,
                order.order_id,
                order.product_id,
                order.product_name,
                order.name,
                order.status,
                order.code,
                order.created_at
            ]
                .filter(value =>
                    value != null
                )
                .join(" ")
                .toLowerCase();

            return searchable.includes(search);
        });
    }

    function renderOrders() {
        const container =
            $("#ordersContainer");

        if (!container) {
            console.error(
                "ordersContainer غير موجود في index.html"
            );
            return;
        }

        const filtered =
            getFilteredOrders();

        if (filtered.length === 0) {
            if (orders.length === 0) {
                container.innerHTML =
                    createStateBox(
                        icons.box,
                        t.noOrders,
                        t.noOrdersText
                    );
            } else {
                container.innerHTML =
                    createStateBox(
                        icons.search,
                        t.noSearchOrders,
                        t.noSearchOrdersText
                    );
            }

            return;
        }

        container.innerHTML =
            filtered
                .map(createOrderRow)
                .join("");

        attachOrderButtons();
    }

    function getStatusLabel(status) {
        const value =
            String(status || "")
                .toLowerCase();

        switch (value) {
            case "completed":
            case "complete":
            case "success":
                return t.completed;

            case "rejected":
            case "failed":
                return t.rejected;

            case "cancelled":
            case "canceled":
                return t.cancelled;

            default:
                return t.pending;
        }
    }

    function getStatusClass(status) {
        const value =
            String(status || "")
                .toLowerCase();

        if (
            value === "completed" ||
            value === "complete" ||
            value === "success"
        ) {
            return "status-completed";
        }

        if (
            value === "rejected" ||
            value === "failed"
        ) {
            return "status-rejected";
        }

        return "status-pending";
    }

    function createOrderRow(order) {
        const productName =
            order.product_name ||
            order.name ||
            `منتج #${order.product_id ?? "—"}`;

        const orderId =
            order.id ??
            order.order_id ??
            "—";

        const status =
            order.status ||
            "pending";

        const price =
            order.price ??
            order.amount ??
            order.total ??
            0;

        const deliveryType =
            getProductDeliveryType({
                delivery_type:
                    order.delivery_type ||
                    order.deliveryType ||
                    (
                        order.code
                            ? "code"
                            : "manual"
                    )
            });

        const date =
            order.created_at ||
            order.createdAt ||
            order.date ||
            order.timestamp;

        const code =
            order.code ||
            order.product_code ||
            order.delivery_code ||
            "";

        let codeHtml = "";

        if (code) {
            const encodedCode =
                encodeURIComponent(
                    String(code)
                );

            codeHtml = `
                <div class="delivery-code">

                    <div class="delivery-code-label">
                        ${escapeHtml(
                            t.deliveredCode
                        )}
                    </div>

                    <div
                        class="delivery-code-value"
                    >
                        ${escapeHtml(
                            String(code)
                        )}
                    </div>

                    <button
                        type="button"
                        data-copy-code="${escapeHtml(
                            encodedCode
                        )}"
                        style="
                            margin-top:8px;
                            height:32px;
                            padding:0 10px;
                            border-radius:9px;
                            color:var(--green);
                            border:1px solid rgba(49,196,141,.18);
                            background:rgba(49,196,141,.06);
                            font-size:9px;
                            font-weight:900;
                        "
                    >
                        ${icons.copy}
                        نسخ الكود
                    </button>

                </div>
            `;
        }

        return `
            <article class="order-card">

                <div class="order-top">

                    <div>
                        <div class="order-name">
                            ${escapeHtml(
                                productName
                            )}
                        </div>

                        <div class="order-id">
                            ${escapeHtml(
                                t.orderNumber
                            )}
                            #${escapeHtml(
                                orderId
                            )}
                        </div>
                    </div>

                    <div
                        class="order-status ${getStatusClass(
                            status
                        )}"
                    >
                        ${escapeHtml(
                            getStatusLabel(status)
                        )}
                    </div>

                </div>

                <div class="order-info">

                    <div class="order-meta">

                        <div class="order-meta-label">
                            ${escapeHtml(t.price)}
                        </div>

                        <div class="order-meta-value">
                            ${money(price)}
                        </div>

                    </div>

                    <div class="order-meta">

                        <div class="order-meta-label">
                            ${escapeHtml(t.delivery)}
                        </div>

                        <div class="order-meta-value">
                            ${
                                deliveryType === "code"
                                    ? escapeHtml(
                                        t.automatic
                                    )
                                    : escapeHtml(
                                        t.manual
                                    )
                            }
                        </div>

                    </div>

                    <div class="order-meta">

                        <div class="order-meta-label">
                            ${escapeHtml(t.date)}
                        </div>

                        <div class="order-meta-value">
                            ${escapeHtml(
                                formatOrderDate(
                                    date
                                )
                            )}
                        </div>

                    </div>

                    <div class="order-meta">

                        <div class="order-meta-label">
                            ${escapeHtml(t.id)}
                        </div>

                        <div class="order-meta-value">
                            ${escapeHtml(
                                orderId
                            )}
                        </div>

                    </div>

                </div>

                ${codeHtml}

            </article>
        `;
    }

    function attachOrderButtons() {
        $all("[data-copy-code]").forEach(button => {
            button.addEventListener(
                "click",
                async () => {
                    const encoded =
                        button.getAttribute(
                            "data-copy-code"
                        );

                    let code = "";

                    try {
                        code =
                            decodeURIComponent(
                                encoded || ""
                            );
                    } catch (_) {
                        code = encoded || "";
                    }

                    await copyText(code);
                }
            );
        });
    }

    async function copyText(text) {
        const value = String(text || "");

        if (!value) {
            return;
        }

        try {
            if (
                navigator.clipboard &&
                window.isSecureContext
            ) {
                await navigator.clipboard.writeText(
                    value
                );
            } else {
                const textarea =
                    document.createElement(
                        "textarea"
                    );

                textarea.value = value;
                textarea.style.position =
                    "fixed";
                textarea.style.opacity = "0";

                document.body.appendChild(
                    textarea
                );

                textarea.focus();
                textarea.select();

                document.execCommand("copy");

                textarea.remove();
            }

            haptic("light");

            showToast(
                t.copied,
                "success"
            );

        } catch (error) {
            console.error(
                "copyText:",
                error
            );

            showToast(
                "تعذر نسخ الكود.",
                "error"
            );
        }
    }

    /* =========================================================
       NAVIGATION / TABS
       ========================================================= */

    function getViewElement(tab) {
        const mappings = {
            store: [
                "#viewStore",
                "#view-store",
                '[data-view="store"]'
            ],

            orders: [
                "#viewOrders",
                "#view-orders",
                '[data-view="orders"]'
            ],

            settings: [
                "#viewSettings",
                "#view-settings",
                '[data-view="settings"]'
            ]
        };

        const selectors =
            mappings[tab] || [];

        for (const selector of selectors) {
            const element =
                $(selector);

            if (element) {
                return element;
            }
        }

        return null;
    }

    function switchTab(tab) {
        const validTabs = [
            "store",
            "orders",
            "settings"
        ];

        if (!validTabs.includes(tab)) {
            tab = "store";
        }

        currentTab = tab;

        /*
         * تحديث أزرار التنقل
         */
        $all(".nav-btn[data-tab]").forEach(
            button => {
                const active =
                    button.dataset.tab === tab;

                button.classList.toggle(
                    "active",
                    active
                );

                button.setAttribute(
                    "aria-selected",
                    active
                        ? "true"
                        : "false"
                );
            }
        );

        /*
         * إظهار الصفحة الصحيحة
         */
        validTabs.forEach(name => {
            const view =
                getViewElement(name);

            if (!view) {
                return;
            }

            view.classList.toggle(
                "active",
                name === tab
            );
        });

        /*
         * تحديث البيانات عند فتح التبويب
         */
        if (tab === "orders") {
            loadOrders({
                silent: true
            });
        }

        if (tab === "store") {
            loadProducts({
                silent: true
            });
        }

        if (tab === "settings") {
            updateUserInterface();
        }

        haptic("light");
    }

    function setupNavigation() {
        if (navigationInitialized) {
            return;
        }

        navigationInitialized = true;

        $all("[data-tab]").forEach(button => {
            /*
             * لا نضيف مستمعًا إذا كان الزر يحتوي
             * أصلًا على onclick من HTML.
             */
            if (
                button.getAttribute(
                    "onclick"
                )
            ) {
                return;
            }

            button.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    switchTab(
                        button.dataset.tab
                    );
                }
            );
        });

        /*
         * دعم أي زر خارجي يستخدم:
         * data-tab="store"
         */
        document.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-tab]"
                    );

                if (!button) {
                    return;
                }

                /*
                 * إذا كان لدينا listener مباشر
                 * فهذا الحدث سيصل أيضًا هنا.
                 * لكن switchTab آمن للتكرار.
                 */
            },
            false
        );

        switchTab("store");
    }

    /* =========================================================
       FILTERS
    ========================================================= */

    function setupFilters() {
        const search =
            $("#productSearch");

        if (search) {
            search.addEventListener(
                "input",
                event => {
                    currentSearch =
                        event.target.value || "";

                    renderProducts();
                }
            );
        }

        const orderSearch =
            $("#orderSearch");

        if (orderSearch) {
            orderSearch.addEventListener(
                "input",
                event => {
                    currentOrderSearch =
                        event.target.value || "";

                    renderOrders();
                }
            );
        }

        $all("[data-category]").forEach(
            button => {
                button.addEventListener(
                    "click",
                    () => {
                        currentCategory =
                            button.dataset.category ||
                            "all";

                        $all(
                            "[data-category]"
                        ).forEach(
                            item => {
                                item.classList.toggle(
                                    "active",
                                    item === button
                                );
                            }
                        );

                        renderProducts();
                        haptic("light");
                    }
                );
            }
        );

        const deliveryFilter =
            $("#deliveryFilter");

        if (deliveryFilter) {
            deliveryFilter.addEventListener(
                "change",
                event => {
                    currentDeliveryFilter =
                        event.target.value ||
                        "all";

                    renderProducts();
                }
            );
        }

        const priceFilter =
            $("#priceFilter");

        if (priceFilter) {
            priceFilter.addEventListener(
                "change",
                event => {
                    currentPriceFilter =
                        event.target.value ||
                        "all";

                    renderProducts();
                }
            );
        }
    }

    /* =========================================================
       BUTTONS / MODAL EVENTS
       ========================================================= */

    function setupEvents() {
        if (eventsInitialized) {
            return;
        }

        eventsInitialized = true;

        const refreshProducts =
            $("#refreshProductsBtn");

        if (refreshProducts) {
            refreshProducts.addEventListener(
                "click",
                async () => {
                    haptic("light");

                    await Promise.all([
                        loadProducts(),
                        loadUser({
                            silent: true
                        })
                    ]);

                    showToast(
                        t.refreshSuccess,
                        "success"
                    );
                }
            );
        }

        const refreshOrders =
            $("#refreshOrdersBtn");

        if (refreshOrders) {
            refreshOrders.addEventListener(
                "click",
                async () => {
                    haptic("light");

                    await loadOrders();

                    showToast(
                        t.refreshSuccess,
                        "success"
                    );
                }
            );
        }

        const closeButton =
            $("#closeBuyModal");

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                closeModal
            );
        }

        const cancelButton =
            $("#cancelBuyBtn");

        if (cancelButton) {
            cancelButton.addEventListener(
                "click",
                closeModal
            );
        }

        const confirmButton =
            $("#confirmBuyBtn");

        if (confirmButton) {
            confirmButton.addEventListener(
                "click",
                confirmBuy
            );
        }

        const modal =
            $("#buyModal");

        if (modal) {
            modal.addEventListener(
                "click",
                event => {
                    if (
                        event.target === modal
                    ) {
                        closeModal();
                    }
                }
            );
        }

        const supportButton =
            $("#supportBtn");

        if (supportButton) {
            supportButton.addEventListener(
                "click",
                contactAdmin
            );
        }

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Escape"
                ) {
                    closeModal();
                }
            }
        );
    }

    /* =========================================================
       SUPPORT
       ========================================================= */

    function contactAdmin() {
        const username =
            window.STORE_ADMIN_USERNAME ||
            window.ADMIN_USERNAME ||
            "Ilzci";

        const clean =
            String(username)
                .replace(/^@/, "")
                .trim();

        if (!clean) {
            showToast(
                t.supportUnavailable,
                "error"
            );

            return;
        }

        const url =
            `https://t.me/${encodeURIComponent(
                clean
            )}`;

        try {
            if (tg?.openTelegramLink) {
                tg.openTelegramLink(url);
            } else {
                window.open(
                    url,
                    "_blank",
                    "noopener,noreferrer"
                );
            }
        } catch (_) {
            window.open(
                url,
                "_blank",
                "noopener,noreferrer"
            );
        }
    }

    /* =========================================================
       TELEGRAM BACK BUTTON
       ========================================================= */

    function setupTelegramBackButton() {
        if (!tg?.BackButton) {
            return;
        }

        const updateBackButton =
            () => {
                if (
                    currentTab !==
                    "store"
                ) {
                    tg.BackButton.show();
                } else {
                    tg.BackButton.hide();
                }
            };

        tg.BackButton.onClick(() => {
            switchTab("store");
            updateBackButton();
        });

        updateBackButton();

        /*
         * تحديث عند تغيير التبويب
         */
        const originalSwitchTab =
            switchTab;

        /*
         * لا نعيد تعريف الدالة هنا.
         * Telegram سيبقى على حالة المتجر
         * في أغلب الحالات.
         */
    }

    /* =========================================================
       BALANCE AUTO REFRESH
       ========================================================= */

    function startBalanceRefresh() {
        clearInterval(
            balanceRefreshTimer
        );

        balanceRefreshTimer =
            setInterval(
                async () => {
                    if (
                        document.hidden
                    ) {
                        return;
                    }

                    await loadUser({
                        silent: true
                    });
                },
                5000
            );
    }

    /* =========================================================
       PAGE LIFECYCLE
       ========================================================= */

    function setupLifecycle() {
        document.addEventListener(
            "visibilitychange",
            () => {
                if (
                    !document.hidden
                ) {
                    loadUser({
                        silent: true
                    });

                    if (
                        currentTab ===
                        "store"
                    ) {
                        loadProducts({
                            silent: true
                        });
                    }

                    if (
                        currentTab ===
                        "orders"
                    ) {
                        loadOrders({
                            silent: true
                        });
                    }
                }
            }
        );

        window.addEventListener(
            "focus",
            () => {
                loadUser({
                    silent: true
                });
            }
        );

        window.addEventListener(
            "pageshow",
            () => {
                loadUser({
                    silent: true
                });

                loadProducts({
                    silent: true
                });
            }
        );
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initializeApp() {
        console.log(
            "%cالمتجر الليبي",
            "color:#ffd979;font-size:18px;font-weight:bold"
        );

        console.log(
            "Telegram WebApp:",
            !!tg
        );

        console.log(
            "Telegram User:",
            getTelegramUser()
        );

        setupNavigation();
        setupFilters();
        setupEvents();
        setupTelegramBackButton();
        setupLifecycle();

        /*
         * نعرض بيانات Telegram فورًا،
         * حتى قبل رجوع /api/me.
         */
        const tgUser =
            getTelegramUser();

        if (tgUser) {
            currentUser = {
                id: tgUser.id || null,
                username:
                    tgUser.username || "",
                first_name:
                    tgUser.first_name || "",
                last_name:
                    tgUser.last_name || "",
                photo_url:
                    tgUser.photo_url || "",
                balance: 0
            };

            updateUserInterface();
        }

        /*
         * تحميل البيانات الرئيسية
         */
        await Promise.all([
            loadUser({
                silent: true
            }),

            loadProducts({
                silent: true
            })
        ]);

        /*
         * لا نحتاج لتحميل الطلبات
         * إلا عند فتح سجل الشراء.
         */
        startBalanceRefresh();

        /*
         * تأكيد أن المتجر هو الصفحة الأولى
         */
        switchTab("store");
    }

    /* =========================================================
       GLOBAL API
       ========================================================= */

    window.switchTab = switchTab;
    window.openBuy = openBuy;
    window.closeModal = closeModal;
    window.confirmBuy = confirmBuy;
    window.copyText = copyText;
    window.contactAdmin = contactAdmin;

    window.refreshStore = async function () {
        await Promise.all([
            loadUser({
                silent: true
            }),
            loadProducts({
                silent: true
            })
        ]);
    };

    window.refreshOrders = async function () {
        await loadOrders();
    };

    window.loadProducts = loadProducts;
    window.loadOrders = loadOrders;
    window.loadUser = loadUser;

    /* =========================================================
       START
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initializeApp,
            {
                once: true
            }
        );
    } else {
        initializeApp();
    }

})();