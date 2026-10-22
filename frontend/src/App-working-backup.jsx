import { useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";
const EMPTY_PROJECT = {
  name: "",
  location: "",
  budget: "",
  start_date: "",
  expected_end_date: "",
  progress: "0",
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

function App() {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [projects, setProjects] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [activeSection, setActiveSection] = useState("Dashboard");

  async function apiRequest(path, options = {}, token = accessToken) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : `Request failed (${response.status})`
      );
    }
    return data;
  }

  async function loadProjects(token = accessToken) {
    setDashboardLoading(true);
    setMessage("");
    try {
      const data = await apiRequest("/api/projects", {}, token);
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(
        error instanceof TypeError
          ? "Cannot connect to the backend. Make sure FastAPI is running."
          : error.message
      );
    } finally {
      setDashboardLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    if (isRegister && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister
        ? { full_name: fullName.trim(), email: email.trim(), password }
        : { email: email.trim(), password };
      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      }, "");

      if (isRegister) {
        setMessage("Account created successfully. Please sign in.");
        setIsRegister(false);
        setPassword("");
        setConfirmPassword("");
      } else if (data.access_token) {
        setAccessToken(data.access_token);
        setPassword("");
        await loadProjects(data.access_token);
      } else {
        throw new Error("Login succeeded but no access token was returned.");
      }
    } catch (error) {
      setMessage(
        error instanceof TypeError
          ? "Cannot connect to the backend. Check that FastAPI is running."
          : error.message
      );
    } finally {
      setIsLoading(false);
    }
  }

  function switchPage(register) {
    setIsRegister(register);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function logout() {
    setAccessToken("");
    setProjects([]);
    setSelectedPrediction(null);
    setEmail("");
    setPassword("");
    setMessage("");
    setIsRegister(false);
    setShowProjectForm(false);
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    setMessage("");
    setProjectSaving(true);
    try {
      const payload = {
        name: projectForm.name.trim(),
        location: projectForm.location.trim() || null,
        budget: Number(projectForm.budget),
        start_date: projectForm.start_date,
        expected_end_date: projectForm.expected_end_date,
        progress: Number(projectForm.progress),
      };
      if (payload.expected_end_date < payload.start_date) {
        throw new Error("Expected completion must be on or after the start date.");
      }
      const created = await apiRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setProjects((current) => [...current, created]);
      setProjectForm(EMPTY_PROJECT);
      setShowProjectForm(false);
      setMessage("Project created and saved successfully.");
    } catch (error) {
      setMessage(error.message || "Could not create project.");
    } finally {
      setProjectSaving(false);
    }
  }

  async function predictProject(projectId) {
    setSelectedPrediction({ loading: true });
    try {
      const result = await apiRequest(`/api/projects/${projectId}/predict`);
      setSelectedPrediction({ ...result, loading: false });
    } catch (error) {
      setSelectedPrediction({ loading: false, error: error.message });
    }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    setDeletingProjectId(project.id);
    setMessage("");
    try {
      await apiRequest(`/api/projects/${project.id}`, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item.id !== project.id));
      if (selectedPrediction?.project_id === project.id) setSelectedPrediction(null);
      setMessage(`Project "${project.name}" deleted successfully.`);
    } catch (error) {
      setMessage(
        error.message.includes("(405)") || error.message.includes("(404)")
          ? "Delete is not enabled on the backend yet. Add a DELETE /api/projects/{project_id} route in backend/routes.py."
          : error.message || "Could not delete project."
      );
    } finally {
      setDeletingProjectId(null);
    }
  }

  const visibleProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.location || ""}`.toLowerCase().includes(query)
    );
  }, [projects, projectSearch]);

  const totalBudget = projects.reduce(
    (sum, project) => sum + (Number(project.budget) || 0),
    0
  );
  const averageProgress = projects.length
    ? Math.round(
        projects.reduce((sum, project) => sum + (Number(project.progress) || 0), 0) /
          projects.length
      )
    : 0;

  if (accessToken) {
    return (
      <main className="dashboard-page">
        <aside className="dashboard-sidebar" aria-label="Main navigation">
          <a className="sidebar-brand" href="#top" aria-label="InfraPredict AI home">
            <span className="brand-icon">IP</span>
            <span>InfraPredict <strong>AI</strong></span>
          </a>
          <p className="sidebar-label">NAVIGATION</p>
          <nav className="sidebar-nav" aria-label="Dashboard sections">
            {[ ["Dashboard","⌂"], ["Projects","▦"], ["AI Predictions","✦"], ["Documents","▤"], ["Schedule","▣"], ["Budget","₹"], ["Reports","▥"], ["Settings","⚙"] ].map(([label, icon]) => (
              <button key={label} type="button" className={`sidebar-link ${activeSection === label ? "active" : ""}`} onClick={() => {
                setActiveSection(label);
                if (label === "Projects") document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
                else if (label === "AI Predictions") document.getElementById("navigation-workspace")?.scrollIntoView({ behavior: "smooth" });
                else if (label === "Budget") document.getElementById("budget-stat")?.scrollIntoView({ behavior: "smooth" });
                else document.getElementById("navigation-workspace")?.scrollIntoView({ behavior: "smooth" });
              }}><span aria-hidden="true">{icon}</span>{label}</button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className="sidebar-avatar">U</span>
            <span className="sidebar-user">Signed in</span>
            <button className="sidebar-logout" type="button" onClick={logout} aria-label="Sign out" title="Sign out">↪</button>
          </div>
        </aside>
        <header className="dashboard-header">
          <a className="brand-logo" href="#top" aria-label="InfraPredict AI home">
            <span className="brand-icon">IP</span>
            <span>InfraPredict <strong>AI</strong></span>
          </a>
          <button className="button button-quiet" type="button" onClick={logout}>Sign out</button>
        </header>

        <section className="dashboard-content" id="top">
          <div className="dashboard-intro">
            <div>
              <span className="eyebrow">CONSTRUCTION INTELLIGENCE</span>
              <h1>Your project dashboard</h1>
              <p className="muted">Monitor construction projects and check schedule delay risks.</p>
            </div>
            <button
              className="button button-primary add-project-top"
              type="button"
              onClick={() => setShowProjectForm((open) => !open)}
              aria-expanded={showProjectForm}
            >
              {showProjectForm ? "× Close form" : "+ Add project"}
            </button>
          </div>

          <div className="dashboard-statistics">
            <article className="dashboard-stat-card"><span>Total projects</span><strong>{projects.length}</strong></article>
            <article className="dashboard-stat-card" id="budget-stat"><span>Total budget</span><strong>{money(totalBudget)}</strong></article>
            <article className="dashboard-stat-card"><span>Average progress</span><strong>{projects.length ? `${averageProgress}%` : "—"}</strong></article>
            <article className="dashboard-stat-card"><span>Risk analysis</span><strong>AI</strong></article>
          </div>

          {activeSection !== "Dashboard" && activeSection !== "Projects" && (
            <section className="navigation-workspace" id="navigation-workspace" aria-live="polite">
              <span className="eyebrow">WORKSPACE</span>
              <h2>{activeSection}</h2>
              {activeSection === "AI Predictions" && <div id="prediction-navigation-panel"><p className="muted">Choose a project below and click <strong>Check delay risk</strong> to run the existing AI prediction. Results appear in the Delay-risk prediction panel.</p><button className="button button-primary" type="button" onClick={() => { setActiveSection("Projects"); document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" }); }}>Choose a project</button>{selectedPrediction && !selectedPrediction.loading && !selectedPrediction.error && <p className="status-message">Latest prediction: {selectedPrediction.project_name || "Project analysis complete"}</p>}</div>}
              {activeSection === "Documents" && <><p className="muted">Document management is not connected yet. This section is ready for project document upload and listing, but no files are currently stored by this app.</p><p>Current projects: <strong>{projects.length}</strong></p></>}
              {activeSection === "Schedule" && <><p className="muted">Project schedule overview based on the start and expected completion dates saved for each project.</p>{projects.length ? <div className="navigation-list">{projects.map(project => <article className="navigation-list-item" key={project.id}><strong>{project.name}</strong><span>{project.start_date || "Start not set"} → {project.expected_end_date || "Completion not set"}</span><span>{Number(project.progress) || 0}% complete</span></article>)}</div> : <p>No projects to show. Add a project first.</p>}</>}
              {activeSection === "Reports" && <><p className="muted">Summary report calculated from your currently loaded projects.</p><div className="navigation-list"><article className="navigation-list-item"><strong>Total projects</strong><span>{projects.length}</span></article><article className="navigation-list-item"><strong>Total budget</strong><span>{money(totalBudget)}</span></article><article className="navigation-list-item"><strong>Average progress</strong><span>{projects.length ? `${averageProgress}%` : "—"}</span></article></div><button className="button button-secondary" type="button" onClick={() => window.print()}>Print / Save report</button></>}
              {activeSection === "Settings" && <><p className="muted">Basic workspace settings.</p><div className="navigation-list-item"><strong>API backend</strong><span>{API_URL}</span></div><p className="muted">Account security and profile editing are not available in this version.</p><button className="button button-danger" type="button" onClick={logout}>Sign out</button></>}
            </section>
          )}

          {message && <p className="status-message" role="status" aria-live="polite">{message}</p>}

          {showProjectForm && (
            <form className="project-form" onSubmit={handleCreateProject}>
              <div className="form-heading">
                <div><span className="eyebrow">PROJECT DETAILS</span><h2>Add a new project</h2></div>
                <button className="button button-quiet" type="button" onClick={() => setShowProjectForm(false)}>Cancel</button>
              </div>
              <div className="project-form-grid">
                <label>Project name<input required maxLength={200} value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="e.g. Riverside Bridge" /></label>
                <label>Location <span className="optional-label">Optional</span><input maxLength={200} value={projectForm.location} onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })} placeholder="City or site location" /></label>
                <label>Budget (₹)<input required type="number" min="0.01" step="0.01" value={projectForm.budget} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })} placeholder="2500000" /></label>
                <label>Start date<input required type="date" value={projectForm.start_date} onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })} /></label>
                <label>Expected completion<input required type="date" min={projectForm.start_date || undefined} value={projectForm.expected_end_date} onChange={(e) => setProjectForm({ ...projectForm, expected_end_date: e.target.value })} /></label>
                <label>Progress (%)<input required type="number" min="0" max="100" step="1" value={projectForm.progress} onChange={(e) => setProjectForm({ ...projectForm, progress: e.target.value })} /></label>
              </div>
              <div className="form-actions"><button className="button button-primary" type="submit" disabled={projectSaving}>{projectSaving ? "Saving project…" : "Save project"}</button></div>
            </form>
          )}

          <section className="projects-section" id="projects">
            <div className="section-toolbar">
              <div><h2>Your projects</h2><p className="muted">Projects available to your authenticated account.</p></div>
              <button className="button button-secondary" type="button" onClick={() => loadProjects()} disabled={dashboardLoading}>{dashboardLoading ? "Refreshing…" : "↻ Refresh"}</button>
            </div>
            <label className="project-search"><span>Search projects</span><input type="search" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder="Search by project name or location" /></label>

            {dashboardLoading ? <div className="empty-state"><p>Loading projects…</p></div> : visibleProjects.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">▦</div><h3>{projects.length === 0 ? "No projects yet" : "No matching projects"}</h3><p>{projects.length === 0 ? "Add your first project to start tracking progress and delay risk." : "Try another project name or location."}</p>{projects.length === 0 && <button className="button button-primary" type="button" onClick={() => setShowProjectForm(true)}>+ Add your first project</button>}</div>
            ) : (
              <div className="project-grid">
                {visibleProjects.map((project) => {
                  const progress = Math.min(100, Math.max(0, Number(project.progress) || 0));
                  return (
                    <article className="project-card" key={project.id}>
                      <div className="project-card-top"><div className="project-icon">▦</div><span className="project-id">PROJECT #{project.id}</span></div>
                      <h3>{project.name}</h3>
                      <p className="project-location">{project.location || "Location not specified"}</p>
                      <div className="project-budget"><span>Project budget</span><strong>{money(project.budget)}</strong></div>
                      <div className="project-progress-heading"><span>Project progress</span><strong>{progress}%</strong></div>
                      <div className="project-progress-track" role="progressbar" aria-label={`${project.name} progress`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="project-progress-fill" style={{ width: `${progress}%` }} /></div>
                      <div className="project-dates"><div><span>Start date</span><strong>{project.start_date || "Not set"}</strong></div><div><span>Expected completion</span><strong>{project.expected_end_date || "Not set"}</strong></div></div>
                      <div className="project-card-actions">
                        <button className="button button-primary" type="button" onClick={() => predictProject(project.id)}>Check delay risk <span aria-hidden="true">→</span></button>
                        <button className="button button-danger" type="button" onClick={() => deleteProject(project)} disabled={deletingProjectId === project.id}>{deletingProjectId === project.id ? "Deleting…" : "Delete project"}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {selectedPrediction && <section className="prediction-panel" id="predictions" aria-live="polite"><div className="prediction-heading"><div><span className="eyebrow">AI ANALYSIS</span><h2>Delay-risk prediction</h2></div><button className="button button-quiet" type="button" onClick={() => setSelectedPrediction(null)}>Close</button></div>{selectedPrediction.loading ? <p className="muted">Analyzing project…</p> : selectedPrediction.error ? <p className="status-message">{selectedPrediction.error}</p> : <><h3>{selectedPrediction.project_name}</h3><div className="prediction-results">{Object.entries(selectedPrediction).filter(([key]) => !["project_id", "project_name", "loading"].includes(key)).map(([key, value]) => <div className="prediction-result" key={key}><span>{key.replaceAll("_", " ")}</span><strong>{typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}</strong></div>)}</div></>}</section>}
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <a className="brand-logo" href="#login"><span className="brand-icon">IP</span><span>InfraPredict <strong>AI</strong></span></a>
        <div className="brand-content"><span className="eyebrow">CONSTRUCTION INTELLIGENCE</span><h1>{isRegister ? <>Your projects.<br />Your insights.<br />One platform.</> : <>Build with confidence.<br />Deliver on time.</>}</h1><p>Intelligent construction monitoring and delay-risk insights to help your team make better project decisions.</p><div className="brand-statistics"><div><span className="stat-icon">↗</span><strong>Project insights</strong><small>Track progress in one place</small></div><div><span className="stat-icon">✓</span><strong>Risk intelligence</strong><small>Identify schedule risks early</small></div></div></div>
        <p className="brand-footer">© 2026 InfraPredict AI · Construction Risk Intelligence</p>
      </section>
      <section className="login-form-panel" id="login"><div className="login-form-container"><div className="mobile-brand"><span className="brand-icon">IP</span><span>InfraPredict <strong>AI</strong></span></div><div className="welcome-icon">{isRegister ? "+" : "↗"}</div><span className="form-eyebrow">{isRegister ? "GET STARTED" : "WELCOME BACK"}</span><h2>{isRegister ? "Create your account" : "Sign in to your account"}</h2><p className="muted">{isRegister ? "Create your account to manage construction projects and monitor risks." : "Enter your credentials to access your project dashboard."}</p>
        <form className="auth-form" onSubmit={handleSubmit}>{isRegister && <label>Full name<input type="text" placeholder="Enter your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={100} required /></label>}<label>Work email<input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label><div className="password-label"><label htmlFor="password">Password</label>{!isRegister && <button className="inline-link" type="button" onClick={() => setMessage("Password recovery is not available yet.")}>Forgot password?</button>}</div><div className="password-input"><input id="password" type={showPassword ? "text" : "password"} placeholder={isRegister ? "Create a password" : "Enter your password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : undefined} required /><button className="show-password" type="button" onClick={() => setShowPassword((show) => !show)}>{showPassword ? "Hide" : "Show"}</button></div>
        {isRegister && <><label>Confirm password<div className="password-input"><input type={showConfirmPassword ? "text" : "password"} placeholder="Re-enter your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} required /><button className="show-password" type="button" onClick={() => setShowConfirmPassword((show) => !show)}>{showConfirmPassword ? "Hide" : "Show"}</button></div></label><p className="helper-text">Use at least 8 characters for your password.</p></>}
        {!isRegister && <label className="remember-option"><input type="checkbox" /><span>Remember me</span></label>}{message && <p className="status-message" role="status" aria-live="polite">{message}</p>}<button className="button button-primary auth-submit" type="submit" disabled={isLoading}>{isLoading ? "Please wait…" : isRegister ? "Create account" : "Sign in"}<span aria-hidden="true">→</span></button></form>
        <div className="auth-switch"><span>{isRegister ? "Already have an account?" : "New to InfraPredict AI?"}</span><button className="inline-link" type="button" disabled={isLoading} onClick={() => switchPage(!isRegister)}>{isRegister ? "Sign in" : "Create account"}</button></div><div className="security-note"><span>▣</span>Secure access to your construction workspace</div></div></section>
    </main>
  );
}

export default App;
