// ===================================
// MegaDent POS - Application Logic
// ===================================

// Customer Search and Autocomplete
async function searchCustomer(phone) {
    if (!phone || phone.length < 3) return null;

    try {
        const response = await fetch(`/customers/api/phone/${encodeURIComponent(phone)}`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Customer search error:', error);
        return null;
    }
}

// Product Search
async function searchProduct(query) {
    if (!query || query.length < 2) return [];

    try {
        const response = await fetch(`/products/api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Product search error:', error);
        return [];
    }
}

// Get Product by Barcode
async function getProductByBarcode(barcode) {
    try {
        const response = await fetch(`/products/api/barcode/${encodeURIComponent(barcode)}`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Get product error:', error);
        return null;
    }
}

// Get Seller Inventory
async function getSellerInventory(sellerId) {
    try {
        const response = await fetch(`/sales/api/seller/${sellerId}/inventory`);
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Get seller inventory error:', error);
        return [];
    }
}

// Format Currency
function formatCurrency(amount) {
    return '$' + parseFloat(amount).toFixed(2);
}

// Format Date
function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

// Confirm Delete
function confirmDelete(message = 'Are you sure you want to delete this item?') {
    return confirm(message);
}

// Add Delete Confirmations
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('form[action*="/delete"]').forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!confirmDelete()) {
                e.preventDefault();
            }
        });
    });
});

// Initialize tooltips and other UI elements
document.addEventListener('DOMContentLoaded', function() {
    console.log('MegaDent POS System loaded');
});
