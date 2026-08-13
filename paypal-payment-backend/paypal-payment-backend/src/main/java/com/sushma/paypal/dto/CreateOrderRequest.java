package com.sushma.paypal.dto;

import java.math.BigDecimal;

public record CreateOrderRequest(
        String firstName,
        String lastName,
        String email,
        String phone,
        BigDecimal amount) {
}