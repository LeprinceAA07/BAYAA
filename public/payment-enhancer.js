(() => {
  const disableLegacyPaymentUI = () => {
    document.querySelectorAll('.payment-option').forEach((node) => node.remove());
    document.querySelectorAll('.payment-options').forEach((container) => {
      container.dataset.bayaaDirectContact = 'true';
      container.innerHTML = '<div class="payment-note">لا يوجد دفع من المشتري. بعد إرسال الطلب، سيتواصل المشتري مباشرة مع البائع.</div>';
    });
    document.querySelectorAll('.payment-note').forEach((node) => {
      node.textContent = 'لا يوجد دفع من المشتري. بعد إرسال الطلب، سيتواصل المشتري مباشرة مع البائع.';
    });
  };
  window.addEventListener('DOMContentLoaded', disableLegacyPaymentUI);
  if (document.body) new MutationObserver(disableLegacyPaymentUI).observe(document.body, { childList: true, subtree: true });
})();
