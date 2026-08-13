import { useEffect, useState } from "react";
import { PayPalOneTimePaymentButton } from "@paypal/react-paypal-js/sdk-v6";
import "./App.css";

function App() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    amount: "10.00",
  });

  const [paymentStatus, setPaymentStatus] = useState("");
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState({});

  // Transaction History
  const [transactions, setTransactions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefundingId, setHistoryRefundingId] = useState(null);

  // ---------------------------------
  // Handle form input changes
  // ---------------------------------
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    let errorMessage = "";

    if (name === "firstName") {
      if (!value.trim()) {
        errorMessage = "First name is required.";
      }
    }

    if (name === "lastName") {
      if (!value.trim()) {
        errorMessage = "Last name is required.";
      }
    }

    if (name === "email") {
      if (!value.trim()) {
        errorMessage = "Email address is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errorMessage = "Please enter a valid email address.";
      }
    }

    if (name === "phone") {
      if (!value.trim()) {
        errorMessage = "Phone number is required.";
      } else if (!/^\d{10}$/.test(value)) {
        errorMessage = "Phone number must contain 10 digits.";
      }
    }

    if (name === "amount") {
      if (!value.trim()) {
        errorMessage = "Payment amount is required.";
      } else if (Number(value) <= 0) {
        errorMessage = "Amount must be greater than $0.";
      }
    }

    setErrors((previousErrors) => ({
      ...previousErrors,
      [name]: errorMessage,
    }));
  };

  // ---------------------------------
  // Validate form
  // ---------------------------------
  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required.";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    ) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = "Phone number must contain 10 digits.";
    }

    if (!formData.amount.trim()) {
      newErrors.amount = "Payment amount is required.";
    } else if (
      Number.isNaN(Number(formData.amount)) ||
      Number(formData.amount) <= 0
    ) {
      newErrors.amount = "Amount must be greater than $0.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // ---------------------------------
  // Enable / disable PayPal button
  // ---------------------------------
  const isFormValid =
    formData.firstName.trim() !== "" &&
    formData.lastName.trim() !== "" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
    /^\d{10}$/.test(formData.phone) &&
    formData.amount.trim() !== "" &&
    Number(formData.amount) > 0;

  // ---------------------------------
  // Load Transaction History
  // ---------------------------------
  const loadTransactions = async () => {
    setHistoryLoading(true);

    try {
      const response = await fetch(
        "http://localhost:8080/api/paypal/transactions"
      );

      if (!response.ok) {
        throw new Error("Unable to load transactions.");
      }

      const data = await response.json();

      setTransactions(data);
    } catch (error) {
      console.error("Transaction History Error:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ---------------------------------
  // Create PayPal Order
  // ---------------------------------
  const createPayPalOrder = async () => {
    if (!validateForm()) {
      setPaymentStatus("Please correct the form errors.");

      throw new Error("Please correct the form errors.");
    }

    setIsProcessing(true);
    setPaymentStatus("Creating PayPal order...");
    setTransactionDetails(null);

    try {
      const response = await fetch(
        "http://localhost:8080/api/paypal/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            amount: Number(formData.amount),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Unable to create PayPal order.");
      }

      const data = await response.json();

      console.log("Order created:", data);

      return {
        orderId: data.id,
      };
    } catch (error) {
      console.error("Create Order Error:", error);

      setPaymentStatus("Unable to create PayPal order.");
      setIsProcessing(false);

      throw error;
    }
  };

  // ---------------------------------
  // Capture PayPal Payment
  // ---------------------------------
  const capturePayPalOrder = async (data) => {
    setPaymentStatus("Capturing payment...");

    try {
      const response = await fetch(
        `http://localhost:8080/api/paypal/capture-order/${data.orderId}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to capture PayPal payment.");
      }

      const captureData = await response.json();

      console.log("Payment captured:", captureData);

      const capture =
        captureData.purchase_units?.[0]?.payments?.captures?.[0];

      if (captureData.status === "COMPLETED") {
        setTransactionDetails({
          orderId: captureData.id,
          captureId: capture?.id || "N/A",
          status: capture?.status || captureData.status,
          amount: capture?.amount?.value || formData.amount,
          currency: capture?.amount?.currency_code || "USD",
          customerName: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          refundId: null,
          refundStatus: null,
        });

        setPaymentStatus("");

        // Automatically update history
        await loadTransactions();

        setIsProcessing(false);
      } else {
        setPaymentStatus("Payment was not completed.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Capture Error:", error);

      setPaymentStatus("Payment capture failed.");
      setIsProcessing(false);
    }
  };

  // ---------------------------------
  // Refund current payment
  // ---------------------------------
  const refundPayment = async () => {
    if (!transactionDetails?.captureId) {
      setPaymentStatus("Capture ID is missing.");
      return;
    }

    setIsProcessing(true);
    setPaymentStatus("Processing refund...");

    try {
      const response = await fetch(
        `http://localhost:8080/api/paypal/refund/${transactionDetails.captureId}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to refund payment.");
      }

      const refundData = await response.json();

      console.log("Refund completed:", refundData);

      if (refundData.status === "COMPLETED") {
        setTransactionDetails((previous) => ({
          ...previous,
          refundId: refundData.id,
          refundStatus: refundData.status,
        }));

        await loadTransactions();

        setPaymentStatus("Refund completed successfully!");
      } else {
        setPaymentStatus(
          `Refund status: ${refundData.status}`
        );
      }
    } catch (error) {
      console.error("Refund Error:", error);

      setPaymentStatus("Refund failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------
  // Refund from Transaction History
  // ---------------------------------
  const refundFromHistory = async (transaction) => {
    if (!transaction.captureId) {
      setPaymentStatus(
        "This transaction does not have a Capture ID."
      );
      return;
    }

    setHistoryRefundingId(transaction.id);
    setPaymentStatus("Processing refund...");

    try {
      const response = await fetch(
        `http://localhost:8080/api/paypal/refund/${transaction.captureId}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to refund payment.");
      }

      const refundData = await response.json();

      console.log(
        "History refund completed:",
        refundData
      );

      if (refundData.status === "COMPLETED") {
        setPaymentStatus(
          "Refund completed successfully!"
        );

        await loadTransactions();
      } else {
        setPaymentStatus(
          `Refund status: ${refundData.status}`
        );
      }
    } catch (error) {
      console.error(
        "History Refund Error:",
        error
      );

      setPaymentStatus("Refund failed.");
    } finally {
      setHistoryRefundingId(null);
    }
  };

  // ---------------------------------
  // Automatically load history
  // ---------------------------------
  useEffect(() => {
    loadTransactions();
  }, []);

  return (
    <div className="page">
      <div className="payment-card">
        <div className="header">
          <h1>PayPal Payment</h1>
          <p>Secure Sandbox Payment Demo</p>
        </div>

        <div>
          {/* Personal Details */}
          <h2>Personal Details</h2>

          <div className="name-row">
            <div className="form-group">
              <label>First Name</label>

              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter first name"
                disabled={isProcessing}
                className={
                  errors.firstName
                    ? "input-error"
                    : ""
                }
              />

              {errors.firstName && (
                <p className="error-message">
                  {errors.firstName}
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Last Name</label>

              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter last name"
                disabled={isProcessing}
                className={
                  errors.lastName
                    ? "input-error"
                    : ""
                }
              />

              {errors.lastName && (
                <p className="error-message">
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email"
              disabled={isProcessing}
              className={
                errors.email
                  ? "input-error"
                  : ""
              }
            />

            {errors.email && (
              <p className="error-message">
                {errors.email}
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Phone Number</label>

            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter 10 digit phone number"
              disabled={isProcessing}
              className={
                errors.phone
                  ? "input-error"
                  : ""
              }
            />

            {errors.phone && (
              <p className="error-message">
                {errors.phone}
              </p>
            )}
          </div>

          {/* Payment Details */}
          <h2>Payment Details</h2>

          <div className="form-group">
            <label>Amount (USD)</label>

            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="Enter amount"
              min="0.01"
              step="0.01"
              disabled={isProcessing}
              className={
                errors.amount
                  ? "input-error"
                  : ""
              }
            />

            {errors.amount && (
              <p className="error-message">
                {errors.amount}
              </p>
            )}
          </div>

          <div className="amount-box">
            <span>Payment Amount</span>

            <strong>
              $
              {Number(formData.amount) > 0
                ? Number(formData.amount).toFixed(2)
                : "0.00"}{" "}
              USD
            </strong>
          </div>

          {!isFormValid &&
            Object.keys(errors).length === 0 && (
              <p className="form-message">
                Complete all personal details to enable PayPal.
              </p>
            )}

          {/* PayPal Button */}
          <div className="paypal-container">
            <PayPalOneTimePaymentButton
              createOrder={createPayPalOrder}
              onApprove={capturePayPalOrder}
              onCancel={(data) => {
                console.log(
                  "PayPal checkout cancelled:",
                  data
                );

                setPaymentStatus(
                  "Payment cancelled."
                );

                setIsProcessing(false);
              }}
              onError={(error) => {
                console.error(
                  "PayPal Error:",
                  error
                );

                setPaymentStatus(
                  error?.message ||
                    "PayPal payment failed."
                );

                setIsProcessing(false);
              }}
              presentationMode="auto"
              disabled={
                !isFormValid || isProcessing
              }
              type="pay"
            />
          </div>

          {/* Status */}
          {paymentStatus && (
            <div className="payment-status">
              {paymentStatus}
            </div>
          )}

          {/* Payment Success */}
          {transactionDetails && (
            <div className="success-card">
              <div className="success-icon">
                ✓
              </div>

              <h2 className="success-title">
                Payment Successful
              </h2>

              <p className="success-subtitle">
                Your PayPal Sandbox payment has been completed successfully.
              </p>

              <div className="transaction-details">
                <div className="detail-row">
                  <span>Amount</span>

                  <strong>
                    ${transactionDetails.amount}{" "}
                    {transactionDetails.currency}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Payment Status</span>

                  <strong className="completed-status">
                    {transactionDetails.status}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Order ID</span>

                  <strong>
                    {transactionDetails.orderId}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Capture ID</span>

                  <strong>
                    {transactionDetails.captureId}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Customer</span>

                  <strong>
                    {transactionDetails.customerName}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Email</span>

                  <strong>
                    {transactionDetails.email}
                  </strong>
                </div>
              </div>

              {/* Refund current payment */}
              {!transactionDetails.refundId && (
                <button
                  type="button"
                  className="refund-button"
                  onClick={refundPayment}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? "Processing..."
                    : "Refund Payment"}
                </button>
              )}

              {/* Refund success */}
              {transactionDetails.refundId && (
                <div className="refund-details">
                  <h3>
                    ✓ Refund Successful
                  </h3>

                  <div className="detail-row">
                    <span>Refund Status</span>

                    <strong className="completed-status">
                      {
                        transactionDetails.refundStatus
                      }
                    </strong>
                  </div>

                  <div className="detail-row">
                    <span>Refund ID</span>

                    <strong>
                      {transactionDetails.refundId}
                    </strong>
                  </div>

                  <div className="detail-row">
                    <span>Refund Amount</span>

                    <strong>
                      ${transactionDetails.amount}{" "}
                      {transactionDetails.currency}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------
              Transaction History
          ---------------------------------- */}
          <div className="history-section">
            <div className="history-header">
              <h2>Transaction History</h2>

              <button
                type="button"
                className="refresh-button"
                onClick={loadTransactions}
                disabled={historyLoading}
              >
                {historyLoading
                  ? "Loading..."
                  : "Refresh"}
              </button>
            </div>

            {transactions.length === 0 ? (
              <p className="no-transactions">
                No transactions available.
              </p>
            ) : (
              <div className="table-wrapper">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Refund</th>
                      <th>Action</th>
                      <th>Order ID</th>
                    </tr>
                  </thead>

                  <tbody>
                    {transactions.map(
                      (transaction) => (
                        <tr key={transaction.id}>
                          <td>
                            {transaction.id}
                          </td>

                          <td>
                            {transaction.firstName}{" "}
                            {transaction.lastName}
                          </td>

                          <td>
                            $
                            {Number(
                              transaction.amount
                            ).toFixed(2)}{" "}
                            {transaction.currency}
                          </td>

                          <td>
                            <span
                              className={
                                transaction.paymentStatus ===
                                "COMPLETED"
                                  ? "status-completed"
                                  : "status-pending"
                              }
                            >
                              {
                                transaction.paymentStatus
                              }
                            </span>
                          </td>

                          <td>
                            {transaction.refundStatus ? (
                              <span className="status-completed">
                                {
                                  transaction.refundStatus
                                }
                              </span>
                            ) : (
                              <span className="status-none">
                                —
                              </span>
                            )}
                          </td>

                          {/* Refund Action */}
                          <td>
                            {transaction.paymentStatus ===
                              "COMPLETED" &&
                            transaction.captureId &&
                            !transaction.refundStatus ? (
                              <button
                                type="button"
                                className="history-refund-button"
                                onClick={() =>
                                  refundFromHistory(
                                    transaction
                                  )
                                }
                                disabled={
                                  historyRefundingId ===
                                  transaction.id
                                }
                              >
                                {historyRefundingId ===
                                transaction.id
                                  ? "Refunding..."
                                  : "Refund"}
                              </button>
                            ) : transaction.refundStatus ===
                              "COMPLETED" ? (
                              <span className="refunded-text">
                                Refunded
                              </span>
                            ) : (
                              <span className="status-none">
                                —
                              </span>
                            )}
                          </td>

                          <td className="id-cell">
                            {transaction.orderId}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="sandbox-text">
            Sandbox environment — no real money will be charged.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;