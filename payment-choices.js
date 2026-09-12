(() => {
  const renderDirectContactNotice = () => {
    document.querySelectorAll('.payment-options').forEach((container) => {
      if (container.dataset.bayaaDirectContact === 'true') return;
      container.dataset.bayaaDirectContact = 'true';
      container.innerHTML = `
        <div class="payment-note" style="padding:14px;border-radius:14px;border:1px solid rgba(15,118,110,.35);background:rgba(15,118,110,.06)">
          لا يوجد دفع من المشتري. بعد إرسال الطلب، سيتواصل المشتري مباشرة مع البائع.
        </div>`;
    });
  };
  window.addEventListener('DOMContentLoaded', renderDirectContactNotice);
  if (document.body) new MutationObserver(renderDirectContactNotice).observe(document.body, { childList: true, subtree: true });
})();
