-- Qarzlar jadvalidagi current_amount ustunini to'g'rilash
-- current_amount = original_amount - SUM(to'lovlar)

-- Barcha qarzlar uchun current_amount ni qayta hisoblash
UPDATE debts d
LEFT JOIN (
    SELECT debt_id, SUM(amount) as total_paid
    FROM debt_payments
    GROUP BY debt_id
) dp ON d.id = dp.debt_id
SET d.current_amount = d.original_amount - COALESCE(dp.total_paid, 0);

-- Natijalarni tekshirish
SELECT
    d.id as debt_id,
    d.original_amount,
    COALESCE(SUM(dp.amount), 0) as total_paid,
    d.current_amount,
    (d.original_amount - COALESCE(SUM(dp.amount), 0)) as calculated_amount,
    CASE
        WHEN d.current_amount = (d.original_amount - COALESCE(SUM(dp.amount), 0)) THEN 'OK'
        ELSE 'XATO'
    END as status
FROM debts d
LEFT JOIN debt_payments dp ON d.id = dp.debt_id
GROUP BY d.id, d.original_amount, d.current_amount
ORDER BY d.id;
