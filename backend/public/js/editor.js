import { publish, checkSlugAvailability } from './api.js';
import { showSuccessPopup, showCustomUrlPopup } from './popup.js';

const titleInput = document.querySelector('#title');
const authorInput = document.querySelector('#author');
const editor = document.querySelector('#editor');
const publishBtn = document.querySelector('#btnPublish');

// Save author to localStorage when changed
authorInput.addEventListener('input', () => {
  localStorage.setItem('author', authorInput.value);
});

publishBtn.addEventListener('click', async () => {
  if (!titleInput.value.trim()) {
    alert('Please enter a title');
    return;
  }

  // If editing an existing page, publish directly
  if (window.__slug) {
    publishExistingPage();
    return;
  }
  
  // For new pages, show custom URL popup first
  const popupElements = showCustomUrlPopup({
    onSkip: () => {
      // User skipped custom URL, publish with random slug
      publishNewPage();
    },
    onSave: (customSlug) => {
      // User provided a custom URL, publish with it
      publishNewPage(customSlug);
    }
  });
  
  // Set up real-time slug availability checking
  let checkTimeout;
  popupElements.input.addEventListener('input', (e) => {
    const slug = e.target.value.trim();
    
    // Clear any previous status
    popupElements.status.textContent = '';
    popupElements.status.className = 'custom-url-status';
    popupElements.saveButton.disabled = true;
    
    // Clear previous timeout
    if (checkTimeout) clearTimeout(checkTimeout);
    
    if (!slug) {
      popupElements.status.textContent = 'Please enter a custom URL';
      popupElements.status.classList.add('error');
      return;
    }
    
    // Show checking status
    popupElements.status.textContent = 'Checking availability...';
    popupElements.status.classList.add('checking');
    
    // Debounce the API call
    checkTimeout = setTimeout(async () => {
      const result = await checkSlugAvailability(slug);
      
      if (result.available) {
        popupElements.status.textContent = 'Available! ✓';
        popupElements.status.className = 'custom-url-status success';
        popupElements.saveButton.disabled = false;
      } else {
        popupElements.status.textContent = result.error || 'Not available';
        popupElements.status.className = 'custom-url-status error';
        popupElements.saveButton.disabled = true;
      }
    }, 300);
  });
});

// Function to publish a new page
async function publishNewPage(customSlug = null) {
  const payload = {
    title: titleInput.value,
    content: editor.innerHTML,
    author: authorInput.value
  };
  
  // Add custom slug if provided
  if (customSlug) {
    payload.customSlug = customSlug;
  }
  
  try {
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
      alert(res.error || 'Error publishing content');
    }
  } catch (error) {
    console.error('Error publishing:', error);
    alert('Error publishing content');
  }
}

// Function to publish an existing page
async function publishExistingPage() {
  const payload = {
    slug: window.__slug,
    editToken: window.__token,
    title: titleInput.value,
    content: editor.innerHTML,
    author: authorInput.value
  };
  
  try {
    const res = await publish(payload);
    if (res.ok) {
      // Show success popup with share link
      showSuccessPopup({
        title: 'Updated!',
        message: 'Your content has been updated successfully',
        slug: res.slug,
        redirectUrl: `/${res.slug}`,
        buttonText: 'CONTINUE'
      });
    } else {
      alert(res.error || 'Error updating content');
    }
  } catch (error) {
    console.error('Error updating:', error);
    alert('Error updating content');
  }
} 