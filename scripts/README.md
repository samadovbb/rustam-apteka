# Retroactive Markup Calculator

## Nima uchun kerak?

Avtomatik ustama qo'shish o'chirildi. Bu script mavjud qarzlarning to'lov tarixiga qarab, kechikkan to'lovlar uchun **faqat fixed ustamalarni** hisoblab qo'shadi.

## Script nima qiladi?

1. **Fixed ustama bor qarzlarni topadi**: Faqat `markup_type = 'fixed'` bo'lgan qarzlar
2. **To'lov tarixini tekshiradi**: Har bir to'lov sanasini ko'radi
3. **Kechikkan oylarni hisoblaydi**: Agar to'lov grace period'dan keyin qilingan bo'lsa
4. **Ustamani qo'shadi**:
   - Kechikkan oy soni × fixed markup miqdori
   - `debt_fixed_markup_logs` jadvaliga yozadi
   - Qarzning `current_amount`ini yangilaydi

## Qanday ishlatish?

### 1. Oddiy ishga tushirish:
```bash
cd /home/user/rustam-apteka
node scripts/calculate-retroactive-markups.js
```

### 2. Yoki npm orqali:
```bash
npm run calculate:markups
```

## Misol

**Qarz ma'lumotlari:**
- Original Amount: $1000
- Fixed Markup: $50/oy
- Grace End Date: 2024-01-01

**To'lovlar:**
1. 2024-03-15 - $300 to'langan
   - Kechikish: 2 oy
   - Ustama: 2 × $50 = $100

2. 2024-06-20 - $400 to'langan
   - Kechikish: 5 oy (grace dan keyin)
   - Ustama: 5 × $50 = $250

**Natija:**
- Jami ustama: $350
- Yangi current_amount: $1000 + $350 = $1350

## Script chiqishi

```
══════════════════════════════════════════════════════════════════════
🔄 RETROACTIVE FIXED MARKUP CALCULATION
══════════════════════════════════════════════════════════════════════

📊 Found 5 debt(s) with fixed markup

──────────────────────────────────────────────────────────────────────
Processing Debt ID: 1
  Customer ID: 5
  Original Amount: $1000.00
  Current Amount: $1000.00
  Fixed Markup: $50.00/month
  Grace End Date: 2024-01-01

  📋 Found 2 payment(s):

  Payment Date: 2024-03-15
  Payment Amount: $300.00
  ⚠️  Payment was 2 month(s) late
  💰 Markup to add: $100.00 (2 × $50.00)
  ✅ Markup log created

  Payment Date: 2024-06-20
  Payment Amount: $400.00
  ⚠️  Payment was 5 month(s) late
  💰 Markup to add: $250.00 (5 × $50.00)
  ✅ Markup log created

  📈 Total Markup for this debt: $350.00
  💵 Updated Current Amount: $1000.00 → $1350.00

══════════════════════════════════════════════════════════════════════
📊 SUMMARY
══════════════════════════════════════════════════════════════════════
Total Debts Processed: 5
Debts with Markup Added: 3
Total Markup Added: $850.00
══════════════════════════════════════════════════════════════════════
✅ Retroactive markup calculation completed!
```

## Xavfsizlik

- Script bir xil to'lov sanasi uchun ikki marta ustama qo'shmaydi
- Faqat fixed markup bo'lgan qarzlarga ta'sir qiladi
- Grace period ichidagi to'lovlarga ustama qo'shilmaydi
- Transaction ishlatadi (agar xato bo'lsa hech narsa o'zgarmaydi)

## Muhim eslatmalar

1. **Bir marta ishga tushiring**: Script mavjud ma'lumotlarga asoslanadi
2. **Backup oling**: Ishlatishdan oldin database backup qiling
3. **Testlash**: Birinchi marta test ma'lumotlarda sinab ko'ring
4. **Percent markup**: Bu script faqat fixed markup bilan ishlaydi

## Muammolar

Agar script xato bersa:
1. Database connection tekshiring (.env file)
2. Script chiqishini o'qing (qaysi debt'da xato bo'lganini ko'rsatadi)
3. Ma'lumotlar to'g'riligini tekshiring (grace_end_date, markup_value)
