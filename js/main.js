/**
 * Main Application Logic & Interactivity
 * Shubham Keshri Portfolio - Crimson Obsidian Theme
 */

document.addEventListener('DOMContentLoaded', () => {
  renderStats();
  initGitHubSync();
  initScrollSpy();
  initCopyEmail();
  initCard3DTilt();
  initMouseSpotlight();
  initTerminal();
});

/* --------------------------------------------------------------------------
   1. Render Quantitative Stats
   -------------------------------------------------------------------------- */
function renderStats() {
  const container = document.getElementById('hero-metrics-container');
  if (!container || !PORTFOLIO_DATA.stats) return;

  container.innerHTML = PORTFOLIO_DATA.stats.map(stat => `
    <div class="metric-card">
      <div class="metric-val">${stat.value}</div>
      <div class="metric-label">${stat.label}</div>
    </div>
  `).join('');
}

/* --------------------------------------------------------------------------
   2. Initialize Live GitHub Repo Syncing
   -------------------------------------------------------------------------- */
function initGitHubSync() {
  if (typeof GitHubRepoSync !== 'undefined') {
    window.gitHubSync = new GitHubRepoSync('Shubhamkeshri433', 'projects-grid-container');
    window.gitHubSync.init();
  }
}

/* --------------------------------------------------------------------------
   3. Scroll Spy for Active Navbar Link
   -------------------------------------------------------------------------- */
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-menu-link');

  window.addEventListener('scroll', () => {
    let current = '';
    const scrollPos = window.scrollY + 200;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
}

/* --------------------------------------------------------------------------
   4. One-Click Copy Email
   -------------------------------------------------------------------------- */
function initCopyEmail() {
  const copyBtn = document.getElementById('copy-email-btn');
  const emailText = document.getElementById('contact-email');
  const toast = document.getElementById('copy-toast');

  if (!copyBtn || !emailText) return;

  copyBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = 'shubhamkeshri.433@gmail.com';
    try {
      await navigator.clipboard.writeText(email);
      showToast();
    } catch (err) {
      const input = document.createElement('input');
      input.value = email;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast();
    }
  });

  function showToast() {
    if (!toast) return;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
}

/* --------------------------------------------------------------------------
   5. Interactive Mouse Light Spotlight Effect on Section Blocks
   -------------------------------------------------------------------------- */
function initMouseSpotlight() {
  const selector = '.spotlight-card, .project-card, .block-card, .skills-table-container, .contact-info-card, .quote-block-card, .terminal-window, .skill-table-pill';
  
  const updateSpotlight = (card, e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

  document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll(selector);
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      // Check if mouse is nearby/over card
      if (
        e.clientX >= rect.left - 50 &&
        e.clientX <= rect.right + 50 &&
        e.clientY >= rect.top - 50 &&
        e.clientY <= rect.bottom + 50
      ) {
        updateSpotlight(card, e);
      }
    });
  });
}

/* --------------------------------------------------------------------------
   6. 3D Tilt Physics for Cards
   -------------------------------------------------------------------------- */
function initCard3DTilt() {
  const cards = document.querySelectorAll('.tilt-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -4;
      const rotateY = ((x - centerX) / centerX) * 4;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  });
}

/* --------------------------------------------------------------------------
   7. Terminal CLI Initialization
   -------------------------------------------------------------------------- */
function initTerminal() {
  if (typeof TerminalCLI !== 'undefined') {
    window.terminalInstance = new TerminalCLI('terminal-container', 'term-input', 'term-output');
  }
}
