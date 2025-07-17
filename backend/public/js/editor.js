import { publish } from './api.js';
import { showSuccessPopup } from './popup.js';

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