import { publish, checkUrl } from './api.js';
import { showSuccessPopup } from './popup.js';

const titleInput = document.querySelector('#title');
const authorInput = document.querySelector('#author');
const editor = document.querySelector('#editor');
const publishBtn = document.querySelector('#btnPublish');

// Custom URL modal elements
const customUrlModal = document.querySelector('#customUrlModal');
const customSlugInput = document.querySelector('#customSlug');
const urlStatus = document.querySelector('#urlStatus');
const statusIcon = document.querySelector('#statusIcon');
const statusMessage = document.querySelector('#statusMessage');
const cancelCustomUrl = document.querySelector('#cancelCustomUrl');
const confirmCustomUrl = document.querySelector('#confirmCustomUrl');

// Save author to localStorage when changed
authorInput.addEventListener('input', () => {
  localStorage.setItem('author', authorInput.value);
});

// Custom URL functionality
let isUrlAvailable = false;
let currentSlug = '';
function showCustomUrlModal() {
  customUrlModal.style.display = 'flex';
  customSlugInput.focus();
  
  // Pre-fill with title-based slug
  const titleSlug = titleInput.value.trim().toLowerCase()
    .replace(/[^a-z09-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  if (titleSlug) {
    customSlugInput.value = titleSlug;
    checkUrlAvailability(titleSlug);
  }
}

// Hide custom URL modal
function hideCustomUrlModal() {
  customUrlModal.style.display = 'none';
  urlStatus.style.display = 'none';
  customSlugInput.value = '';
  isUrlAvailable = false;
  updatePublishButton();
}

// Check URL availability with debouncing
let checkTimeout;
async function checkUrlAvailability(slug) {
  clearTimeout(checkTimeout);
  
  if (!slug || slug.length < 3) {
    showUrlStatus('error', 'Slug must be at least 3 characters');
    return;
  }
  
  checkTimeout = setTimeout(async () => {
    try {
      const result = await checkUrl(slug);
      currentSlug = result.slug || slug;
      
      if (result.available) {
        showUrlStatus('success', result.message);
        isUrlAvailable = true;
      } else {
        showUrlStatus('error', result.message);
        isUrlAvailable = false;
      }
      updatePublishButton();
    } catch (error) {
      showUrlStatus('error', 'Error checking availability');
      isUrlAvailable = false;
      updatePublishButton();
    }
  }, 500); // 500ms debounce
}

// Show URL status
function showUrlStatus(type, message) {
  urlStatus.style.display = 'block';
  statusMessage.textContent = message;
  
  if (type === 'success') {
    urlStatus.style.backgroundColor = '#d4edda';
    urlStatus.style.color = '#155724';
    urlStatus.style.border = '1px solid #c3e6cb';
    statusIcon.textContent = '✅';
  } else {
    urlStatus.style.backgroundColor = '#f8d7da';
    urlStatus.style.color = '#721c24';
    urlStatus.style.border = '1px solid #f5c6cb';
    statusIcon.textContent = '❌';
  }
}

// Update publish button state
function updatePublishButton() {
  if (isUrlAvailable) {
    confirmCustomUrl.disabled = false;
    confirmCustomUrl.style.opacity = '1';
  } else {
    confirmCustomUrl.disabled = true;
    confirmCustomUrl.style.opacity = '0.5';
  }
}

// Event listeners for custom URL modal
customSlugInput.addEventListener('input', (e) => {
  const slug = e.target.value.trim();
  checkUrlAvailability(slug);
});

cancelCustomUrl.addEventListener('click', hideCustomUrlModal);

confirmCustomUrl.addEventListener('click', async () => {
  if (!isUrlAvailable) return;
  
  // Proceed with publishing
  const payload = {
    title: titleInput.value,
    content: editor.innerHTML,
    author: authorInput.value,
    customSlug: currentSlug
  };
  
  if (window.__slug) {
    payload.slug = window.__slug;
    payload.editToken = window.__token;
  }
  
  const res = await publish(payload);
  if (res.ok) {
    // Store the edit token in localStorage with the slug as the key
    localStorage.setItem(`editToken_${res.slug}`, res.token);
    
    // Hide modal
    hideCustomUrlModal();
    
    // Show success popup with share link
    showSuccessPopup({
      title: 'Published!',
      message: 'Your content has been published successfully',
      slug: res.slug,
      redirectUrl: `/${res.slug}`,
      buttonText: 'CONTINUE'
    });
  } else {
    alert(res.error || 'Error');
  }
});

// Close modal when clicking outside
customUrlModal.addEventListener('click', (e) => {
  if (e.target === customUrlModal) {
    hideCustomUrlModal();
  }
});

publishBtn.addEventListener('click', async () => {
  if (!titleInput.value.trim()) {
    alert('Please enter a title');
    return;
  }

  // Show custom URL modal for new posts
  if (!window.__slug) {
    showCustomUrlModal();
    return;
  }

  // For existing posts, publish directly
  const payload = {
    title: titleInput.value,
    content: editor.innerHTML,
    author: authorInput.value
  };
  
  if (window.__slug) {
    payload.slug = window.__slug;
    payload.editToken = window.__token;
  }
  
  const res = await publish(payload);
  if (res.ok) {
    // Store the edit token in localStorage with the slug as the key
    localStorage.setItem(`editToken_${res.slug}`, res.token);
    
    // Show success popup with share link
    showSuccessPopup({
      title: 'Published!',
      message: 'Your content has been published successfully',
      slug: res.slug,
      redirectUrl: `/${res.slug}`,
      buttonText: 'CONTINUE'
    });
  } else {
    alert(res.error || 'Error');
  }
}); 