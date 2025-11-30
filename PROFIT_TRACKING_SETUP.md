# Foyda Hisoblash Tizimini O'rnatish

Bu qo'llanma sotuvlardan foyda hisoblash funksiyasini qo'shish uchun zarur o'zgarishlarni o'z ichiga oladi.

## O'zgarishlar

### 1. Ma'lumotlar Bazasi O'zgarishlari

`sale_items` jadvaliga yangi ustunlar qo'shildi:
- `purchase_price_at_sale` - Sotish paytidagi sotib olish narxi
- `intake_date` - Mahsulotning oxirgi kirish sanasi

### 2. Kod O'zgarishlari

- **Sale Model** (`src/models/Sale.js`):
  - Sotuv yaratishda har bir mahsulotning kirish narxi va sanasi avtomatik saqlanadi
  - `calculateProfit()` yangi metod qo'shildi - sotuvdan foyda hisoblaydi
  - `getItems()` metodi yangilandi - har bir mahsulot uchun foydani ko'rsatadi

- **Sales Controller** (`src/controllers/salesController.js`):
  - `view()` metodiga foyda hisoblash qo'shildi

- **Sales View** (`src/views/sales/view.ejs`):
  - Har bir mahsulot uchun kirish narxi, kirish sanasi va foydani ko'rsatadi
  - Jami foyda va foyda foizini ko'rsatadi

## Ma'lumotlar Bazasini Yangilash

MySQL konsolida yoki phpMyAdmin orqali quyidagi buyruqni bajaring:

```bash
mysql -u root -p megadent_pos < database/add_profit_tracking.sql
```

Yoki SQL faylni to'g'ridan-to'g'ri ishga tushiring:

```sql
-- database/add_profit_tracking.sql faylini ochib, ichidagi barcha SQL buyruqlarni ishga tushiring
```

## Eslatma

- Mavjud sotuvlar uchun `purchase_price_at_sale` va `intake_date` bo'sh bo'ladi
- Yangi sotuvlar avtomatik ravishda bu ma'lumotlarni saqlaydi
- Foyda hisobi: **Foyda = (Sotish narxi - Kirish narxi) × Miqdor**

## Tekshirish

1. Yangi sotuv yarating
2. Sotuv tafsilotlarini ko'ring
3. Har bir mahsulot uchun kirish narxi, sanasi va foydani ko'rishingiz kerak
4. Pastda jami foyda va foyda foizi ko'rsatilishi kerak
