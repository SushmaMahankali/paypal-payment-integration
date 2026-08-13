SELECT
    id,
    amount,
    order_id,
    capture_id,
    payment_status,
    refund_id,
    refund_status
FROM payment_transactions
ORDER BY id DESC;