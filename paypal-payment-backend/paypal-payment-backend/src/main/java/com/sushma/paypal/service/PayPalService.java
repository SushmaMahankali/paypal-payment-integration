package com.sushma.paypal.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import com.sushma.paypal.dto.CreateOrderRequest;
import com.sushma.paypal.entity.PaymentTransaction;
import com.sushma.paypal.repository.PaymentTransactionRepository;

@Service
public class PayPalService {

    private final RestClient restClient;
    private final PaymentTransactionRepository paymentTransactionRepository;

    @Value("${paypal.base-url}")
    private String baseUrl;

    @Value("${paypal.client-id}")
    private String clientId;

    @Value("${paypal.client-secret}")
    private String clientSecret;

    public PayPalService(
            RestClient.Builder restClientBuilder,
            PaymentTransactionRepository paymentTransactionRepository) {

        this.restClient = restClientBuilder.build();
        this.paymentTransactionRepository = paymentTransactionRepository;
    }

    // ------------------------------------------------
    // 1. GET PAYPAL ACCESS TOKEN
    // ------------------------------------------------
    public String getAccessToken() {

        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();

        formData.add("grant_type", "client_credentials");

        Map<?, ?> response = restClient.post()
                .uri(baseUrl + "/v1/oauth2/token")
                .headers(headers -> headers.setBasicAuth(clientId, clientSecret))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(formData)
                .retrieve()
                .body(Map.class);

        if (response == null ||
                response.get("access_token") == null) {

            throw new RuntimeException(
                    "Unable to retrieve PayPal access token.");
        }

        return (String) response.get("access_token");
    }

    // ------------------------------------------------
    // 2. CREATE PAYPAL ORDER
    // ------------------------------------------------
    public Map<?, ?> createOrder(CreateOrderRequest request) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Order request is required.");
        }

        if (request.firstName() == null ||
                request.firstName().isBlank()) {

            throw new IllegalArgumentException(
                    "First name is required.");
        }

        if (request.lastName() == null ||
                request.lastName().isBlank()) {

            throw new IllegalArgumentException(
                    "Last name is required.");
        }

        if (request.email() == null ||
                request.email().isBlank()) {

            throw new IllegalArgumentException(
                    "Email is required.");
        }

        if (request.phone() == null ||
                request.phone().isBlank()) {

            throw new IllegalArgumentException(
                    "Phone number is required.");
        }

        BigDecimal amount = request.amount();

        if (amount == null ||
                amount.compareTo(BigDecimal.ZERO) <= 0) {

            throw new IllegalArgumentException(
                    "Payment amount must be greater than zero.");
        }

        String accessToken = getAccessToken();

        String formattedAmount = amount
                .setScale(2, RoundingMode.HALF_UP)
                .toPlainString();

        Map<String, Object> amountDetails = Map.of(
                "currency_code", "USD",
                "value", formattedAmount);

        Map<String, Object> purchaseUnit = Map.of(
                "amount", amountDetails);

        Map<String, Object> requestBody = Map.of(
                "intent", "CAPTURE",
                "purchase_units", List.of(purchaseUnit));

        // ---------------------------------------------
        // Call PayPal Create Order API
        // ---------------------------------------------
        Map<?, ?> paypalResponse = restClient.post()
                .uri(baseUrl + "/v2/checkout/orders")
                .headers(headers -> headers.setBearerAuth(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(Map.class);

        if (paypalResponse == null) {
            throw new RuntimeException(
                    "PayPal did not return an order response.");
        }

        // ---------------------------------------------
        // Read values returned by PayPal
        // ---------------------------------------------
        String orderId = (String) paypalResponse.get("id");

        String status = (String) paypalResponse.get("status");

        if (orderId == null || orderId.isBlank()) {
            throw new RuntimeException(
                    "PayPal order ID was not returned.");
        }

        // ---------------------------------------------
        // Save Create Order transaction in MySQL
        // ---------------------------------------------
        PaymentTransaction transaction = new PaymentTransaction();

        transaction.setFirstName(
                request.firstName().trim());

        transaction.setLastName(
                request.lastName().trim());

        transaction.setEmail(
                request.email().trim());

        transaction.setPhone(
                request.phone().trim());

        transaction.setAmount(
                amount.setScale(2, RoundingMode.HALF_UP));

        transaction.setCurrency("USD");

        transaction.setOrderId(orderId);

        transaction.setPaymentStatus(status);

        transaction.setCreatedAt(
                LocalDateTime.now());

        transaction.setUpdatedAt(
                LocalDateTime.now());

        paymentTransactionRepository.save(transaction);

        System.out.println(
                "Transaction saved to database. Order ID: "
                        + orderId);

        return paypalResponse;
    }

    // ------------------------------------------------
    // 3. CAPTURE PAYPAL ORDER
    // ------------------------------------------------
    public Map<?, ?> captureOrder(String orderId) {

        String accessToken = getAccessToken();

        Map<?, ?> captureResponse = restClient.post()
                .uri(
                        baseUrl
                                + "/v2/checkout/orders/"
                                + orderId
                                + "/capture")
                .headers(headers -> headers.setBearerAuth(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of())
                .retrieve()
                .body(Map.class);

        if (captureResponse == null) {
            throw new RuntimeException(
                    "PayPal did not return a capture response.");
        }

        String paymentStatus = (String) captureResponse.get("status");

        String captureId = null;

        Object purchaseUnitsObject = captureResponse.get("purchase_units");

        if (purchaseUnitsObject instanceof List<?> purchaseUnits
                && !purchaseUnits.isEmpty()
                && purchaseUnits.get(0) instanceof Map<?, ?> purchaseUnit) {

            Object paymentsObject = purchaseUnit.get("payments");

            if (paymentsObject instanceof Map<?, ?> payments) {

                Object capturesObject = payments.get("captures");

                if (capturesObject instanceof List<?> captures
                        && !captures.isEmpty()
                        && captures.get(0) instanceof Map<?, ?> capture) {

                    captureId = (String) capture.get("id");

                    if (capture.get("status") != null) {
                        paymentStatus = (String) capture.get("status");
                    }
                }
            }
        }

        PaymentTransaction transaction = paymentTransactionRepository
                .findByOrderId(orderId)
                .orElseThrow(() -> new RuntimeException(
                        "Transaction not found for Order ID: "
                                + orderId));

        transaction.setCaptureId(captureId);
        transaction.setPaymentStatus(paymentStatus);
        transaction.setUpdatedAt(LocalDateTime.now());

        paymentTransactionRepository.save(transaction);

        System.out.println(
                "Transaction updated after capture. Capture ID: "
                        + captureId);

        return captureResponse;
    }

    // ------------------------------------------------
    // 4. REFUND PAYPAL PAYMENT
    // ------------------------------------------------
    public Map<?, ?> refundPayment(String captureId) {

        String accessToken = getAccessToken();

        Map<?, ?> refundResponse = restClient.post()
                .uri(
                        baseUrl
                                + "/v2/payments/captures/"
                                + captureId
                                + "/refund")
                .headers(headers -> headers.setBearerAuth(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of())
                .retrieve()
                .body(Map.class);

        if (refundResponse == null) {
            throw new RuntimeException(
                    "PayPal did not return a refund response.");
        }

        String refundId = (String) refundResponse.get("id");

        String refundStatus = (String) refundResponse.get("status");

        PaymentTransaction transaction = paymentTransactionRepository
                .findByCaptureId(captureId)
                .orElseThrow(() -> new RuntimeException(
                        "Transaction not found for Capture ID: "
                                + captureId));

        transaction.setRefundId(refundId);
        transaction.setRefundStatus(refundStatus);
        transaction.setUpdatedAt(LocalDateTime.now());

        paymentTransactionRepository.save(transaction);

        System.out.println(
                "Transaction updated after refund. Refund ID: "
                        + refundId);

        return refundResponse;
    }

    // ------------------------------------------------
    // 5. GET ALL TRANSACTIONS
    // ------------------------------------------------
    public List<PaymentTransaction> getAllTransactions() {

        return paymentTransactionRepository
                .findAllByOrderByCreatedAtDesc();
    }
}