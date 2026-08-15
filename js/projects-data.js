/**
 * Portfolio Static Dataset & Fallback Data
 * Shubham Keshri - Data Analyst & AI Engineer
 */

const PORTFOLIO_DATA = {
  profile: {
    name: "Shubham Keshri",
    title: "Data Analyst & AI Developer",
    education: "Bachelor of Computer Application (BCA)",
    university: "Amity University",
    specialization: "Data Analysis",
    cgpa: "7.35",
    batch: "2023 — 2026",
    location: "Delhi, India",
    email: "shubhamkeshri.433@gmail.com",
    github: "https://github.com/Shubhamkeshri433",
    linkedin: "https://www.linkedin.com/in/shubhamkeshri433/",
    status: "Available for Hire & Internships",
    motto: "Explore tech, learn continuously, and upgrade skills."
  },
  personal: {
    name: "Shubham Keshri",
    title: "Data Analyst & AI Developer",
    education: {
      degree: "Bachelor of Computer Application (BCA)",
      institution: "Amity University",
      specialization: "Data Analysis",
      cgpa: "7.35"
    },
    location: "Delhi, India",
    email: "shubhamkeshri.433@gmail.com",
    github: "https://github.com/Shubhamkeshri433",
    linkedin: "https://www.linkedin.com/in/shubhamkeshri433/",
    tagline: "Turning complex raw data into powerful intelligent experiences.",
    status: "Available for Hire (Open to Remote / Onsite)"
  },
  skills: {
    programming: { category: "Programming", items: ["Python", "JavaScript", "HTML5", "CSS3", "OOP", "Clean Architecture"] },
    sql: { category: "SQL & Databases", items: ["MSSQL", "T-SQL", "MySQL", "CTEs", "Window Functions", "Stored Procedures"] },
    analytics: { category: "Data Analytics & BI", items: ["Power BI", "Excel", "Pandas", "NumPy", "DAX", "KPI Dashboards"] },
    ai: { category: "AI & Machine Learning", items: ["Machine Learning", "NLP & Semantic Search", "Vector Embeddings", "Cosine Scoring"] },
    aidev: { category: "AI Development", items: ["LangChain", "Streamlit", "PyTorch / TensorFlow", "AI Agents"] },
    tools: { category: "Tools & Deployment", items: ["Git", "GitHub", "VS Code", "Jupyter Notebook"] }
  },
  stats: [
    { value: "6+", label: "GITHUB REPOSITORIES", id: "stat-repos" },
    { value: "7.35", label: "CGPA (DATA ANALYSIS)", id: "stat-cgpa" },
    { value: "BCA", label: "AMITY UNIVERSITY", id: "stat-degree" },
    { value: "2026", label: "GRADUATION BATCH", id: "stat-batch" }
  ],
  projects: [
    {
      id: "AI-Resume-Ranker",
      title: "AI Resume Ranker",
      badge: "AI & NLP System",
      shortDesc: "AI-powered candidate screening and resume ranking application using NLP and semantic vector similarity.",
      tech: ["Python", "Streamlit", "NLP", "Semantic Search"],
      githubUrl: "https://github.com/Shubhamkeshri433/AI-Resume-Ranker"
    },
    {
      id: "Customer-Shopping-Behavior-Analysis",
      title: "Customer Shopping Behavior Analysis",
      badge: "BI & Analytics",
      shortDesc: "Retail customer analysis pipeline with multi-tiered customer segmentation and Power BI executive dashboards.",
      tech: ["Power BI", "SQL", "Pandas", "Customer Segmentation"],
      githubUrl: "https://github.com/Shubhamkeshri433/Customer-Shopping-Behavior-Analysis"
    },
    {
      id: "Dirty-Cafe-Data-Set",
      title: "Dirty Cafe Data Set Cleaning",
      badge: "ETL & Data Cleansing",
      shortDesc: "Automated data cleaning and transformation pipeline converting messy cafe sales logs into structured analytics tables.",
      tech: ["Python", "Pandas", "NumPy", "Data Cleaning"],
      githubUrl: "https://github.com/Shubhamkeshri433/Dirty-Cafe-Data-Set"
    },
    {
      id: "Maven-Fuzzy-Factory-data-analysis-project",
      title: "Maven Fuzzy Factory Analysis",
      badge: "E-Commerce Analytics",
      shortDesc: "E-commerce analytics project evaluating website traffic, channel conversion funnels, and revenue optimization.",
      tech: ["SQL", "Data Analytics", "Conversion Funnels", "KPI Metrics"],
      githubUrl: "https://github.com/Shubhamkeshri433/Maven-Fuzzy-Factory-data-analysis-project"
    },
    {
      id: "SSMS-SQL-Employee_Sample_Data_Base-Questions-Answers",
      title: "SSMS SQL Employee Database",
      badge: "SQL Architecture",
      shortDesc: "Advanced T-SQL query architecture solving complex enterprise scenarios, ranking functions, and salary analytics.",
      tech: ["MSSQL", "T-SQL", "CTEs", "Window Functions"],
      githubUrl: "https://github.com/Shubhamkeshri433/SSMS-SQL-Employee_Sample_Data_Base-Questions-Answers"
    },
    {
      id: "To-Do-in-Excel",
      title: "Productivity Dashboard in Excel",
      badge: "Excel & Productivity",
      shortDesc: "Interactive productivity and task management dashboard built in Excel with conditional formatting and tracking.",
      tech: ["Excel", "Lookup Formulas", "VBA/Macros", "Dashboard"],
      githubUrl: "https://github.com/Shubhamkeshri433/To-Do-in-Excel"
    }
  ]
};

window.PORTFOLIO_DATA = PORTFOLIO_DATA;
