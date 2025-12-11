// Sales Form Client-Side Logic
// Make these global so they can be accessed by Select2 handlers
window.sellerInventory = [];

// Customer phone search
let searchTimeout;
document.getElementById('customer_phone').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    const phone = this.value;

    if (phone.length >= 5) {
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/customers/api/phone/${encodeURIComponent(phone)}`);
                if (response.ok) {
                    const customer = await response.json();
                    document.getElementById('customer_name').value = customer.full_name;
                    document.getElementById('customer_address').value = customer.address || '';
                }
            } catch (error) {
                // Customer not found, allow creating new
                console.log('Customer not found');
            }
        }, 500);
    }
});

// Load seller inventory when seller selected
document.getElementById('seller_id').addEventListener('change', async function() {
    const sellerId = this.value;

    if (!sellerId) {
        window.sellerInventory = [];
        updateProductSelects();
        return;
    }

    try {
        const response = await fetch(`/sales/api/seller/${sellerId}/inventory`);
        if (response.ok) {
            window.sellerInventory = await response.json();
            updateProductSelects();
            document.getElementById('addProductBtn').disabled = false;
        }
    } catch (error) {
        alert('Sotuvchining mahsulotlarini yuklashda xatolik');
    }
});

// Expose updateProductSelects globally so Select2 handlers can call it
window.updateProductSelects = function updateProductSelects() {
    document.querySelectorAll('.product-select').forEach(select => {
        select.innerHTML = '<option value="">Select Product</option>';

        if (window.sellerInventory.length > 0) {
            window.sellerInventory.forEach(item => {
                const option = document.createElement('option');
                option.value = item.product_id;
                option.textContent = `${item.product_name} (Available: ${item.quantity}, Price: $${parseFloat(item.warehouse_sell_price).toFixed(2)})`;
                option.dataset.available = item.quantity;
                option.dataset.price = item.warehouse_sell_price;
                select.appendChild(option);
            });
            select.disabled = false;
        } else {
            select.disabled = true;
        }
    });

    const firstInput = document.querySelector('.quantity-input');
    const firstPriceInput = document.querySelector('.price-input');
    if (window.sellerInventory.length > 0) {
        firstInput.disabled = false;
        firstPriceInput.disabled = false;
    }
}

// Add product row
document.getElementById('addProductBtn').addEventListener('click', function() {
    const container = document.getElementById('productsList');
    const firstRow = container.querySelector('.product-item');
    const newRow = firstRow.cloneNode(true);

    newRow.querySelectorAll('input').forEach(input => {
        input.value = '';
        input.disabled = false;
    });

    newRow.querySelector('.product-select').disabled = false;
    newRow.querySelector('span').textContent = '$0.00';

    // Copy options from first select
    const firstSelect = firstRow.querySelector('.product-select');
    const newSelect = newRow.querySelector('.product-select');
    newSelect.innerHTML = firstSelect.innerHTML;

    container.appendChild(newRow);
    attachProductRowListeners(newRow);
});

// Product row change listeners
function attachProductRowListeners(row) {
    const productSelect = row.querySelector('.product-select');
    const quantityInput = row.querySelector('.quantity-input');
    const priceInput = row.querySelector('.price-input');
    const subtotalSpan = row.querySelector('span');

    productSelect.addEventListener('change', function() {
        const option = this.selectedOptions[0];
        if (option.dataset.price) {
            priceInput.value = option.dataset.price;
            updateSubtotal(row);
        }
    });

    quantityInput.addEventListener('input', function() {
        const option = productSelect.selectedOptions[0];
        const available = parseInt(option.dataset.available || 0);
        if (parseInt(this.value) > available) {
            alert(`Faqat ${available} dona mavjud`);
            this.value = available;
        }
        updateSubtotal(row);
    });

    priceInput.addEventListener('input', function() {
        // Update subtotal immediately while typing
        updateSubtotal(row);
    });
}

function updateSubtotal(row) {
    const quantity = parseFloat(row.querySelector('.quantity-input').value || 0);
    const price = parseFloat(row.querySelector('.price-input').value || 0);
    const subtotal = quantity * price;
    row.querySelector('span').textContent = '$' + subtotal.toFixed(2);
    updateTotal();
}

function updateTotal() {
    let total = 0;
    document.querySelectorAll('.product-item').forEach(row => {
        const quantity = parseFloat(row.querySelector('.quantity-input').value || 0);
        const price = parseFloat(row.querySelector('.price-input').value || 0);
        total += quantity * price;
    });
    document.getElementById('totalAmount').textContent = total.toFixed(2);
    checkDebtSection();
}

// Show/hide debt section based on payment
document.getElementById('initial_payment').addEventListener('input', checkDebtSection);

function checkDebtSection() {
    const total = parseFloat(document.getElementById('totalAmount').textContent);
    const payment = parseFloat(document.getElementById('initial_payment').value || 0);
    const debtSection = document.getElementById('debtSection');

    if (payment < total) {
        debtSection.style.display = 'block';
    } else {
        debtSection.style.display = 'none';
    }
}

// Attach listeners to first row
attachProductRowListeners(document.querySelector('.product-item'));
