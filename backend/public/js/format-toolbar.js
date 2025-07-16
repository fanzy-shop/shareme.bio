// Text formatting toolbar functionality
class FormatToolbar {
  constructor(editorElement) {
    this.editor = editorElement;
    this.selection = null;
    this.toolbar = null;
    this.linkDialog = null;
    
    this.createToolbar();
    this.createLinkDialog();
    this.setupEventListeners();
  }
  
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'format-toolbar';
    
    // Text styles section
    const textStylesSection = document.createElement('div');
    textStylesSection.className = 'format-toolbar-section';
    
    const textStyles = [
      { name: 'Bold', shortcut: 'Ctrl+B', command: 'bold' },
      { name: 'Italic', shortcut: 'Ctrl+I', command: 'italic' },
      { name: 'Underline', shortcut: 'Ctrl+U', command: 'underline' },
      { name: 'Strikethrough', shortcut: 'Ctrl+Shift+X', command: 'strikeThrough' },
      { name: 'Quote', shortcut: 'Ctrl+Shift+.', command: 'formatBlock', value: '<blockquote>' },
      { name: 'Monospace', shortcut: 'Ctrl+Shift+M', command: 'formatBlock', value: '<pre>' },
      { name: 'Spoiler', shortcut: 'Ctrl+Shift+P', command: 'customSpoiler' }
    ];
    
    textStyles.forEach(style => {
      const button = this.createButton(style.name, style.shortcut, () => {
        if (style.command === 'customSpoiler') {
          this.applySpoiler();
        } else if (style.value) {
          document.execCommand(style.command, false, style.value);
        } else {
          document.execCommand(style.command, false, null);
        }
      });
      textStylesSection.appendChild(button);
    });
    
    // Links & Cleaning section
    const linksSection = document.createElement('div');
    linksSection.className = 'format-toolbar-section';
    
    const linkButton = this.createButton('Create link', 'Ctrl+K', () => {
      this.showLinkDialog();
    });
    
    const clearButton = this.createButton('Clear formatting', 'Ctrl+Shift+N', () => {
      document.execCommand('removeFormat', false, null);
    });
    
    linksSection.appendChild(linkButton);
    linksSection.appendChild(clearButton);
    
    // Add sections to toolbar
    toolbar.appendChild(textStylesSection);
    toolbar.appendChild(linksSection);
    
    // Add toolbar to document
    document.body.appendChild(toolbar);
    this.toolbar = toolbar;
  }
  
  createButton(name, shortcut, clickHandler) {
    const button = document.createElement('button');
    button.className = 'format-button';
    button.innerHTML = `${name}<span class="shortcut">${shortcut}</span>`;
    button.addEventListener('click', (e) => {
      e.preventDefault();
      clickHandler();
      this.hideToolbar();
      this.editor.focus();
      
      // Restore selection if possible
      if (this.selection) {
        const range = document.createRange();
        range.setStart(this.selection.startContainer, this.selection.startOffset);
        range.setEnd(this.selection.endContainer, this.selection.endOffset);
        
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
    return button;
  }
  
  createLinkDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'link-dialog';
    
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'Enter URL';
    
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'link-dialog-buttons';
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'link-dialog-button cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      this.hideLinkDialog();
      this.editor.focus();
    });
    
    const applyButton = document.createElement('button');
    applyButton.className = 'link-dialog-button apply';
    applyButton.textContent = 'Apply';
    applyButton.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url) {
        // Restore selection
        if (this.selection) {
          const range = document.createRange();
          range.setStart(this.selection.startContainer, this.selection.startOffset);
          range.setEnd(this.selection.endContainer, this.selection.endOffset);
          
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        
        document.execCommand('createLink', false, url);
      }
      this.hideLinkDialog();
      this.editor.focus();
    });
    
    buttonsDiv.appendChild(cancelButton);
    buttonsDiv.appendChild(applyButton);
    
    dialog.appendChild(urlInput);
    dialog.appendChild(buttonsDiv);
    
    document.body.appendChild(dialog);
    this.linkDialog = dialog;
    this.urlInput = urlInput;
  }
  
  setupEventListeners() {
    // Show toolbar on text selection
    this.editor.addEventListener('mouseup', this.handleTextSelection.bind(this));
    this.editor.addEventListener('keyup', this.handleTextSelection.bind(this));
    
    // Hide toolbar when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (!this.toolbar.contains(e.target) && e.target !== this.toolbar && !this.linkDialog.contains(e.target)) {
        this.hideToolbar();
        this.hideLinkDialog();
      }
    });
    
    // Add keyboard shortcuts
    this.editor.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }
  
  handleTextSelection() {
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      
      // Check if selection is within editor
      if (this.editor.contains(range.commonAncestorContainer)) {
        // Save selection for later use
        this.selection = {
          startContainer: range.startContainer,
          startOffset: range.startOffset,
          endContainer: range.endContainer,
          endOffset: range.endOffset
        };
        
        // Get position for toolbar
        const rect = range.getBoundingClientRect();
        this.showToolbar(rect);
      }
    } else {
      this.hideToolbar();
    }
  }
  
  showToolbar(rect) {
    const toolbar = this.toolbar;
    
    // Position toolbar above the selection
    const toolbarHeight = toolbar.offsetHeight || 200; // Estimate if not rendered yet
    
    toolbar.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (toolbar.offsetWidth / 2)}px`;
    toolbar.style.top = `${rect.top + window.scrollY - toolbarHeight - 10}px`;
    
    // Make sure toolbar is within viewport
    const viewportWidth = window.innerWidth;
    const toolbarRect = toolbar.getBoundingClientRect();
    
    if (toolbarRect.right > viewportWidth) {
      toolbar.style.left = `${viewportWidth - toolbar.offsetWidth - 10}px`;
    }
    
    if (toolbarRect.left < 0) {
      toolbar.style.left = '10px';
    }
    
    toolbar.classList.add('show');
  }
  
  hideToolbar() {
    this.toolbar.classList.remove('show');
  }
  
  showLinkDialog() {
    // Position dialog near toolbar
    const toolbarRect = this.toolbar.getBoundingClientRect();
    
    this.linkDialog.style.left = `${toolbarRect.left}px`;
    this.linkDialog.style.top = `${toolbarRect.bottom + 10}px`;
    
    this.urlInput.value = '';
    this.linkDialog.classList.add('show');
    this.urlInput.focus();
  }
  
  hideLinkDialog() {
    this.linkDialog.classList.remove('show');
  }
  
  applySpoiler() {
    // Custom implementation for spoiler since it's not a standard command
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Create spoiler span
      const spoilerSpan = document.createElement('span');
      spoilerSpan.className = 'spoiler';
      spoilerSpan.style.backgroundColor = '#2c2f33';
      spoilerSpan.style.color = 'transparent';
      spoilerSpan.style.cursor = 'pointer';
      spoilerSpan.dataset.spoiler = 'true';
      
      // Extract selection content and put it in the span
      spoilerSpan.appendChild(range.extractContents());
      range.insertNode(spoilerSpan);
      
      // Add click event to reveal spoiler
      spoilerSpan.addEventListener('click', function() {
        if (this.dataset.revealed !== 'true') {
          this.style.backgroundColor = 'rgba(44, 47, 51, 0.1)';
          this.style.color = 'inherit';
          this.dataset.revealed = 'true';
        } else {
          this.style.backgroundColor = '#2c2f33';
          this.style.color = 'transparent';
          this.dataset.revealed = 'false';
        }
      });
    }
  }
  
  handleKeyboardShortcuts(e) {
    // Bold: Ctrl+B
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold', false, null);
    }
    
    // Italic: Ctrl+I
    if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic', false, null);
    }
    
    // Underline: Ctrl+U
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline', false, null);
    }
    
    // Strikethrough: Ctrl+Shift+X
    if (e.ctrlKey && e.shiftKey && e.key === 'X') {
      e.preventDefault();
      document.execCommand('strikeThrough', false, null);
    }
    
    // Quote: Ctrl+Shift+.
    if (e.ctrlKey && e.shiftKey && e.key === '.') {
      e.preventDefault();
      document.execCommand('formatBlock', false, '<blockquote>');
    }
    
    // Monospace: Ctrl+Shift+M
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      document.execCommand('formatBlock', false, '<pre>');
    }
    
    // Spoiler: Ctrl+Shift+P
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      this.applySpoiler();
    }
    
    // Create Link: Ctrl+K
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        this.selection = {
          startContainer: selection.getRangeAt(0).startContainer,
          startOffset: selection.getRangeAt(0).startOffset,
          endContainer: selection.getRangeAt(0).endContainer,
          endOffset: selection.getRangeAt(0).endOffset
        };
        this.showLinkDialog();
      }
    }
    
    // Clear formatting: Ctrl+Shift+N
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      document.execCommand('removeFormat', false, null);
    }
  }
}

// Export the class
export default FormatToolbar; 