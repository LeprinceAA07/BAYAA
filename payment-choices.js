(() => {
  const renderCardOnly = () => {
    document.querySelectorAll('.payment-options').forEach((container) => {
      if (container.dataset.cardOnly === 'true') return;
      container.dataset.cardOnly = 'true';
      container.innerHTML = `
        <div class="payment-option active" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:14px;border:1px solid rgba(15,118,110,.35);background:rgba(15,118,110,.06);">
          <span style="font-size:24px;line-height:1">💳</span>
          <span style="display:flex;flex-direction:column;gap:3px"><strong>Visa / Mastercard</strong><small>Paiement sécurisé par carte bancaire</small></span>
          <span style="margin-inline-start:auto;font-size:12px">✓</span>
        </div>`;
      const note = container.parentElement?.querySelector('.payment-note');
      if (note) note.textContent = 'Le paiement se fait uniquement par carte Visa ou Mastercard.';
    });
  };
  const observer = new MutationObserver(renderCardOnly);
  window.addEventListener('DOMContentLoaded', () => {
    renderCardOnly();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
