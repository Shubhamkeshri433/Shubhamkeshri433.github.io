/**
 * Interactive Terminal CLI Simulator for Shubham Keshri
 */

class TerminalCLI {
  constructor(containerId, inputId, outputId) {
    this.container = document.getElementById(containerId);
    this.input = document.getElementById(inputId);
    this.output = document.getElementById(outputId);
    this.history = [];
    this.historyIndex = -1;

    if (!this.input || !this.output) return;

    this.initEvents();
    this.printWelcomeMessage();
  }

  initEvents() {
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = this.input.value.trim();
        if (cmd) {
          this.history.push(cmd);
          this.historyIndex = this.history.length;
          this.executeCommand(cmd);
          this.input.value = '';
        }
      } else if (e.key === 'ArrowUp') {
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.input.value = this.history[this.historyIndex] || '';
        }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.input.value = this.history[this.historyIndex] || '';
        } else {
          this.historyIndex = this.history.length;
          this.input.value = '';
        }
        e.preventDefault();
      }
    });

    // Keep focus when clicking inside terminal box
    if (this.container) {
      this.container.addEventListener('click', () => {
        this.input.focus();
      });
    }
  }

  printWelcomeMessage() {
    const welcome = `
<div class="term-line term-accent">⚡ Shubham Keshri — Interactive Core Shell v2.6.0</div>
<div class="term-line term-dim">Type <span class="term-hl">help</span> to view available commands, or try <span class="term-hl">rank-resume</span> for the AI demo.</div>
<div class="term-divider"></div>`;
    this.output.innerHTML = welcome;
  }

  printLine(html, type = 'normal') {
    const div = document.createElement('div');
    div.className = `term-line ${type ? 'term-' + type : ''}`;
    div.innerHTML = html;
    this.output.appendChild(div);
    this.scrollToBottom();
  }

  scrollToBottom() {
    if (this.container) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  executeCommand(rawCmd) {
    // Print prompt line
    this.printLine(`<span class="term-prompt">shubham@core:~$</span> <span class="term-cmd">${this.escapeHtml(rawCmd)}</span>`);

    const parts = rawCmd.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        this.cmdHelp();
        break;
      case 'about':
      case 'whoami':
        this.cmdAbout();
        break;
      case 'skills':
        this.cmdSkills(args);
        break;
      case 'projects':
        this.cmdProjects();
        break;
      case 'rank-resume':
      case 'ai-demo':
        this.cmdRankResume();
        break;
      case 'sql':
        this.cmdSql(args.join(' '));
        break;
      case 'contact':
      case 'email':
        this.cmdContact();
        break;
      case 'clear':
      case 'cls':
        this.output.innerHTML = '';
        break;
      case 'stats':
        this.cmdStats();
        break;
      case 'sudo':
        if (args.join(' ').toLowerCase() === 'hire' || args.join(' ').toLowerCase() === 'hire me') {
          this.cmdSudoHire();
        } else {
          this.printLine(`sudo: Access granted! Let's schedule an interview. Type <span class="term-hl">contact</span>.`, 'accent');
        }
        break;
      case 'exit':
        this.printLine(`Closing session... Thanks for exploring Shubham's portfolio!`, 'dim');
        break;
      default:
        this.printLine(`Command not found: <span class="term-error">${this.escapeHtml(command)}</span>. Type <span class="term-hl">help</span> for command list.`, 'error');
    }
  }

  cmdHelp() {
    const helpContent = `
<div class="term-table">
  <div class="term-row"><span class="term-col-cmd">about</span><span>Overview of background, education, and technical focus</span></div>
  <div class="term-row"><span class="term-col-cmd">skills</span><span>List technical capabilities across AI, SQL, and BI</span></div>
  <div class="term-row"><span class="term-col-cmd">projects</span><span>Explore key GitHub repositories and live pipelines</span></div>
  <div class="term-row"><span class="term-col-cmd">rank-resume</span><span>Run live interactive simulation of the AI Resume Ranker</span></div>
  <div class="term-row"><span class="term-col-cmd">sql</span><span>Execute an analytical query demonstration</span></div>
  <div class="term-row"><span class="term-col-cmd">stats</span><span>View quantitative metrics and portfolio statistics</span></div>
  <div class="term-row"><span class="term-col-cmd">contact</span><span>Display direct email and social profiles</span></div>
  <div class="term-row"><span class="term-col-cmd">sudo hire</span><span>Secret command for tech recruiters and hiring teams</span></div>
  <div class="term-row"><span class="term-col-cmd">clear</span><span>Clear the terminal buffer</span></div>
</div>`;
    this.printLine(helpContent);
  }

  cmdAbout() {
    const p = PORTFOLIO_DATA.personal;
    const aboutHtml = `
<div class="term-box">
  <div class="term-line"><strong class="term-hl">${p.name}</strong> — ${p.title}</div>
  <div class="term-line term-dim">📍 ${p.location} | 🎓 ${p.education.degree} (${p.education.institution}, CGPA: ${p.education.cgpa})</div>
  <div class="term-line mt-1">"${p.tagline}"</div>
  <div class="term-line term-accent mt-1">🟢 Status: ${p.status}</div>
</div>`;
    this.printLine(aboutHtml);
  }

  cmdSkills(args) {
    let out = '<div class="term-box">';
    for (const [key, val] of Object.entries(PORTFOLIO_DATA.skills)) {
      out += `<div class="term-line term-accent"><strong>[${val.category}]</strong></div>`;
      out += `<div class="term-line term-dim">${val.items.join(' • ')}</div><div class="term-spacer"></div>`;
    }
    out += '</div>';
    this.printLine(out);
  }

  cmdProjects() {
    let out = '<div class="term-box">';
    PORTFOLIO_DATA.projects.forEach((proj, idx) => {
      out += `
<div class="term-line"><span class="term-hl">${idx + 1}. ${proj.title}</span> <span class="term-badge">[${proj.badge}]</span></div>
<div class="term-line term-dim">${proj.shortDesc}</div>
<div class="term-line">Stack: <span class="term-cyan">${proj.tech.join(', ')}</span></div>
<div class="term-line">Repo: <a href="${proj.githubUrl}" target="_blank" class="term-link">${proj.githubUrl}</a></div>
<div class="term-spacer"></div>`;
    });
    out += '</div>';
    this.printLine(out);
  }

  cmdRankResume() {
    this.printLine(`<span class="term-accent">🤖 Initializing AI Resume Ranker Model pipeline...</span>`);
    this.printLine(`<span class="term-dim">Loading NLP vectorizer & cosine semantic similarity matrix...</span>`);

    setTimeout(() => {
      this.printLine(`[1/3] Extracting text embeddings from Candidate_Profile.pdf... <span class="term-cyan">DONE</span>`);
    }, 400);

    setTimeout(() => {
      this.printLine(`[2/3] Comparing against target role: "Data Analyst & AI Engineer"... <span class="term-cyan">DONE</span>`);
    }, 900);

    setTimeout(() => {
      const matchScore = 96.4;
      const html = `
<div class="term-box term-highlight-box">
  <div class="term-line"><strong>✨ AI Scoring Matrix Results:</strong></div>
  <div class="term-line">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
  <div class="term-line">Overall Match Score: <span class="term-green font-bold">${matchScore}% (Tier A+ Match)</span></div>
  <div class="term-line">SQL & Data Modeling: <span class="term-cyan">98% Match</span></div>
  <div class="term-line">Python & Pandas ETL:  <span class="term-cyan">95% Match</span></div>
  <div class="term-line">BI & Visualization:   <span class="term-cyan">96% Match</span></div>
  <div class="term-line">AI & ML Foundations:  <span class="term-cyan">94% Match</span></div>
  <div class="term-line term-accent mt-1">Recommendation: Highly Recommended for Interview Scheduling.</div>
</div>`;
      this.printLine(html);
    }, 1500);
  }

  cmdSql(query) {
    if (!query) {
      query = "SELECT Name, Role, CGPA, TopSkill FROM ShubhamProfile WHERE Passion = 'Data & AI';";
    }
    this.printLine(`<span class="term-dim">Executing T-SQL:</span> <code class="term-cyan">${this.escapeHtml(query)}</code>`);
    setTimeout(() => {
      const tableHtml = `
<table class="term-sql-table">
  <thead>
    <tr><th>Name</th><th>Role</th><th>CGPA</th><th>TopSkill</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Shubham Keshri</td><td>Data Analyst / AI Eng</td><td>7.35</td><td>Python, SQL, BI</td><td><span class="term-green">Ready to Deploy</span></td></tr>
  </tbody>
</table>
<div class="term-line term-dim mt-1">(1 row affected, execution time: 4ms)</div>`;
      this.printLine(tableHtml);
    }, 300);
  }

  cmdStats() {
    let out = '<div class="term-box"><div class="term-table">';
    PORTFOLIO_DATA.stats.forEach(st => {
      out += `<div class="term-row"><span class="term-col-cmd">${st.label}</span><span class="term-green font-bold">${st.value}</span></div>`;
    });
    out += '</div></div>';
    this.printLine(out);
  }

  cmdContact() {
    const p = PORTFOLIO_DATA.personal;
    const html = `
<div class="term-box">
  <div class="term-line">📬 Email: <a href="mailto:${p.email}" class="term-link">${p.email}</a></div>
  <div class="term-line">🐙 GitHub: <a href="${p.github}" target="_blank" class="term-link">${p.github}</a></div>
  <div class="term-line">💼 LinkedIn: <a href="${p.linkedin}" target="_blank" class="term-link">${p.linkedin}</a></div>
  <div class="term-line term-accent mt-1">Tip: Click the "Copy Email" button in the contact section for instant copy!</div>
</div>`;
    this.printLine(html);
  }

  cmdSudoHire() {
    const html = `
<div class="term-box" style="border-color: #10B981;">
  <div class="term-line term-green font-bold">🎉 OFFER TRANSMISSION SYSTEM INITIALIZED</div>
  <div class="term-line">Target: <strong>Shubham Keshri</strong></div>
  <div class="term-line">Skills Verified: Data Analysis, SQL, AI/ML, Python, Power BI</div>
  <div class="term-line term-dim">Next Step: Send an email directly to <a href="mailto:shubhamkeshri.433@gmail.com" class="term-link">shubhamkeshri.433@gmail.com</a>.</div>
  <div class="term-line term-accent">Looking forward to building impactful systems with your team! 🚀</div>
</div>`;
    this.printLine(html);
  }

  escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
}

// Export / Attach to window
window.TerminalCLI = TerminalCLI;
