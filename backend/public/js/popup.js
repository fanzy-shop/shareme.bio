// Create and append the success popup to the body
function createSuccessPopup() {
  const popupHTML = `
    <div class="popup-overlay" id="popupOverlay"></div>
    <div id="successPopup" class="success-popup">
      <div class="success-popup-content">
        <div class="success-popup-icon">✓</div>
        <div class="success-popup-message">Success!</div>
        <div class="success-popup-submessage" id="popupSubmessage"></div>
      </div>
      <div class="share-container" id="shareContainer" style="display: none;">
        <input type="text" id="shareLink" class="share-input" readonly>
        <button id="copyShareLink" class="share-button">Copy</button>
      </div>
      <button class="popup-button" id="continueButton">CONTINUE</button>
    </div>
  `;
  
  // Append popup to body
  document.body.insertAdjacentHTML('beforeend', popupHTML);
  
  // Get references to the elements
  const successPopup = document.querySelector('#successPopup');
  const popupOverlay = document.querySelector('#popupOverlay');
  const shareLink = document.querySelector('#shareLink');
  const shareContainer = document.querySelector('#shareContainer');
  const copyShareBtn = document.querySelector('#copyShareLink');
  const continueButton = document.querySelector('#continueButton');
  const popupSubmessage = document.querySelector('#popupSubmessage');
  
  // Copy share link functionality
  copyShareBtn.addEventListener('click', () => {
    shareLink.select();
    document.execCommand('copy');
    
    // Change button text and add copied class
    copyShareBtn.textContent = 'Copied';
    copyShareBtn.classList.add('copied');
    
    // Change back to original text after 1 second
    setTimeout(() => {
      copyShareBtn.textContent = 'Copy';
      copyShareBtn.classList.remove('copied');
    }, 1000);
  });
  
  // Continue button functionality
  continueButton.addEventListener('click', () => {
    hidePopup();
    
    // If we have a redirect URL stored, navigate to it
    if (window.popupRedirectUrl) {
      window.location.href = window.popupRedirectUrl;
      window.popupRedirectUrl = null;
    }
  });
  
  // Function to hide popup
  function hidePopup() {
    successPopup.classList.remove('show');
    popupOverlay.classList.remove('show');
  }
  
  return {
    popup: successPopup,
    overlay: popupOverlay,
    shareInput: shareLink,
    shareContainer: shareContainer,
    continueButton: continueButton,
    submessage: popupSubmessage,
    hide: hidePopup
  };
}

// Show the success popup with a share link
function showSuccessPopup(options = {}) {
  const popupElements = window.popupElements || createSuccessPopup();
  window.popupElements = popupElements;
  
  // Set the title if provided
  if (options.title) {
    const titleElement = popupElements.popup.querySelector('.success-popup-message');
    titleElement.textContent = options.title;
  }
  
  // Set submessage if provided
  if (options.message) {
    popupElements.submessage.textContent = options.message;
    popupElements.submessage.style.display = 'block';
  } else {
    popupElements.submessage.style.display = 'none';
  }
  
  // Handle share link if slug is provided
  if (options.slug) {
    // Create the full URL for sharing
    const shareUrl = `${window.location.origin}/${options.slug}`;
    
    // Set the share link input value
    popupElements.shareInput.value = shareUrl;
    popupElements.shareContainer.style.display = 'flex';
  } else {
    popupElements.shareContainer.style.display = 'none';
  }
  
  // Store redirect URL if provided
  if (options.redirectUrl) {
    window.popupRedirectUrl = options.redirectUrl;
  } else {
    window.popupRedirectUrl = null;
  }
  
  // Set custom button text if provided
  if (options.buttonText) {
    popupElements.continueButton.textContent = options.buttonText;
  } else {
    popupElements.continueButton.textContent = 'CONTINUE';
  }
  
  // Show the popup and overlay
  popupElements.popup.classList.add('show');
  popupElements.overlay.classList.add('show');
  
  // Auto-hide after timeout if specified
  if (options.autoHide) {
    setTimeout(() => {
      popupElements.hide();
      
      // Redirect if needed after auto-hide
      if (window.popupRedirectUrl) {
        window.location.href = window.popupRedirectUrl;
        window.popupRedirectUrl = null;
      }
    }, options.autoHideDelay || 5000);
  }
}

export { createSuccessPopup, showSuccessPopup }; 