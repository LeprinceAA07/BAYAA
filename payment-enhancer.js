(() => {
  // Buyer checkout is a direct-contact flow. Never redirect buyers to a payment gateway.
  // Seller subscriptions/commissions use the dedicated seller billing flow instead.
  const disableLegacyPaymentUI = () => {
    document.querySelectorAll('.payment-option, .payment-options').forEach((node) => {
      if (node.matches('.payment-options')) {
        node.innerHTML = '<div class="payment-note">لا يوجد دفع من المشتري. بعد إرسال الطلب، سيتواصل المشتري مباشرة مع البائع.</div>';
      } else {
        node.remove();
      }
    });
    document.querySelectorAll('.payment-note').forEach((node) => {
      node.textContent = 'لا يوجد دفع من المشتري. بعد إرسال الطلب، سيتواصل المشتري مباشرة مع البائع.';
    });
  };

  window.addEventListener('DOMContentLoaded', disableLegacyPaymentUI);
  const observer = new MutationObserver(disableLegacyPaymentUI);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
