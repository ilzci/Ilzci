const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

const initData = tg.initData;

const headers = {
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": initData
};

let currentUser = null;
let products = [];


/* =========================
   Helpers
========================= */

function showToast(message) {

    const toast = document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


function closeModal() {

    document
        .getElementById("modal")
        .classList.remove("show");
}


/* =========================
   Load User
========================= */

async function loadUser() {

    try {

        const response = await fetch("/api/me", {
            headers
        });

        const data = await response.json();

        if (!data.success) {
            showToast("تعذر التحقق من حساب Telegram");
            return;
        }

        currentUser = data.user;

        document.getElementById("welcome").textContent =
            `مرحباً ${currentUser.first_name || "بك"}`;

        updateBalance();

    } catch (error) {

        console.error(error);

        showToast("حدث خطأ في الاتصال");
    }
}


function updateBalance() {

    document.getElementById("balance")
        .textContent =
        Number(currentUser.balance)
            .toLocaleString();
}


/* =========================
   Load Products
========================= */

async function loadProducts() {

    try {

        const response =
            await fetch("/api/products");

        const data =
            await response.json();

        products =
            data.products || [];

        renderProducts();

    } catch (error) {

        console.error(error);

        document.getElementById("products")
            .innerHTML = `
                <div class="empty">
                    تعذر تحميل المنتجات.
                </div>
            `;
    }
}


/* =========================
   Render Products
========================= */

function renderProducts() {

    const container =
        document.getElementById("products");

    document.getElementById("productsCount")
        .textContent =
        `${products.length} منتج`;

    if (!products.length) {

        container.innerHTML = `
            <div class="empty">
                لا توجد منتجات حالياً.
            </div>
        `;

        return;
    }

    container.innerHTML =
        products.map(product => {

            const image = product.image
                ? `
                    <img
                        src="${escapeHtml(product.image)}"
                        alt=""
                    >
                `
                : `
                    <div class="no-image">
                        🛍️
                    </div>
                `;

            return `
                <article class="product">

                    <div class="product-image">
                        ${image}
                    </div>

                    <div class="product-body">

                        <div class="product-name">
                            ${escapeHtml(product.name)}
                        </div>

                        <div class="product-description">
                            ${escapeHtml(product.description || "")}
                        </div>

                        <div class="product-bottom">

                            <div class="price">
                                ⭐ ${Number(product.price).toLocaleString()}
                            </div>

                            <button
                                class="buy"
                                onclick="openBuy(${product.id})"
                            >
                                شراء
                            </button>

                        </div>

                    </div>

                </article>
            `;

        }).join("");
}


/* =========================
   Buy Modal
========================= */

function openBuy(productId) {

    const product =
        products.find(
            item => item.id === productId
        );

    if (!product) return;

    const modal =
        document.getElementById("modal");

    const content =
        document.getElementById("modalContent");

    content.innerHTML = `

        <div class="confirm-title">
            تأكيد الطلب
        </div>

        <div class="confirm-info">

            <strong>
                ${escapeHtml(product.name)}
            </strong>

            <br><br>

            السعر:
            <strong>
                ⭐ ${Number(product.price).toLocaleString()}
            </strong>

            <br><br>

            رصيدك الحالي:
            <strong>
                ⭐ ${Number(currentUser.balance).toLocaleString()}
            </strong>

        </div>

        <button
            class="confirm-button"
            onclick="confirmBuy(${product.id})"
        >
            تأكيد الشراء
        </button>
    `;

    modal.classList.add("show");
}


/* =========================
   Confirm Buy
========================= */

async function confirmBuy(productId) {

    try {

        const response =
            await fetch("/api/buy", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    product_id: productId
                })
            });

        const data =
            await response.json();

        if (!data.success) {

            showToast(
                data.message ||
                "تعذر تنفيذ الطلب"
            );

            return;
        }

        currentUser.balance =
            data.balance;

        updateBalance();

        closeModal();

        showToast(
            `تم إنشاء الطلب #${data.order_id}`
        );

    } catch (error) {

        console.error(error);

        showToast(
            "حدث خطأ أثناء تنفيذ الطلب"
        );
    }
}


/* =========================
   Security
========================= */

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================
   Start
========================= */

loadUser();
loadProducts();