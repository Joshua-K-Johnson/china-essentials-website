(() => {
  const formSource = 'https://97f0c658.sibforms.com/v2/serve/MUIFAKNnH9zhxAYyiS-qANS_lAA5jLbv9Qk8sDiQ_Y_SDu-pQMRmmOX-sWihDWXaWhbzWHFuS76zCHLYnukbwGxKd_96DenFTYw9-E8D3QP64ddhfGPWsRTUsC2rGJVx0rkdfCL6jl2Dm59WPxDKLGNDxlwxwQIqF5FNbaYzYQs-m-GXX-vW9CD54IlCe4qwKvNNwuglxFbZrfjslQ==';

  class BetaSignupForm extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === 'true') return;

      this.dataset.ready = 'true';
      this.classList.add('beta-signup-embed');

      const iframe = document.createElement('iframe');

      iframe.src = formSource;
      iframe.width = '100%';
      iframe.height = '980';
      iframe.frameBorder = '0';
      iframe.scrolling = 'no';
      iframe.allowFullscreen = true;
      iframe.title = 'China Essentials beta signup form';

      iframe.style.cssText = [
  	'display:block',
  	'width:100%',
  	'max-width:540px',
  	'height:980px',
  	'margin-left:auto',
  	'margin-right:auto',
  	'border:0'
      ].join(';');

      this.append(iframe);
    }
  }

  if (!customElements.get('beta-signup-form')) {
    customElements.define('beta-signup-form', BetaSignupForm);
  }
})();
