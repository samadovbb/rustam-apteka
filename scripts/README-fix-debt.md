# Qarzlar Current Amount To'g'rilash

Bu script qarzlar jadvalidagi `current_amount` ustunini to'g'rilaydi.

## Muammo

Ba'zi qarzlarda `current_amount` qiymati to'lovlar tarixiga mos kelmaydi. To'g'ri hisoblash:

```
current_amount = original_amount - SUM(barcha to'lovlar)
```

## Yechimlar

### 1-usul: SQL Script (Tez va sodda)

SQL scriptni bevosita ishlatish:

```bash
mysql -u [username] -p [database_name] < fix_debt_current_amount.sql
```

Yoki MySQL consoleda:

```sql
source /home/user/rustam-apteka/fix_debt_current_amount.sql
```

### 2-usul: Node.js Script (Xavfsiz, tekshirish bilan)

Node.js scriptni ishlatish (tavsiya etiladi):

```bash
cd /home/user/rustam-apteka
node scripts/fix-debt-amounts.js
```

**Bu script quyidagilarni bajaradi:**
1. Hozirgi holatni tekshiradi va xatolarni ko'rsatadi
2. Sizdan tasdiqlash so'raydi
3. O'zgarishlarni qo'llaydi
4. Natijalarni tekshiradi va hisobot chiqaradi

**Avtomatik tasdiqlash uchun:**

```bash
AUTO_CONFIRM=1 node scripts/fix-debt-amounts.js
```

## Namuna Natija

```
=== HOZIRGI HOLAT ===
3 ta qarzda xatolik topildi:

┌─────────┬──────────────┬────────────┬──────────┬───────────────┬────────┐
│ Qarz ID │   Original   │ To'langan  │ Hozirgi  │ Bo'lishi kerak│  Farq  │
├─────────┼──────────────┼────────────┼──────────┼───────────────┼────────┤
│   1     │   $500.00    │  $200.00   │ $500.00  │   $300.00     │$200.00 │
│   2     │   $800.00    │  $800.00   │ $100.00  │     $0.00     │$100.00 │
│   3     │  $1200.00    │  $400.00   │ $600.00  │   $800.00     │$200.00 │
└─────────┴──────────────┴────────────┴──────────┴───────────────┴────────┘

O'zgarishlarni qo'llashni xohlaysizmi? (ha/yo'q): ha

=== O'ZGARISHLAR QO'LLANMOQDA ===
3 ta qarz yangilandi

=== XULOSA ===
Jami qarzlar: 50
To'g'ri: 50
Xato: 0

✅ Barcha qarzlar muvaffaqiyatli to'g'rilandi!
```

## Ehtiyot Choralari

1. **Backup oling!** Scriptni ishlatishdan oldin ma'lumotlar bazasining backup-ini oling:

```bash
mysqldump -u [username] -p [database_name] > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Test muhitda sinab ko'ring** ishlab chiqarish muhitida qo'llashdan oldin

3. **Natijalarni tekshiring** script bajarilgandan so'ng

## Qo'shimcha Ma'lumot

- Script faqat `current_amount` ni yangilaydi
- Ustamalar (markup) hisoblanmaydi - faqat asosiy to'lovlar
- Bekor qilingan qarzlar ham qayta hisoblanadi
- Original amount o'zgartirilmaydi

## Muammolar

Agar muammo yuzaga kelsa:

1. Backup dan qayta tiklang
2. Script loglarini tekshiring
3. Ma'lumotlar bazasi ulanish sozlamalarini tekshiring (`.env` fayl)

## Texnik Tafsilotlar

**Ishlatiladigan SQL:**

```sql
UPDATE debts d
LEFT JOIN (
    SELECT debt_id, SUM(amount) as total_paid
    FROM debt_payments
    GROUP BY debt_id
) dp ON d.id = dp.debt_id
SET d.current_amount = d.original_amount - COALESCE(dp.total_paid, 0);
```

Bu query:
1. Har bir qarz uchun to'lovlar yig'indisini hisoblaydi
2. `original_amount - to'lovlar` formulasini qo'llaydi
3. Agar to'lov yo'q bo'lsa, 0 deb hisoblaydi
