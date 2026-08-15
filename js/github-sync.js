/**
 * Live GitHub Repository Sync Service & Interactive Showcase
 * Fetches repos in real-time from GitHub API for Shubhamkeshri433
 * Supports Card Grid & Expandable Accordion Deep-Dive views
 */

class GitHubRepoSync {
  constructor(username, containerId) {
    this.username = username || 'Shubhamkeshri433';
    this.container = document.getElementById(containerId);
    this.apiUrl = `https://api.github.com/users/${this.username}/repos?sort=updated&per_page=100`;
    this.repos = [];
    this.currentFilter = 'all';
    this.viewMode = 'grid'; // 'grid' or 'accordion'
    this.expandedCards = new Set(); // Track expanded project drawers
    this.ignoreRepos = ['Shubhamkeshri433', 'Shubhamkeshri433.github.io'];

    this.repoMetadata = {
      'AI-Resume-Ranker': {
        badge: 'AI & NLP SYSTEM',
        category: 'ai',
        extraTech: ['Python', 'Streamlit', 'NLP', 'Semantic Vector Search'],
        customDesc: 'AI-powered candidate screening and resume ranking application using NLP and semantic vector similarity scoring.',
        highlights: [
          'NLP engine extracting candidate skill embeddings and experience metrics',
          'Cosine semantic similarity matrix ranking candidates against job requirements',
          'Interactive Streamlit UI with real-time score breakdowns and match percentages'
        ],
        terminalCmd: 'rank-resume'
      },
      'Customer-Shopping-Behavior-Analysis': {
        badge: 'BI & ANALYTICS',
        category: 'analytics',
        extraTech: ['Power BI', 'SQL', 'Pandas', 'Customer Segmentation'],
        customDesc: 'Retail customer analysis pipeline with multi-tiered RFM segmentation and interactive Power BI executive dashboards.',
        highlights: [
          'Multi-tiered RFM (Recency, Frequency, Monetary) segmentation model',
          'Python & Pandas cleaning pipeline for customer spend anomaly resolution',
          'Power BI dashboard with dynamic KPI drill-downs and cohort insights'
        ],
        terminalCmd: 'sql'
      },
      'Dirty-Cafe-Data-Set': {
        badge: 'ETL & DATA CLEANSING',
        category: 'etl',
        extraTech: ['Python', 'Pandas', 'NumPy', 'Data Cleaning'],
        customDesc: 'Automated data cleaning and transformation pipeline converting messy cafe sales logs into structured analytics tables.',
        highlights: [
          'Automated regex anomaly detection for inconsistent date and currency formats',
          'Outlier resolution and missing data imputation using NumPy and Pandas',
          'Standardized analytics-ready relational tables optimized for SQL ingestion'
        ],
        terminalCmd: 'skills'
      },
      'Maven-Fuzzy-Factory-data-analysis-project': {
        badge: 'E-COMMERCE ANALYTICS',
        category: 'analytics',
        extraTech: ['SQL', 'Data Analytics', 'Conversion Funnels', 'KPI Metrics'],
        customDesc: 'E-commerce analytics project evaluating website traffic, channel conversion funnels, and revenue optimization.',
        highlights: [
          'Channel attribution model evaluating paid marketing campaigns and ROI',
          'Conversion funnel analysis tracking drop-offs across user purchase sessions',
          'Advanced SQL window functions and aggregation for executive KPI reporting'
        ],
        terminalCmd: 'sql'
      },
      'SSMS-SQL-Employee_Sample_Data_Base-Questions-Answers': {
        badge: 'SQL ARCHITECTURE',
        category: 'sql',
        extraTech: ['MSSQL', 'T-SQL', 'CTEs', 'Window Functions', 'Stored Procedures'],
        customDesc: 'Advanced T-SQL query architecture solving complex enterprise scenarios, ranking functions, and salary analytics.',
        highlights: [
          'Multi-level Common Table Expressions (CTEs) and recursive hierarchy queries',
          'Window ranking functions (ROW_NUMBER, DENSE_RANK, NTILE) for salary percentiles',
          'Optimized stored procedures with execution plan indexing and subquery tuning'
        ],
        terminalCmd: 'sql'
      },
      'To-Do-in-Excel': {
        badge: 'EXCEL & PRODUCTIVITY',
        category: 'analytics',
        extraTech: ['Excel', 'Lookup Formulas', 'VBA/Macros', 'Dashboard'],
        customDesc: 'Interactive productivity and task management dashboard built in Excel with conditional formatting and tracking.',
        highlights: [
          'Dynamic prioritization matrix with automated conditional formatting heatmaps',
          'Nested LOOKUP, INDEX/MATCH, and custom date calculation formulas',
          'Executive task completion and timeline velocity tracking charts'
        ],
        terminalCmd: 'stats'
      }
    };
  }

  async init() {
    this.setupFilterEvents();
    this.setupDropdownFilterEvent();
    this.setupViewModeEvents();
    this.setupRefreshEvent();
    await this.fetchAndRenderRepos();
  }

  async fetchAndRenderRepos(forceRefresh = false) {
    this.showLoadingState();

    try {
      const cacheKey = `gh_repos_${this.username}`;
      const cached = sessionStorage.getItem(cacheKey);

      if (cached && !forceRefresh) {
        this.repos = JSON.parse(cached);
        this.render();
        this.updateSyncStatus(new Date().toLocaleTimeString(), true);
        this.updateHeroStats();
        return;
      }

      const response = await fetch(this.apiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }

      const rawRepos = await response.json();

      this.repos = rawRepos
        .filter(r => !r.fork && !this.ignoreRepos.includes(r.name))
        .map(r => this.transformRepoData(r));

      sessionStorage.setItem(cacheKey, JSON.stringify(this.repos));

      this.render();
      this.updateSyncStatus(new Date().toLocaleTimeString(), false);
      this.updateHeroStats();
    } catch (err) {
      console.warn('Live GitHub fetch error, falling back to local dataset:', err);
      this.fallbackToLocalData();
    }
  }

  updateHeroStats() {
    if (!this.repos || this.repos.length === 0) return;

    const totalRepos = this.repos.length;
    const aiCount = this.repos.filter(r => r.category === 'ai' || (r.tech && r.tech.some(t => /ai|nlp|ml|model|langchain|streamlit|vector/i.test(t)))).length;
    const analyticsCount = this.repos.filter(r => r.category === 'analytics' || r.category === 'sql' || r.category === 'etl').length;

    const reposEl = document.getElementById('hero-stat-repos');
    const aiEl = document.getElementById('hero-stat-ai');
    const analyticsEl = document.getElementById('hero-stat-analytics');
    const cgpaEl = document.getElementById('hero-stat-cgpa');

    if (reposEl) this.animateCounter(reposEl, totalRepos > 0 ? `${totalRepos}+` : '6+');
    if (aiEl) this.animateCounter(aiEl, aiCount > 0 ? `${aiCount}+` : '2+');
    if (analyticsEl) this.animateCounter(analyticsEl, analyticsCount > 0 ? `${analyticsCount}+` : '4+');
    if (cgpaEl) {
      const cgpaVal = (typeof PORTFOLIO_DATA !== 'undefined' && PORTFOLIO_DATA.profile && PORTFOLIO_DATA.profile.cgpa) ? PORTFOLIO_DATA.profile.cgpa : '7.35';
      cgpaEl.textContent = cgpaVal;
    }

    if (typeof PORTFOLIO_DATA !== 'undefined' && PORTFOLIO_DATA.stats) {
      const statRepo = PORTFOLIO_DATA.stats.find(s => s.id === 'stat-repos');
      if (statRepo) statRepo.value = `${totalRepos}+`;
    }
  }

  animateCounter(element, targetVal) {
    if (!element) return;
    element.classList.add('stat-number-pulse');
    element.textContent = targetVal;
    setTimeout(() => {
      element.classList.remove('stat-number-pulse');
    }, 600);
  }

  transformRepoData(repo) {
    const override = this.repoMetadata[repo.name] || {};

    let formattedTitle = repo.name
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    let category = override.category || this.inferCategory(repo);
    let techStack = override.extraTech || [];
    if (repo.language && !techStack.includes(repo.language)) {
      techStack.unshift(repo.language);
    }
    if (repo.topics && Array.isArray(repo.topics)) {
      repo.topics.forEach(t => {
        const cleanTopic = t.charAt(0).toUpperCase() + t.slice(1);
        if (!techStack.includes(cleanTopic) && techStack.length < 4) {
          techStack.push(cleanTopic);
        }
      });
    }

    return {
      id: repo.name,
      title: formattedTitle,
      rawName: repo.name,
      badge: override.badge || (repo.language ? `${repo.language.toUpperCase()} PROJECT` : 'DATA PROJECT'),
      shortDesc: override.customDesc || repo.description || 'Public open-source repository by Shubham Keshri.',
      highlights: override.highlights || [
        'Structured modular codebase with version control',
        'Clean data pipeline and analytical querying design',
        'Open-source documentation and reproducibility'
      ],
      terminalCmd: override.terminalCmd || 'projects',
      tech: techStack.length > 0 ? techStack : ['Python', 'Data Analysis'],
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      githubUrl: repo.html_url,
      homepage: repo.homepage,
      updatedAt: new Date(repo.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      category: category
    };
  }

  inferCategory(repo) {
    const text = `${repo.name} ${repo.description || ''}`.toLowerCase();
    if (text.includes('ai') || text.includes('nlp') || text.includes('resume') || text.includes('gpt') || text.includes('model')) return 'ai';
    if (text.includes('sql') || text.includes('ssms') || text.includes('database') || text.includes('query')) return 'sql';
    if (text.includes('clean') || text.includes('etl') || text.includes('dirty') || text.includes('wrangling')) return 'etl';
    if (text.includes('analysis') || text.includes('power bi') || text.includes('excel') || text.includes('behavior') || text.includes('dashboard')) return 'analytics';
    return 'other';
  }

  fallbackToLocalData() {
    if (typeof PORTFOLIO_DATA !== 'undefined' && PORTFOLIO_DATA.projects) {
      this.repos = PORTFOLIO_DATA.projects.map(p => {
        const meta = this.repoMetadata[p.id] || {};
        return {
          id: p.id,
          title: p.title,
          badge: p.badge.toUpperCase(),
          shortDesc: p.shortDesc || p.fullDesc,
          highlights: meta.highlights || ['Verified open-source pipeline architecture'],
          terminalCmd: meta.terminalCmd || 'projects',
          tech: p.tech,
          stars: 1,
          forks: 0,
          githubUrl: p.githubUrl,
          updatedAt: 'Recently',
          category: meta.category || 'analytics'
        };
      });
      this.render();
      this.updateSyncStatus('Local Cache Active', false);
      this.updateHeroStats();
    }
  }

  render() {
    if (!this.container) return;

    // Update container classes according to view mode
    this.container.className = `projects-container view-${this.viewMode}`;

    let filtered = this.repos;
    if (this.currentFilter !== 'all') {
      filtered = this.repos.filter(r => r.category === this.currentFilter);
    }

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div class="project-empty-state">
          <p>No repositories found under this category filter.</p>
        </div>
      `;
      return;
    }

    if (this.viewMode === 'accordion') {
      this.renderAccordionView(filtered);
    } else {
      this.renderGridView(filtered);
    }

    this.setupDrawerAccordionEvents();

    if (this.viewMode === 'grid' && typeof initCard3DTilt === 'function') {
      initCard3DTilt();
    }
  }

  renderGridView(filtered) {
    this.container.innerHTML = filtered.map((proj, idx) => {
      const padIndex = (idx + 1).toString().padStart(2, '0');
      const isExpanded = this.expandedCards.has(proj.id);

      return `
        <div class="project-card tilt-card spotlight-card ${isExpanded ? 'is-expanded' : ''}" id="repo-${proj.id}">
          <div class="project-card-main-content">
            <!-- Top Number & Links -->
            <div class="project-number-row">
              <div class="project-index-num">${padIndex}</div>
              <div class="project-top-links">
                <a href="${proj.githubUrl}" target="_blank" rel="noopener noreferrer" class="project-link-icon" title="View Source on GitHub" aria-label="GitHub Repository">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </a>
                <a href="${proj.githubUrl}" target="_blank" rel="noopener noreferrer" class="project-link-icon" title="Open Project URL" aria-label="Open Project">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
              </div>
            </div>

            <h3 class="project-title">${proj.title}</h3>
            <div class="project-category-sub">
              <span class="category-sub-dot"></span>
              <span>${proj.badge}</span>
            </div>
            <p class="project-desc">${proj.shortDesc}</p>

            <!-- Interactive Architecture Dropdown Trigger Button -->
            <button class="project-expand-toggle-btn" type="button" data-repo-id="${proj.id}" aria-expanded="${isExpanded}">
              <span>${isExpanded ? 'Hide Architecture' : 'Architecture & Deep Dive'}</span>
              <svg class="chevron-icon ${isExpanded ? 'rotated' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <!-- Expandable Dropdown Drawer -->
            <div class="project-drawer-panel ${isExpanded ? 'open' : ''}">
              <div class="project-drawer-inner">
                <div class="drawer-section-title">ENGINEERING HIGHLIGHTS</div>
                <ul class="drawer-highlights-list">
                  ${proj.highlights.map(h => `<li><span class="highlight-bullet">&#10022;</span><span>${h}</span></li>`).join('')}
                </ul>

                <div class="drawer-actions-row">
                  <a href="${proj.githubUrl}" target="_blank" rel="noopener noreferrer" class="drawer-action-btn btn-view-repo">
                    <span>View Repository</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                  ${proj.terminalCmd ? `
                    <button type="button" class="drawer-action-btn btn-run-term" onclick="window.gitHubSync.triggerTerminalDemo('${proj.terminalCmd}')" title="Run interactive simulation in terminal">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                      <span>Simulate</span>
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Meta Strip & Stack -->
          <div class="project-card-footer">
            <div class="project-meta-strip">
              <span class="project-meta-item" title="GitHub Stars">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                ${proj.stars}
              </span>
              <span class="project-meta-item" title="Forks">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v3"/></svg>
                ${proj.forks}
              </span>
              <span class="project-updated-label">${proj.updatedAt}</span>
            </div>

            <div class="project-stack">
              ${proj.tech.map(t => `<span class="tech-tag">${t}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderAccordionView(filtered) {
    this.container.innerHTML = `
      <div class="accordion-list-wrapper">
        ${filtered.map((proj, idx) => {
      const padIndex = (idx + 1).toString().padStart(2, '0');
      const isExpanded = this.expandedCards.has(proj.id);

      return `
            <div class="accordion-item spotlight-card ${isExpanded ? 'is-expanded' : ''}" id="repo-acc-${proj.id}">
              <!-- Accordion Clickable Header -->
              <div class="accordion-header-row" data-repo-id="${proj.id}">
                <div class="acc-col-index">${padIndex}</div>
                <div class="acc-col-title-wrap">
                  <h3 class="acc-title">${proj.title}</h3>
                  <div class="acc-badge">${proj.badge}</div>
                </div>
                <div class="acc-col-stack">
                  ${proj.tech.slice(0, 3).map(t => `<span class="tech-tag">${t}</span>`).join('')}
                </div>
                <div class="acc-col-meta">
                  <span class="project-meta-item" title="GitHub Stars">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                    ${proj.stars}
                  </span>
                  <span class="project-updated-label">${proj.updatedAt}</span>
                </div>
                <div class="acc-col-toggle">
                  <button class="acc-toggle-icon-btn" type="button" aria-label="Toggle Project Details">
                    <svg class="chevron-icon ${isExpanded ? 'rotated' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Accordion Expandable Body Drawer -->
              <div class="accordion-body-drawer ${isExpanded ? 'open' : ''}">
                <div class="accordion-body-grid">
                  <div class="acc-body-left">
                    <p class="acc-full-desc">${proj.shortDesc}</p>
                    <div class="acc-full-stack">
                      ${proj.tech.map(t => `<span class="tech-tag">${t}</span>`).join('')}
                    </div>
                  </div>
                  <div class="acc-body-right">
                    <div class="drawer-section-title">KEY DELIVERABLES & ARCHITECTURE</div>
                    <ul class="drawer-highlights-list">
                      ${proj.highlights.map(h => `<li><span class="highlight-bullet">&#10022;</span><span>${h}</span></li>`).join('')}
                    </ul>
                    <div class="acc-actions-row">
                      <a href="${proj.githubUrl}" target="_blank" rel="noopener noreferrer" class="btn-crimson-sm">
                        <span>View Repository</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </a>
                      ${proj.terminalCmd ? `
                        <button type="button" class="btn-outline-sm" onclick="window.gitHubSync.triggerTerminalDemo('${proj.terminalCmd}')">
                          <span>Simulate in CLI</span>
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  setupDrawerAccordionEvents() {
    // 1. Grid view button toggles
    const gridToggles = this.container.querySelectorAll('.project-expand-toggle-btn');
    gridToggles.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const repoId = btn.dataset.repoId;
        if (this.expandedCards.has(repoId)) {
          this.expandedCards.delete(repoId);
        } else {
          this.expandedCards.add(repoId);
        }
        this.render();
      });
    });

    // 2. Accordion view header toggles
    const accHeaders = this.container.querySelectorAll('.accordion-header-row');
    accHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const repoId = header.dataset.repoId;
        if (this.expandedCards.has(repoId)) {
          this.expandedCards.delete(repoId);
        } else {
          this.expandedCards.add(repoId);
        }
        this.render();
      });
    });
  }

  setupViewModeEvents() {
    const gridBtn = document.getElementById('view-mode-grid');
    const accordionBtn = document.getElementById('view-mode-accordion');

    if (gridBtn && accordionBtn) {
      gridBtn.addEventListener('click', () => {
        this.viewMode = 'grid';
        gridBtn.classList.add('active');
        accordionBtn.classList.remove('active');
        this.render();
      });

      accordionBtn.addEventListener('click', () => {
        this.viewMode = 'accordion';
        accordionBtn.classList.add('active');
        gridBtn.classList.remove('active');
        this.render();
      });
    }
  }

  setupDropdownFilterEvent() {
    const select = document.getElementById('project-category-select');
    if (select) {
      select.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;

        // Sync filter button states
        const filterBtns = document.querySelectorAll('.project-filter-btn');
        filterBtns.forEach(btn => {
          if (btn.dataset.filter === this.currentFilter) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });

        this.render();
      });
    }
  }

  setupFilterEvents() {
    const filterBtns = document.querySelectorAll('.project-filter-btn');
    const select = document.getElementById('project-category-select');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || 'all';

        // Sync dropdown
        if (select) {
          select.value = this.currentFilter;
        }

        this.render();
      });
    });
  }

  setupRefreshEvent() {
    const refreshBtn = document.getElementById('github-sync-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        await this.fetchAndRenderRepos(true);
        setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
      });
    }
  }

  showLoadingState() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        <p>Syncing live repositories from GitHub API...</p>
      </div>
    `;
  }

  updateSyncStatus(timeStr, isCached) {
    const statusEl = document.getElementById('github-sync-timestamp');
    if (statusEl) {
      statusEl.innerHTML = `<span>● Live Sync Active</span> • ${this.repos.length} Repos • ${isCached ? 'Cached' : 'Synced at'} ${timeStr}`;
    }
  }

  triggerTerminalDemo(cmd) {
    const termSection = document.getElementById('terminal');
    if (termSection) {
      termSection.scrollIntoView({ behavior: 'smooth' });
    }
    if (window.terminalInstance && typeof window.terminalInstance.executeCommand === 'function') {
      setTimeout(() => {
        window.terminalInstance.executeCommand(cmd);
      }, 500);
    }
  }
}

window.GitHubRepoSync = GitHubRepoSync;

