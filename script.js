/* script.js - AR Chess Application Logic */

const app = {
  screens: [
    'splash', 'login', 'home', 'modes', 'standard-game', 
    'ai-game', 'ar-mode', 'profile', 'puzzles', 'learn', 'settings'
  ],
  currentScreen: 'splash',
  takenUsernames: ['playerone', 'grandmasterx', 'anand_a', 'chessmaster99', 'guest'],
  takenIds: [],
  currentUser: 'PlayerOne',
  currentId: '',
  avatarIndex: 11,
  
  init() {
    console.log("ARChess Nexus initialized.");
    
    // Setup Particles on Splash
    this.createParticles();
    
    // Render Boards
    this.initChessboards();
    
    // Simulate initial loading flow
    setTimeout(() => {
      this.checkSession();
    }, 2500); // 2.5 seconds splash
  },

  checkSession() {
    const storedUser = localStorage.getItem('archess_user');
    const storedId = localStorage.getItem('archess_id');
    const storedAvatar = localStorage.getItem('archess_avatar');
    const customAvatar = localStorage.getItem('archess_custom_avatar');

    if (storedUser && storedId) {
       this.currentUser = storedUser;
       this.currentId = storedId;
       this.avatarIndex = storedAvatar ? parseInt(storedAvatar) : 11;
       
       this.takenUsernames.push(storedUser.toLowerCase());
       this.takenIds.push(storedId);

       this.updateUserUI();
       
       if (customAvatar) {
           this.selectAvatar(customAvatar, false);
       } else {
           this.selectAvatar(`https://i.pravatar.cc/150?img=${this.avatarIndex}`, false);
       }
       
       this.nav('home');
       this.showToast(`Welcome back, ${this.currentUser} ${this.currentId}!`);
    } else {
       this.nav('login');
    }
  },
  
  nav(screenId) {
    if (!this.screens.includes(screenId)) return;
    
    // Hide current
    const curr = document.getElementById(`screen-${this.currentScreen}`);
    if (curr) curr.classList.remove('active');
    
    // Show next
    this.currentScreen = screenId;
    const next = document.getElementById(`screen-${this.currentScreen}`);
    if (next) next.classList.add('active');
    
    // Specific screen logic triggers
    if (screenId === 'ar-mode') {
      this.startARSimulation();
    }
  },
  
  createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.style.position = 'absolute';
        p.style.width = Math.random() * 4 + 1 + 'px';
        p.style.height = p.style.width;
        p.style.background = '#00BFFF';
        p.style.borderRadius = '50%';
        p.style.opacity = Math.random() * 0.5 + 0.2;
        p.style.left = Math.random() * 100 + 'vw';
        p.style.top = Math.random() * 100 + 'vh';
        p.style.boxShadow = '0 0 10px #00BFFF';
        container.appendChild(p);
    }
  },

  promptUsername() {
    const mainCard = document.getElementById('login-main-card');
    const promptCard = document.getElementById('username-prompt-card');
    if (mainCard && promptCard) {
      mainCard.classList.add('hidden');
      promptCard.classList.remove('hidden');
    }
  },
  
  cancelUsernamePrompt() {
    const mainCard = document.getElementById('login-main-card');
    const promptCard = document.getElementById('username-prompt-card');
    if (mainCard && promptCard) {
      promptCard.classList.add('hidden');
      mainCard.classList.remove('hidden');
      document.getElementById('username-input').value = '';
    }
  },

  generateUniqueId() {
    let id;
    do {
      // Generate 6-char random alphanumeric ID
      id = '#' + Math.random().toString(36).substr(2, 6).toUpperCase();
    } while (this.takenIds.includes(id));
    this.takenIds.push(id);
    return id;
  },

  submitUsername() {
    const inputEl = document.getElementById('username-input');
    if (!inputEl) return;
    const input = inputEl.value.trim();
    if (input.length < 3) {
      this.showToast('Username must be at least 3 characters');
      return;
    }
    const lowerInput = input.toLowerCase();
    if (this.takenUsernames.includes(lowerInput)) {
      this.showToast('Username already taken! Choose another.');
      return;
    }
    
    // Register User
    this.takenUsernames.push(lowerInput);
    this.currentUser = input;
    this.currentId = this.generateUniqueId();
    
    // Save to LocalStorage
    localStorage.setItem('archess_user', this.currentUser);
    localStorage.setItem('archess_id', this.currentId);
    
    // Update UI elements across all screens
    this.updateUserUI();

    // Proceed
    this.cancelUsernamePrompt();
    this.nav('home');
    this.showToast(`Welcome to the Nexus, ${this.currentUser} ${this.currentId}!`);
  },

  updateUserUI() {
    const nameEls = document.querySelectorAll('.user-info h3, .player-info.self .name, .profile-header h3');
    nameEls.forEach(el => el.innerText = this.currentUser);

    const idEls = document.querySelectorAll('.player-id');
    idEls.forEach(el => el.innerText = this.currentId);

    const tagEls = document.querySelectorAll('.profile-header .tag');
    tagEls.forEach(el => el.innerText = `@${this.currentUser.toLowerCase()}`);
  },

  logout() {
    localStorage.removeItem('archess_user');
    localStorage.removeItem('archess_id');
    localStorage.removeItem('archess_avatar');
    localStorage.removeItem('archess_custom_avatar');
    
    this.takenUsernames = this.takenUsernames.filter(u => u !== this.currentUser.toLowerCase());
    this.takenIds = this.takenIds.filter(i => i !== this.currentId);
    
    this.currentUser = 'PlayerOne';
    this.currentId = '';
    this.avatarIndex = 11;
    
    this.updateUserUI();
    this.selectAvatar(`https://i.pravatar.cc/150?img=11`, false);
    
    this.nav('login');
    this.showToast('Successfully logged out.');
  },

  openAvatarModal() {
    const modal = document.getElementById('avatar-modal');
    if(modal) modal.classList.remove('hidden');
  },
  
  closeAvatarModal() {
    const modal = document.getElementById('avatar-modal');
    if(modal) modal.classList.add('hidden');
  },

  selectAvatar(src, showToast = true) {
    const avatarImgs = document.querySelectorAll('.avatar img, .player-info.self img, .profile-avatar');
    avatarImgs.forEach(img => {
      img.src = src;
      // Provide a consistent background to prevent weird glitches with transparent pngs
      img.style.objectFit = 'cover';
    });
    
    // Attempt to extract index from pravatar src to save it
    if (src.includes('img=')) {
       const idx = src.split('img=')[1];
       this.avatarIndex = parseInt(idx);
       localStorage.setItem('archess_avatar', this.avatarIndex);
       localStorage.removeItem('archess_custom_avatar');
    } else {
       // It's a data URL from device upload
       localStorage.setItem('archess_custom_avatar', src);
    }

    this.closeAvatarModal();
    if(showToast) this.showToast('Profile image updated!');
  },

  handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.selectAvatar(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  },

  // ---- Toast Notifications ----
  toastTimeout: null,
  showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.position = 'absolute';
      toast.style.bottom = '100px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = 'rgba(0,0,0,0.85)';
      toast.style.color = 'var(--primary-blue)';
      toast.style.padding = '12px 24px';
      toast.style.borderRadius = '30px';
      toast.style.border = '1px solid var(--primary-blue)';
      toast.style.zIndex = '1000';
      toast.style.transition = 'opacity 0.3s';
      toast.style.pointerEvents = 'none';
      toast.style.boxShadow = '0 0 15px rgba(0, 191, 255, 0.4)';
      toast.style.fontWeight = 'bold';
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
    }, 2000);
  },

  // ---- Chessboard Rendering Logic ----
  
  initialBoard: [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  ],
  
  puzzleBoard: [
    ['', '', '', 'r', '', '', 'k', ''],
    ['p', 'p', '', '', '', 'p', 'b', 'p'],
    ['', '', 'p', '', 'p', '', 'p', ''],
    ['', '', '', 'p', '', '', '', ''],
    ['', '', '', 'P', '', '', '', ''],
    ['', '', 'N', '', '', 'Q', '', ''],
    ['P', 'P', 'P', '', '', 'P', 'P', 'P'],
    ['R', '', 'B', '', '', 'R', 'K', '']
  ],

  pieceMap: {
    'p': 'black/pawn.png', 'r': 'black/rook.png', 'n': 'black/knight.png', 
    'b': 'black/bishop.png', 'q': 'black/queen.png', 'k': 'black/king.png',
    'P': 'white/pawn.png', 'R': 'white/rook.png', 'N': 'white/knight.png', 
    'B': 'white/bishop.png', 'Q': 'white/queen.png', 'K': 'white/king.png'
  },

  initChessboards() {
     this.renderBoard('standard-chessboard', this.initialBoard);
     this.renderBoard('ai-chessboard', JSON.parse(JSON.stringify(this.initialBoard))); // copy to prevent references
     this.renderBoard('puzzle-chessboard', this.puzzleBoard);
     this.renderIsometricBoard('isometric-chessboard', JSON.parse(JSON.stringify(this.initialBoard)));
  },

  selectedSquare: null,

  isPathClear(prevR, prevC, r, c, matrix) {
    const rDir = Math.sign(r - prevR);
    const cDir = Math.sign(c - prevC);
    let currR = prevR + rDir;
    let currC = prevC + cDir;
    while (currR !== r || currC !== c) {
      if (matrix[currR][currC] !== '') return false;
      currR += rDir;
      currC += cDir;
    }
    return true;
  },

  isValidMove(piece, prevR, prevC, r, c, matrix) {
    const isWhite = piece === piece.toUpperCase();
    const target = matrix[r][c];
    
    // Cannot capture own piece
    if (target !== '') {
        const targetIsWhite = target === target.toUpperCase();
        if (isWhite === targetIsWhite) return false;
    }

    const dr = r - prevR;
    const dc = c - prevC;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);
    const pieceLower = piece.toLowerCase();

    if (pieceLower === 'p') {
       const dir = isWhite ? -1 : 1;
       const startRow = isWhite ? 6 : 1;
       if (dc === 0) {
           if (dr === dir && target === '') return true;
           if (dr === 2 * dir && prevR === startRow && target === '' && matrix[prevR + dir][prevC] === '') return true;
       } else if (absDc === 1 && dr === dir && target !== '') {
           return true; 
       }
       return false;
    }
    if (pieceLower === 'r') {
       if (dr !== 0 && dc !== 0) return false;
       return this.isPathClear(prevR, prevC, r, c, matrix);
    }
    if (pieceLower === 'n') {
       return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
    }
    if (pieceLower === 'b') {
       if (absDr !== absDc) return false;
       return this.isPathClear(prevR, prevC, r, c, matrix);
    }
    if (pieceLower === 'q') {
       if (dr !== 0 && dc !== 0 && absDr !== absDc) return false;
       return this.isPathClear(prevR, prevC, r, c, matrix);
    }
    if (pieceLower === 'k') {
       return absDr <= 1 && absDc <= 1;
    }
    return false;
  },

  handleSquareClick(sq, r, c, containerId, matrix) {
      if (this.selectedSquare && this.selectedSquare.containerId === containerId) {
          if (sq !== this.selectedSquare.sq) {
               const prevR = this.selectedSquare.r;
               const prevC = this.selectedSquare.c;
               const piece = matrix[prevR][prevC];
               
               if (this.isValidMove(piece, prevR, prevC, r, c, matrix)) {
                   // Move logic
                   matrix[r][c] = piece;
                   matrix[prevR][prevC] = '';
                   
                   this.selectedSquare = null;
                   
                   // Re-render
                   if (containerId === 'isometric-chessboard') {
                       this.renderIsometricBoard(containerId, matrix);
                   } else {
                       this.renderBoard(containerId, matrix);
                   }
                   this.showToast('Piece Moved');
               } else {
                   this.showToast('Invalid Move!');
                   sq.classList.remove('highlight');
                   this.selectedSquare.sq.classList.remove('highlight');
                   this.selectedSquare = null;
               }
          } else {
               // Deselect
               sq.classList.remove('highlight');
               this.selectedSquare = null;
          }
      } else {
          // Select logic
          if (matrix[r][c] !== '') {
              // Clear previous visual highlights on this board
              const allSquares = document.querySelectorAll(`#${containerId} .square`);
              allSquares.forEach(s => s.classList.remove('highlight'));
          
              sq.classList.add('highlight');
              this.selectedSquare = { sq, r, c, containerId, matrix };
          }
      }
  },

  renderBoard(containerId, matrix) {
     const container = document.getElementById(containerId);
     if (!container) return;
     container.innerHTML = '';
     
     let isLight = true;
     for (let r = 0; r < 8; r++) {
       for (let c = 0; c < 8; c++) {
         const sq = document.createElement('div');
         sq.className = `square ${isLight ? 'light' : 'dark'}`;
         
         const pieceChar = matrix[r][c];
         if (pieceChar !== '') {
            const img = document.createElement('img');
            img.src = this.pieceMap[pieceChar];
            img.className = 'piece';
            if (pieceChar === pieceChar.toUpperCase()) {
                img.classList.add('glow-white');
            } else {
                img.classList.add('glow-black');
            }
            sq.appendChild(img);
         }
         
         sq.onclick = () => this.handleSquareClick(sq, r, c, containerId, matrix);

         container.appendChild(sq);
         isLight = !isLight;
       }
       isLight = !isLight; // offset next row
     }
  },

  renderIsometricBoard(containerId, matrix) {
     const container = document.getElementById(containerId);
     if (!container) return;
     container.innerHTML = '';
     
     let isLight = true;
     for (let r = 0; r < 8; r++) {
       for (let c = 0; c < 8; c++) {
         const sq = document.createElement('div');
         sq.className = `square ${isLight ? 'light' : 'dark'}`;
         
         const pieceChar = matrix[r][c];
         if (pieceChar !== '') {
            const img = document.createElement('img');
            img.src = this.pieceMap[pieceChar];
            img.className = 'piece iso-piece';
            sq.appendChild(img);
         }
         
         sq.onclick = () => this.handleSquareClick(sq, r, c, containerId, matrix);
         
         container.appendChild(sq);
         isLight = !isLight;
       }
       isLight = !isLight;
     }
  },

  // ---- AR Mode Logic Simulation ----
  
  scanSurface() {
    this.showToast('Scanning...');
    setTimeout(() => {
      const reticle = document.querySelector('.scanning-reticle .scan-text');
      if(reticle) {
        reticle.innerText = "Surface Detected!";
        reticle.style.color = "var(--accent-green)";
      }
      const btnPlace = document.getElementById('btn-place-board');
      if (btnPlace) btnPlace.disabled = false;
      this.showToast('Surface Detected! Ready to place.');
    }, 1000);
  },
  
  placeARBoard() {
    document.querySelector('.scanning-reticle').classList.add('hidden');
    document.getElementById('ar-3d-board').classList.remove('hidden');
    document.getElementById('btn-place-board').disabled = true;
    this.showToast('Board Placed in AR!');
  },
  
  resetAR() {
    document.querySelector('.scanning-reticle').classList.remove('hidden');
    const reticleText = document.querySelector('.scanning-reticle .scan-text');
    if(reticleText) {
      reticleText.innerText = "Looking for flat surface...";
      reticleText.style.color = "white";
    }
    document.getElementById('ar-3d-board').classList.add('hidden');
    document.getElementById('btn-place-board').disabled = true;
    document.getElementById('ar-analysis-popup').classList.add('hidden');
    this.showToast('AR Calibration Reset');
  },

  toggleARAnalysis() {
    const popup = document.getElementById('ar-analysis-popup');
    if (popup) {
        popup.classList.toggle('hidden');
        if(!popup.classList.contains('hidden')) {
            this.showToast('Analysis Overlay Active');
        } else {
            this.showToast('Analysis Overlay Hidden');
        }
    }
  },

  startARSimulation() {
    this.resetAR();
    this.showToast('Point camera at a flat surface');
  }
};

// Start App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
  
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.body.classList.remove('light-mode');
        app.showToast('Dark Mode Enabled');
      } else {
        document.body.classList.add('light-mode');
        app.showToast('Light Mode Enabled');
      }
    });
  }

  // Initialize default theme (neon-cyber)
  document.body.setAttribute('data-board-theme', 'neon-cyber');

  const themeSelect = document.getElementById('board-theme-select');
  if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
          const newTheme = e.target.value;
          document.body.setAttribute('data-board-theme', newTheme);
          app.showToast(`Theme changed to ${e.target.options[e.target.selectedIndex].text}`);
      });
  }
});
