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
    this.setupUndoRedo();
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
      this.clearFormatting();
    });
    
    linksSection.appendChild(linkButton);
    linksSection.appendChild(clearButton);
    
    // Undo/Redo section
    const undoRedoSection = document.createElement('div');
    undoRedoSection.className = 'format-toolbar-section';
    
    const undoIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
  <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"></path>
</svg>`;

const redoIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
  <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"></path>
</svg>`;

const undoButton = this.createButton(`${undoIcon}Undo`, 'Ctrl+Z', () => {
  this.undo();
});

const redoButton = this.createButton(`${redoIcon}Redo`, 'Ctrl+Y', () => {
  this.redo();
});
    
    undoRedoSection.appendChild(undoButton);
    undoRedoSection.appendChild(redoButton);
    
    // Add sections to toolbar
    toolbar.appendChild(textStylesSection);
    toolbar.appendChild(linksSection);
    toolbar.appendChild(undoRedoSection);
    
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
    
    // Prevent default context menu and show our toolbar instead
    this.editor.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      // Get selection
      const selection = window.getSelection();
      
      // If no text is selected, select the word under cursor
      if (selection.isCollapsed) {
        this.selectWordUnderCursor(e);
      }
      
      // Show the toolbar at cursor position
      const rect = {
        left: e.clientX - 5,
        top: e.clientY - 5,
        width: 10,
        height: 10
      };
      
      this.showToolbar(rect);
    });
    
    // Hide toolbar when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (!this.toolbar.contains(e.target) && e.target !== this.toolbar && !this.linkDialog.contains(e.target)) {
        this.hideToolbar();
        this.hideLinkDialog();
      }
    });
    
    // Add keyboard shortcuts
    this.editor.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    
    // Add click handler for spoilers in the editor
    this.editor.addEventListener('click', (e) => {
      if (e.target.classList.contains('spoiler') || e.target.closest('.spoiler')) {
        const spoiler = e.target.classList.contains('spoiler') ? e.target : e.target.closest('.spoiler');
        this.toggleSpoiler(spoiler);
      }
    });
  }
  
  // Setup undo/redo functionality
  setupUndoRedo() {
    // Store initial content
    this.lastContent = this.editor.innerHTML;
    this.undoStack = [this.lastContent];
    this.redoStack = [];
    this.isUndoRedo = false;
    
    // Monitor content changes
    this.editor.addEventListener('input', () => {
      if (!this.isUndoRedo) {
        const currentContent = this.editor.innerHTML;
        if (currentContent !== this.lastContent) {
          this.undoStack.push(currentContent);
          this.redoStack = [];
          this.lastContent = currentContent;
          
          // Limit stack size to prevent memory issues
          if (this.undoStack.length > 100) {
            this.undoStack.shift();
          }
        }
      }
    });
  }
  
  // Perform undo operation
  undo() {
    if (this.undoStack.length > 1) {
      this.isUndoRedo = true;
      this.redoStack.push(this.undoStack.pop());
      this.lastContent = this.undoStack[this.undoStack.length - 1];
      this.editor.innerHTML = this.lastContent;
      this.isUndoRedo = false;
    }
  }
  
  // Perform redo operation
  redo() {
    if (this.redoStack.length > 0) {
      this.isUndoRedo = true;
      const content = this.redoStack.pop();
      this.undoStack.push(content);
      this.lastContent = content;
      this.editor.innerHTML = content;
      this.isUndoRedo = false;
    }
  }
  
  // Toggle spoiler visibility
  toggleSpoiler(spoilerElement) {
    if (spoilerElement.dataset.revealed !== 'true') {
      spoilerElement.style.backgroundColor = 'rgba(44, 47, 51, 0.1)';
      spoilerElement.style.color = 'inherit';
      spoilerElement.dataset.revealed = 'true';
    } else {
      spoilerElement.style.backgroundColor = '#2c2f33';
      spoilerElement.style.color = 'transparent';
      spoilerElement.dataset.revealed = 'false';
    }
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
      spoilerSpan.dataset.revealed = 'false';
      
      // Extract selection content and put it in the span
      spoilerSpan.appendChild(range.extractContents());
      range.insertNode(spoilerSpan);
    }
  }
  
  // Enhanced clear formatting that handles all elements
  clearFormatting() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // First try the standard removeFormat command
      document.execCommand('removeFormat', false, null);
      
      // Get the current selection again after the removeFormat command
      const currentRange = selection.getRangeAt(0);
      const fragment = currentRange.extractContents();
      
      // Process the fragment to remove all formatting
      const div = document.createElement('div');
      div.appendChild(fragment.cloneNode(true));
      
      // Specifically remove all formatting types
      this.removeSpecificFormatting(div);
      
      // Insert the cleaned content
      const cleanFragment = document.createDocumentFragment();
      while (div.firstChild) {
        cleanFragment.appendChild(div.firstChild);
      }
      
      currentRange.insertNode(cleanFragment);
      
      // Position cursor at the end
      currentRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(currentRange);
    }
  }
  
  // Helper method to remove specific formatting types
  removeSpecificFormatting(element) {
    // Process all child nodes recursively
    const processNode = (node) => {
      // Skip if not an element
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return node;
      }
      
      const nodeName = node.nodeName.toLowerCase();
      
      // Handle block-level formatting (quotes, pre/monospace)
      if (nodeName === 'blockquote' || nodeName === 'pre') {
        const fragment = document.createDocumentFragment();
        while (node.firstChild) {
          const child = node.firstChild;
          node.removeChild(child);
          // Process child nodes recursively
          if (child.nodeType === Node.ELEMENT_NODE) {
            processNode(child);
          }
          fragment.appendChild(child);
        }
        node.parentNode.replaceChild(fragment, node);
        return null;
      }
      
      // Handle inline formatting (bold, italic, underline, strike, spoiler)
      if (nodeName === 'b' || nodeName === 'strong' || 
          nodeName === 'i' || nodeName === 'em' ||
          nodeName === 'u' || nodeName === 's' || 
          nodeName === 'strike' || nodeName === 'del') {
        const fragment = document.createDocumentFragment();
        while (node.firstChild) {
          const child = node.firstChild;
          node.removeChild(child);
          // Process child nodes recursively
          if (child.nodeType === Node.ELEMENT_NODE) {
            processNode(child);
          }
          fragment.appendChild(child);
        }
        node.parentNode.replaceChild(fragment, node);
        return null;
      }
      
      // Handle spoiler spans
      if ((nodeName === 'span' && node.classList.contains('spoiler')) || 
          node.dataset.spoiler === 'true') {
        const fragment = document.createDocumentFragment();
        while (node.firstChild) {
          const child = node.firstChild;
          node.removeChild(child);
          // Process child nodes recursively
          if (child.nodeType === Node.ELEMENT_NODE) {
            processNode(child);
          }
          fragment.appendChild(child);
        }
        node.parentNode.replaceChild(fragment, node);
        return null;
      }
      
      // Handle links
      if (nodeName === 'a') {
        const fragment = document.createDocumentFragment();
        while (node.firstChild) {
          const child = node.firstChild;
          node.removeChild(child);
          // Process child nodes recursively
          if (child.nodeType === Node.ELEMENT_NODE) {
            processNode(child);
          }
          fragment.appendChild(child);
        }
        node.parentNode.replaceChild(fragment, node);
        return null;
      }
      
      // Process all children for other elements
      const childNodes = Array.from(node.childNodes);
      for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
          processNode(child);
        }
      }
      
      return node;
    };
    
    // Process all children of the element
    const childNodes = Array.from(element.childNodes);
    for (let i = 0; i < childNodes.length; i++) {
      const child = childNodes[i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        processNode(child);
      }
    }
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
    
    // Calculate initial position
    let left = rect.left + window.scrollX + (rect.width / 2) - (toolbar.offsetWidth / 2);
    let top = rect.top + window.scrollY - toolbarHeight - 10;
    
    // Make sure toolbar is within viewport horizontally
    const viewportWidth = window.innerWidth;
    const editorRect = this.editor.getBoundingClientRect();
    const editorLeft = editorRect.left + window.scrollX;
    const editorRight = editorRect.right + window.scrollX;
    
    // Constrain to editor width
    if (left + toolbar.offsetWidth > editorRight) {
      left = editorRight - toolbar.offsetWidth - 10;
    }
    
    if (left < editorLeft) {
      left = editorLeft + 10;
    }
    
    // Ensure we don't go off-screen
    if (left < 10) left = 10;
    if (left + toolbar.offsetWidth > window.innerWidth - 10) {
      left = window.innerWidth - toolbar.offsetWidth - 10;
    }
    
    // Check if toolbar would go above viewport
    if (top < window.scrollY + 10) {
      // Place below selection instead
      top = rect.bottom + window.scrollY + 10;
    }
    
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    
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
      this.clearFormatting();
    }
    
    // Undo: Ctrl+Z
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      this.undo();
    }
    
    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
      e.preventDefault();
      this.redo();
    }
  }

  // Helper method to select the word under cursor
  selectWordUnderCursor(e) {
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range) return;
    
    // Expand the range to select the word
    const startNode = range.startContainer;
    const startOffset = range.startOffset;
    
    // Only proceed if we're in a text node
    if (startNode.nodeType === Node.TEXT_NODE) {
      const text = startNode.textContent;
      
      // Find word boundaries
      let startWordOffset = startOffset;
      let endWordOffset = startOffset;
      
      // Find start of word
      while (startWordOffset > 0 && !/\s/.test(text[startWordOffset - 1])) {
        startWordOffset--;
      }
      
      // Find end of word
      while (endWordOffset < text.length && !/\s/.test(text[endWordOffset])) {
        endWordOffset++;
      }
      
      // Create a new range for the word
      const wordRange = document.createRange();
      wordRange.setStart(startNode, startWordOffset);
      wordRange.setEnd(startNode, endWordOffset);
      
      // Select the word
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(wordRange);
      
      // Save the selection
      this.selection = {
        startContainer: wordRange.startContainer,
        startOffset: wordRange.startOffset,
        endContainer: wordRange.endContainer,
        endOffset: wordRange.endOffset
      };
    }
  }
}

// Export the class
export default FormatToolbar; 