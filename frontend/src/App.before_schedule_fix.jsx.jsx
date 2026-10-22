
import { useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8001";
const MAX_PDF_SIZE = 10 * 1024 * 1024;

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

  // Milestone schedule state
  const [selectedScheduleProjectId, setSelectedScheduleProjectId] = useState("");
  const [milestones, setMilestones] = useState([]);
  const [projectAnalytics, setProjectAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [milestoneMessage, setMilestoneMessage] = useState("");
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const EMPTY_MILESTONE = {
    name: "",
    planned_end_date: "",
    actual_end_date: "",
    planned_progress_pct: "0",
    actual_progress_pct: "",
    planned_budget: "0",
    actual_spend: "",
  };
  const [milestoneForm, setMilestoneForm] = useState(EMPTY_MILESTONE);

  // PDF analyzer state
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfAnalysis, setPdfAnalysis] = useState(null);
  const [pdfAnalyzing, setPdfAnalyzing] = useState(false);
  const [pdfError, setPdfError] = useState("");

  async function apiRequest(path, options = {}, token = accessToken) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
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

  async function loadMilestones(projectId = selectedScheduleProjectId) {
    if (!projectId) {
      setMilestones([]);
      return;
    }

    setMilestonesLoading(true);
    setMilestoneMessage("");
    try {
      const data = await apiRequest(`/api/projects/${projectId}/milestones`);
      setMilestones(Array.isArray(data) ? data : []);
    } catch (error) {
      setMilestoneMessage(
        error instanceof TypeError
          ? "Cannot connect to the backend while loading milestones."
          : error.message
      );
      setMilestones([]);
    } finally {
      setMilestonesLoading(false);
    }
  }

  async function loadProjectAnalytics(projectId = selectedScheduleProjectId) {
    if (!projectId) {
      setProjectAnalytics(null);
      setAnalyticsError("");
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError("");

    try {
      const data = await apiRequest(`/api/analytics/projects/${projectId}`);
      setProjectAnalytics(data);
    } catch (error) {
      setProjectAnalytics(null);
      setAnalyticsError(
        error instanceof TypeError
          ? "Cannot connect to the backend while loading analytics."
          : error.message || "Could not load project analytics."
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }


  function resetMilestoneForm() {
    setMilestoneForm(EMPTY_MILESTONE);
    setEditingMilestoneId(null);
  }

  function startEditMilestone(milestone) {
    setEditingMilestoneId(milestone.id);
    setMilestoneForm({
      name: milestone.name || "",
      planned_end_date: milestone.planned_end_date || "",
      actual_end_date: milestone.actual_end_date || "",
      planned_progress_pct: String(milestone.planned_progress_pct ?? 0),
      actual_progress_pct:
        milestone.actual_progress_pct == null
          ? ""
          : String(milestone.actual_progress_pct),
      planned_budget: String(milestone.planned_budget ?? 0),
      actual_spend:
        milestone.actual_spend == null ? "" : String(milestone.actual_spend),
    });
    setMilestoneMessage("");
    window.setTimeout(() => {
      document.getElementById("milestone-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  async function handleSaveMilestone(event) {
    event.preventDefault();
    setMilestoneMessage("");

    if (!selectedScheduleProjectId) {
      setMilestoneMessage("Select a project before adding a milestone.");
      return;
    }
    if (!milestoneForm.name.trim() || !milestoneForm.planned_end_date) {
      setMilestoneMessage("Milestone name and planned end date are required.");
      return;
    }

    const plannedProgress = Number(milestoneForm.planned_progress_pct);
    const actualProgress =
      milestoneForm.actual_progress_pct === ""
        ? null
        : Number(milestoneForm.actual_progress_pct);
    const plannedBudget = Number(milestoneForm.planned_budget);
    const actualSpend =
      milestoneForm.actual_spend === "" ? null : Number(milestoneForm.actual_spend);

    if (
      !Number.isFinite(plannedProgress) ||
      plannedProgress < 0 ||
      plannedProgress > 100
    ) {
      setMilestoneMessage("Planned progress must be between 0 and 100.");
      return;
    }
    if (
      actualProgress !== null &&
      (!Number.isFinite(actualProgress) || actualProgress < 0 || actualProgress > 100)
    ) {
      setMilestoneMessage("Actual progress must be between 0 and 100.");
      return;
    }
    if (!Number.isFinite(plannedBudget) || plannedBudget < 0) {
      setMilestoneMessage("Planned budget must be zero or greater.");
      return;
    }
    if (
      actualSpend !== null &&
      (!Number.isFinite(actualSpend) || actualSpend < 0)
    ) {
      setMilestoneMessage("Actual spending must be zero or greater.");
      return;
    }

    setMilestoneSaving(true);
    try {
      const payload = {
        name: milestoneForm.name.trim(),
        planned_end_date: milestoneForm.planned_end_date,
        actual_end_date: milestoneForm.actual_end_date || null,
        planned_progress_pct: plannedProgress,
        actual_progress_pct: actualProgress,
        planned_budget: plannedBudget,
        actual_spend: actualSpend,
      };
      const path = editingMilestoneId
        ? `/api/projects/${selectedScheduleProjectId}/milestones/${editingMilestoneId}`
        : `/api/projects/${selectedScheduleProjectId}/milestones`;
      const saved = await apiRequest(path, {
        method: editingMilestoneId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setMilestones((current) => {
        if (editingMilestoneId) {
          return current.map((item) => item.id === saved.id ? saved : item)
            .sort((a, b) => a.planned_end_date.localeCompare(b.planned_end_date));
        }
        return [...current, saved]
          .sort((a, b) => a.planned_end_date.localeCompare(b.planned_end_date));
      });
      setMilestoneMessage(editingMilestoneId ? "Milestone updated." : "Milestone saved.");
      resetMilestoneForm();
      await loadProjectAnalytics(selectedScheduleProjectId);
    } catch (error) {
      setMilestoneMessage(error.message || "Could not save milestone.");
    } finally {
      setMilestoneSaving(false);
    }
  }

  // Add project now opens the PDF analyzer.
  function openAddProject() {
    setActiveSection("Documents");
    setShowProjectForm(false);
    setPdfError("");
    setPdfAnalysis(null);
    setSelectedPdf(null);
    setMessage("");

    window.setTimeout(() => {
      document
        .getElementById("navigation-workspace")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function analyzePdf() {
    if (!selectedPdf) {
      setPdfError("Please select a PDF file first.");
      return;
    }

    if (
      !selectedPdf.name.toLowerCase().endsWith(".pdf") &&
      selectedPdf.type !== "application/pdf"
    ) {
      setPdfError("Please select a PDF file.");
      return;
    }

    if (selectedPdf.size > MAX_PDF_SIZE) {
      setPdfError("The PDF must be 10 MB or smaller.");
      return;
    }

    setPdfError("");
    setPdfAnalysis(null);
    setPdfAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedPdf);

      const data = await apiRequest(
        "/api/documents/analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!data || typeof data !== "object") {
        throw new Error("The server returned an invalid analysis response.");
      }

      setPdfAnalysis(data);
    } catch (error) {
      setPdfError(
        error instanceof TypeError
          ? "Cannot connect to the backend. Check that FastAPI is running."
          : error.message
      );
    } finally {
      setPdfAnalyzing(false);
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
      const endpoint = isRegister
        ? "/api/auth/register"
        : "/api/auth/login";

      const payload = isRegister
        ? {
            full_name: fullName.trim(),
            email: email.trim(),
            password,
          }
        : {
            email: email.trim(),
            password,
          };

      const data = await apiRequest(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        ""
      );

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
    setSelectedPdf(null);
    setPdfAnalysis(null);
    setPdfError("");
    setMilestones([]);
    setMilestoneMessage("");
    setProjectAnalytics(null);
    setAnalyticsError("");
    setAnalyticsLoading(false);
    setSelectedScheduleProjectId("");
    resetMilestoneForm();
    setActiveSection("Dashboard");
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    setMessage("");

    const budget = Number(projectForm.budget);
    const progress = Number(projectForm.progress);

    if (!projectForm.name.trim()) {
      setMessage("Project name is required.");
      return;
    }

    if (!Number.isFinite(budget) || budget <= 0) {
      setMessage("Enter a valid project budget greater than zero.");
      return;
    }

    if (
      !projectForm.start_date ||
      !projectForm.expected_end_date
    ) {
      setMessage("Please provide both project dates.");
      return;
    }

    if (projectForm.expected_end_date < projectForm.start_date) {
      setMessage("Expected completion must be on or after the start date.");
      return;
    }

    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      setMessage("Progress must be between 0 and 100.");
      return;
    }

    setProjectSaving(true);

    try {
      const payload = {
        name: projectForm.name.trim(),
        location: projectForm.location.trim() || null,
        budget,
        start_date: projectForm.start_date,
        expected_end_date: projectForm.expected_end_date,
        progress,
      };

      const created = await apiRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setProjects((current) => [...current, created]);
      setProjectForm(EMPTY_PROJECT);
      setShowProjectForm(false);
      setPdfAnalysis(null);
      setSelectedPdf(null);
      setMessage("Project created and saved successfully.");
      setActiveSection("Projects");
    } catch (error) {
      setMessage(error.message || "Could not create project.");
    } finally {
      setProjectSaving(false);
    }
  }

  function usePdfDetails() {
    if (!pdfAnalysis?.extracted) {
      setPdfError("No extracted project details are available.");
      return;
    }

    const extracted = pdfAnalysis.extracted;

    setProjectForm({
      name: extracted.name || "",
      location: extracted.location || "",
      budget:
        extracted.budget != null ? String(extracted.budget) : "",
      start_date: extracted.start_date || "",
      expected_end_date: extracted.expected_end_date || "",
      progress:
        extracted.progress != null ? String(extracted.progress) : "0",
    });

    setShowProjectForm(true);
    setActiveSection("Projects");
    setMessage(
      "PDF details copied into the project form. Review the fields before saving."
    );

    window.setTimeout(() => {
      document.getElementById("project-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  async function predictProject(projectId) {
    setSelectedPrediction({ loading: true });

    try {
      const result = await apiRequest(`/api/projects/${projectId}/predict`);
      setSelectedPrediction({ ...result, loading: false });
    } catch (error) {
      setSelectedPrediction({
        loading: false,
        error: error.message,
      });
    }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      return;
    }

    setDeletingProjectId(project.id);
    setMessage("");

    try {
      await apiRequest(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      setProjects((current) =>
        current.filter((item) => item.id !== project.id)
      );

      if (selectedPrediction?.project_id === project.id) {
        setSelectedPrediction(null);
      }

      setMessage(`Project "${project.name}" deleted successfully.`);
    } catch (error) {
      setMessage(
        error.message.includes("(405)") || error.message.includes("(404)")
          ? "Project deletion failed. Please try again."
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
      `${project.name} ${project.location || ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [projects, projectSearch]);

  const totalBudget = projects.reduce(
    (sum, project) => sum + (Number(project.budget) || 0),
    0
  );

  const averageProgress = projects.length
    ? Math.round(
        projects.reduce(
          (sum, project) => sum + (Number(project.progress) || 0),
          0
        ) / projects.length
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
            {[
              ["Dashboard", "📊"],
              ["Projects", "📁"],
              ["AI Predictions", "🤖"],
              ["Documents", "📄"],
              ["Schedule", "📅"],
              ["Budget", "₹"],
              ["Reports", "📈"],
              ["Settings", "⚙"],
            ].map(([label, icon]) => (
              <button
                key={label}
                type="button"
                className={`sidebar-link ${activeSection === label ? "active" : ""}`}
                onClick={() => {
                  setActiveSection(label);

                  if (label === "Schedule" && !selectedScheduleProjectId && projects.length) {
                    const firstProjectId = String(projects[0].id);
                    setSelectedScheduleProjectId(firstProjectId);
                    loadMilestones(firstProjectId);
                    loadProjectAnalytics(firstProjectId);
                  }

                  if (label === "Projects") {
                    document.getElementById("projects")?.scrollIntoView({
                      behavior: "smooth",
                    });
                  } else if (label === "Budget") {
                    document.getElementById("budget-stat")?.scrollIntoView({
                      behavior: "smooth",
                    });
                  } else if (label === "Dashboard") {
                    document.getElementById("top")?.scrollIntoView({
                      behavior: "smooth",
                    });
                  } else {
                    document.getElementById("navigation-workspace")?.scrollIntoView({
                      behavior: "smooth",
                    });
                  }
                }}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <span className="sidebar-avatar">U</span>
            <span className="sidebar-user">Signed in</span>
            <button
              className="sidebar-logout"
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
            >
              <span aria-hidden="true">&#x21AA;</span>
            </button>
          </div>
        </aside>

        <header className="dashboard-header">
          <a className="brand-logo" href="#top" aria-label="InfraPredict AI home">
            <span className="brand-icon">IP</span>
            <span>InfraPredict <strong>AI</strong></span>
          </a>
          <button className="button button-quiet" type="button" onClick={logout}>
            Sign out
          </button>
        </header>

        <section className="dashboard-content" id="top">
          <div className="dashboard-intro">
            <div>
              <span className="eyebrow">CONSTRUCTION INTELLIGENCE</span>
              <h1>Your project dashboard</h1>
              <p className="muted">
                Monitor construction projects and check schedule delay risks.
              </p>
            </div>

            <button
              className="button button-primary add-project-top"
              type="button"
              onClick={openAddProject}
            >
              + Add project
            </button>
          </div>

          <div className="dashboard-statistics">
            <article className="dashboard-stat-card">
              <span>Total projects</span>
              <strong>{projects.length}</strong>
            </article>
            <article className="dashboard-stat-card" id="budget-stat">
              <span>Total budget</span>
              <strong>{money(totalBudget)}</strong>
            </article>
            <article className="dashboard-stat-card">
              <span>Average progress</span>
              <strong>{projects.length ? `${averageProgress}%` : "—"}</strong>
            </article>
            <article className="dashboard-stat-card">
              <span>Risk analysis</span>
              <strong>
                {selectedPrediction?.loading
                  ? "Analyzing..."
                  : selectedPrediction?.error
                    ? "Unavailable"
                    : selectedPrediction?.risk || "Not run yet"}
              </strong>
            </article>
          </div>

          {activeSection !== "Dashboard" && activeSection !== "Projects" && (
            <section
              className="navigation-workspace"
              id="navigation-workspace"
              aria-live="polite"
            >
              {activeSection === "Documents" ? (
                <div className="document-workspace">
                  <div className="document-page-heading">
                    <div>
                      <span className="eyebrow">WORKSPACE / ADD PROJECT</span>
                      <h2>Add project using PDF</h2>
                      <p className="muted">
                        Upload a project PDF, extract its details, and review
                        them before saving a new project.
                      </p>
                    </div>
                    <div className="document-header-icon" aria-hidden="true">📄</div>
                  </div>

                  <div className="document-upload-card">
                    <div className="document-card-heading">
                      <div className="document-upload-symbol" aria-hidden="true">â†‘</div>
                      <div>
                        <h3>Project document analyzer</h3>
                        <p className="muted">
                          Select a PDF with readable project information.
                        </p>
                      </div>
                    </div>

                    <label className="document-dropzone" htmlFor="project-pdf">
                      <span className="document-file-icon" aria-hidden="true">PDF</span>
                      <strong>
                        {selectedPdf ? selectedPdf.name : "Choose a project PDF"}
                      </strong>
                      <span className="muted">
                        {selectedPdf
                          ? `${(selectedPdf.size / (1024 * 1024)).toFixed(2)} MB selected`
                          : "Select a file from your computer"}
                      </span>
                      <span className="document-choose-button">
                        {selectedPdf ? "Choose another file" : "Browse files"}
                      </span>
                      <input
                        id="project-pdf"
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(event) => {
                          setSelectedPdf(event.target.files?.[0] || null);
                          setPdfAnalysis(null);
                          setPdfError("");
                        }}
                      />
                    </label>

                    <div className="document-upload-footer">
                      <span className="document-file-note">
                        <span aria-hidden="true">✓</span> PDF files only · Maximum 10 MB
                      </span>
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={analyzePdf}
                        disabled={!selectedPdf || pdfAnalyzing}
                      >
                        {pdfAnalyzing ? "Analyzing document..." : "Analyze PDF"}
                        {!pdfAnalyzing && <span aria-hidden="true">→</span>}
                      </button>
                    </div>

                    {pdfError && (
                      <div className="document-error" role="alert">
                        <strong>Analysis unsuccessful</strong>
                        <p>{pdfError}</p>
                      </div>
                    )}
                  </div>

                  {pdfAnalyzing && (
                    <div className="document-processing" role="status">
                      <span className="document-spinner" />
                      <div>
                        <strong>Analyzing your document</strong>
                        <p className="muted">
                          Extracting readable text and identifying project details.
                        </p>
                      </div>
                    </div>
                  )}

                  {pdfAnalysis && (
                    <div className="document-results-card">
                      <div className="document-results-heading">
                        <div>
                          <span className="eyebrow">ANALYSIS RESULTS</span>
                          <h3>Extracted project details</h3>
                          <p className="muted">
                            Check the detected values before transferring them
                            into the editable project form.
                          </p>
                        </div>
                        <span className="document-review-badge">Review required</span>
                      </div>

                      {pdfAnalysis.message && (
                        <p className="document-analysis-message">
                          {pdfAnalysis.message}
                        </p>
                      )}

                      <div className="document-fields-grid">
                        {[
                          { label: "Project name", value: pdfAnalysis.extracted?.name },
                          { label: "Location", value: pdfAnalysis.extracted?.location },
                          {
                            label: "Project budget",
                            value: pdfAnalysis.extracted?.budget != null
                              ? money(pdfAnalysis.extracted.budget)
                              : null,
                          },
                          { label: "Start date", value: pdfAnalysis.extracted?.start_date },
                          {
                            label: "Expected completion",
                            value: pdfAnalysis.extracted?.expected_end_date,
                          },
                          {
                            label: "Project progress",
                            value: pdfAnalysis.extracted?.progress != null
                              ? `${pdfAnalysis.extracted.progress}%`
                              : null,
                          },
                        ].map((field) => (
                          <div className="document-field" key={field.label}>
                            <span className="document-field-label">{field.label}</span>
                            <strong
                              className={
                                field.value == null || field.value === ""
                                  ? "document-field-value is-missing"
                                  : "document-field-value"
                              }
                            >
                              {field.value == null || field.value === ""
                                ? "Not detected"
                                : field.value}
                            </strong>
                          </div>
                        ))}
                      </div>

                      <details className="document-text-preview">
                        <summary>View extracted text</summary>
                        <pre>
                          {pdfAnalysis.text_preview || "No text preview available."}
                        </pre>
                      </details>

                      <div className="document-results-actions">
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => {
                            setPdfAnalysis(null);
                            setPdfError("");
                          }}
                        >
                          Clear results
                        </button>
                        <button
                          className="button button-primary"
                          type="button"
                          onClick={usePdfDetails}
                        >
                          Review in project form <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="document-privacy-note">
                    <span aria-hidden="true">ℹ</span>
                    <p>
                      <strong>Document privacy:</strong> The selected PDF is
                      analyzed but is not stored as a project document by this
                      feature. A project is created only after you review and
                      submit the project form.
                    </p>
                  </div>

                  <div className="document-project-summary">
                    <div>
                      <span className="document-summary-label">Current projects</span>
                      <strong>{projects.length}</strong>
                    </div>
                    <span className="document-summary-caption">
                      Your existing projects remain unchanged.
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <span className="eyebrow">WORKSPACE</span>
                  <h2>{activeSection}</h2>

                  {activeSection === "AI Predictions" && (
                    <div>
                      <p className="muted">
                        Choose a project below and click Check delay risk to run
                        the existing prediction.
                      </p>
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => {
                          setActiveSection("Projects");
                          document.getElementById("projects")?.scrollIntoView({
                            behavior: "smooth",
                          });
                        }}
                      >
                        Choose a project
                      </button>
                      {selectedPrediction && !selectedPrediction.loading &&
                        !selectedPrediction.error && (
                          <p className="status-message">
                            Latest prediction: {selectedPrediction.project_name ||
                              "Project analysis complete"}
                          </p>
                        )}
                    </div>
                  )}

                  {activeSection === "Schedule" && (
                    <div className="milestone-workspace">
                      <p className="muted">
                        Create and update milestones for a saved project. Milestone data is stored by the backend.
                      </p>

                      {analyticsLoading && (
                        <p className="muted" role="status">Loading project analytics...</p>
                      )}
                      {analyticsError && (
                        <p className="status-message" role="alert">{analyticsError}</p>
                      )}
                      {projectAnalytics && (
                        <>
                          <div className="milestone-list-heading">
                            <h3>Project analytics</h3>
                            <button
                              className="button button-secondary"
                              type="button"
                              onClick={() => loadProjectAnalytics()}
                              disabled={analyticsLoading || !selectedScheduleProjectId}
                            >
                              {analyticsLoading ? "Refreshing..." : "Refresh analytics"}
                            </button>
                          </div>
                          <div className="dashboard-statistics milestone-statistics">
                            <article className="dashboard-stat-card">
                              <span>Total milestones</span>
                              <strong>{projectAnalytics.milestone_count ?? projectAnalytics.total_milestones ?? milestones.length}</strong>
                            </article>
                            <article className="dashboard-stat-card">
                              <span>Completed</span>
                              <strong>{projectAnalytics.completed ?? projectAnalytics.completed_milestones ?? 0}</strong>
                            </article>
                            <article className="dashboard-stat-card">
                              <span>Overdue</span>
                              <strong>{projectAnalytics.overdue ?? projectAnalytics.overdue_milestones ?? 0}</strong>
                            </article>
                            <article className="dashboard-stat-card">
                              <span>Planned progress</span>
                              <strong>{Number(projectAnalytics.planned_progress_pct ?? 0).toFixed(1)}%</strong>
                            </article>
                            <article className="dashboard-stat-card">
                              <span>Actual progress</span>
                              <strong>{Number(projectAnalytics.actual_progress_pct ?? 0).toFixed(1)}%</strong>
                            </article>
                            <article className="dashboard-stat-card">
                              <span>Progress variance</span>
                              <strong>{Number(projectAnalytics.variance ?? projectAnalytics.progress_variance_pct ?? ((Number(projectAnalytics.actual_progress_pct) || 0) - (Number(projectAnalytics.planned_progress_pct) || 0))).toFixed(1)}%</strong>
                            </article>
                            <article className="dashboard-stat-card">
                              <span>Budget used</span>
                              <strong>{Number(projectAnalytics.budget_used_pct ?? 0).toFixed(1)}%</strong>
                            </article>
                            <article className="dashboard-stat-card">
                              <span>Planned milestone budget</span>
                              <strong>{money(projectAnalytics.planned_budget ?? projectAnalytics.total_planned_budget ?? 0)}</strong>
                            </article>
                            <article className="dashboard-stat-card">
                              <span>Actual spending</span>
                              <strong>{money(projectAnalytics.actual_spend ?? projectAnalytics.actual_spending ?? 0)}</strong>
                            </article>
                            <article className="dashboard-stat-card">
                              <span>Budget remaining</span>
                              <strong>{money(projectAnalytics.budget_variance ?? ((Number(projectAnalytics.planned_budget) || 0) - (Number(projectAnalytics.actual_spend) || 0)))}</strong>
                            </article>
                          </div>
                        </>
                      )}

                      {projects.length === 0 ? (
                        <p>No projects to show. Add a project first.</p>
                      ) : (
                        <>
                          <label className="milestone-project-select">
                            Select project
                            <select
                              value={selectedScheduleProjectId}
                              onChange={(event) => {
                                const nextId = event.target.value;
                                setSelectedScheduleProjectId(nextId);
                                setMilestones([]);
                                setMilestoneMessage("");
                                setProjectAnalytics(null);
                                setAnalyticsError("");
                                resetMilestoneForm();
                                if (nextId) {
                                  loadMilestones(nextId);
                                  loadProjectAnalytics(nextId);
                                }
                              }}
                            >
                              <option value="">Choose a project...</option>
                              {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          {selectedScheduleProjectId && (
                            <>
                              <form className="project-form milestone-form" id="milestone-form" onSubmit={handleSaveMilestone}>
                                <div className="form-heading">
                                  <div>
                                    <span className="eyebrow">MILESTONE DETAILS</span>
                                    <h3>{editingMilestoneId ? "Edit milestone" : "Add a milestone"}</h3>
                                  </div>
                                  {editingMilestoneId && (
                                    <button className="button button-quiet" type="button" onClick={resetMilestoneForm}>
                                      Cancel edit
                                    </button>
                                  )}
                                </div>

                                <div className="project-form-grid">
                                  <label>
                                    Milestone name
                                    <input
                                      required
                                      maxLength={200}
                                      value={milestoneForm.name}
                                      onChange={(event) => setMilestoneForm({ ...milestoneForm, name: event.target.value })}
                                      placeholder="e.g. Foundation completed"
                                    />
                                  </label>
                                  <label>
                                    Planned end date
                                    <input
                                      required
                                      type="date"
                                      value={milestoneForm.planned_end_date}
                                      onChange={(event) => setMilestoneForm({ ...milestoneForm, planned_end_date: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Actual end date <span className="optional-label">Optional</span>
                                    <input
                                      type="date"
                                      value={milestoneForm.actual_end_date}
                                      min={undefined}
                                      onChange={(event) => setMilestoneForm({ ...milestoneForm, actual_end_date: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Planned progress (%)
                                    <input
                                      required
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={milestoneForm.planned_progress_pct}
                                      onChange={(event) => setMilestoneForm({ ...milestoneForm, planned_progress_pct: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Actual progress (%) <span className="optional-label">Optional</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={milestoneForm.actual_progress_pct}
                                      onChange={(event) => setMilestoneForm({ ...milestoneForm, actual_progress_pct: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Planned budget (₹)
                                    <input
                                      required
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={milestoneForm.planned_budget}
                                      onChange={(event) => setMilestoneForm({ ...milestoneForm, planned_budget: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Actual spending (₹) <span className="optional-label">Optional</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={milestoneForm.actual_spend}
                                      onChange={(event) => setMilestoneForm({ ...milestoneForm, actual_spend: event.target.value })}
                                    />
                                  </label>
                                </div>

                                {milestoneMessage && (
                                  <p className="status-message" role="status">{milestoneMessage}</p>
                                )}
                                <div className="form-actions">
                                  <button className="button button-primary" type="submit" disabled={milestoneSaving}>
                                    {milestoneSaving ? "Saving..." : editingMilestoneId ? "Save changes" : "Save milestone"}
                                  </button>
                                </div>
                              </form>

                              <div className="milestone-list-heading">
                                <h3>Saved milestones</h3>
                                <button className="button button-secondary" type="button" onClick={() => loadMilestones()} disabled={milestonesLoading}>
                                  {milestonesLoading ? "Refreshing..." : "Refresh milestones"}
                                </button>
                              </div>

                              {milestonesLoading ? (
                                <p className="muted">Loading milestones...</p>
                              ) : milestones.length === 0 ? (
                                <div className="empty-state">
                                  <h3>No milestones yet</h3>
                                  <p>Add the first milestone using the form above.</p>
                                </div>
                              ) : (
                                <>
                                  <div className="dashboard-statistics milestone-statistics">
                                    <article className="dashboard-stat-card">
                                      <span>Milestones</span>
                                      <strong>{milestones.length}</strong>
                                    </article>
                                    <article className="dashboard-stat-card">
                                      <span>Planned milestone budget</span>
                                      <strong>{money(milestones.reduce((sum, item) => sum + (Number(item.planned_budget) || 0), 0))}</strong>
                                    </article>
                                    <article className="dashboard-stat-card">
                                      <span>Recorded actual spending</span>
                                      <strong>{money(milestones.reduce((sum, item) => sum + (item.actual_spend == null ? 0 : Number(item.actual_spend) || 0), 0))}</strong>
                                    </article>
                                  </div>
                                  <div className="navigation-list">
                                    {milestones.map((milestone) => (
                                      <article className="navigation-list-item milestone-item" key={milestone.id}>
                                        <div>
                                          <strong>{milestone.name}</strong>
                                          <span>Planned: {milestone.planned_end_date} · Actual: {milestone.actual_end_date || "Not recorded"}</span>
                                          <span>Progress: {milestone.actual_progress_pct == null ? "Actual progress not recorded" : `${milestone.actual_progress_pct}% actual`} · {milestone.planned_progress_pct}% planned</span>
                                          <span>Budget: {money(milestone.planned_budget)} planned · {milestone.actual_spend == null ? "Actual spending not recorded" : `${money(milestone.actual_spend)} spent`}</span>
                                        </div>
                                        <button className="button button-secondary" type="button" onClick={() => startEditMilestone(milestone)}>
                                          Edit
                                        </button>
                                      </article>
                                    ))}
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {activeSection === "Budget" && (
                    <>
                      <p className="muted">Budget overview based on saved projects.</p>
                      <div className="navigation-list">
                        <article className="navigation-list-item">
                          <strong>Total project budget</strong><span>{money(totalBudget)}</span>
                        </article>
                        <article className="navigation-list-item">
                          <strong>Number of projects</strong><span>{projects.length}</span>
                        </article>
                        <article className="navigation-list-item">
                          <strong>Average budget</strong>
                          <span>{projects.length ? money(totalBudget / projects.length) : money(0)}</span>
                        </article>
                        <article className="navigation-list-item">
                          <strong>Selected project milestone budget</strong>
                          <span>{selectedScheduleProjectId ? money(milestones.reduce((sum, item) => sum + (Number(item.planned_budget) || 0), 0)) : "Select a project in Schedule"}</span>
                        </article>
                        <article className="navigation-list-item">
                          <strong>Selected project recorded spending</strong>
                          <span>{selectedScheduleProjectId ? money(milestones.reduce((sum, item) => sum + (item.actual_spend == null ? 0 : Number(item.actual_spend) || 0), 0)) : "Select a project in Schedule"}</span>
                        </article>
                      </div>
                    </>
                  )}

                  {activeSection === "Reports" && (
                    <>
                      <p className="muted">Summary report calculated from your loaded projects.</p>
                      <div className="navigation-list">
                        <article className="navigation-list-item">
                          <strong>Total projects</strong><span>{projects.length}</span>
                        </article>
                        <article className="navigation-list-item">
                          <strong>Total budget</strong><span>{money(totalBudget)}</span>
                        </article>
                        <article className="navigation-list-item">
                          <strong>Average progress</strong>
                          <span>{projects.length ? `${averageProgress}%` : "—"}</span>
                        </article>
                      </div>
                      <button className="button button-secondary" type="button" onClick={() => window.print()}>
                        Print / Save report
                      </button>
                    </>
                  )}

                  {activeSection === "Settings" && (
                    <>
                      <p className="muted">Basic workspace settings.</p>
                      <div className="navigation-list-item">
                        <strong>API backend</strong><span>{API_URL}</span>
                      </div>
                      <p className="muted">
                        Account security and profile editing are not available in this version.
                      </p>
                      <button className="button button-danger" type="button" onClick={logout}>
                        Sign out
                      </button>
                    </>
                  )}
                </>
              )}
            </section>
          )}

          {message && (
            <p className="status-message" role="status" aria-live="polite">
              {message}
            </p>
          )}

          {showProjectForm && (
            <form className="project-form" id="project-form" onSubmit={handleCreateProject}>
              <div className="form-heading">
                <div>
                  <span className="eyebrow">PROJECT DETAILS</span>
                  <h2>{projectForm.name ? "Review project details" : "Add a new project"}</h2>
                </div>
                <button
                  className="button button-quiet"
                  type="button"
                  onClick={() => setShowProjectForm(false)}
                >
                  Cancel
                </button>
              </div>

              <div className="project-form-grid">
                <label>
                  Project name
                  <input
                    required
                    maxLength={200}
                    value={projectForm.name}
                    onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
                    placeholder="e.g. Riverside Bridge"
                  />
                </label>
                <label>
                  Location <span className="optional-label">Optional</span>
                  <input
                    maxLength={200}
                    value={projectForm.location}
                    onChange={(event) => setProjectForm({ ...projectForm, location: event.target.value })}
                    placeholder="City or site location"
                  />
                </label>
                <label>
                  Budget (₹)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={projectForm.budget}
                    onChange={(event) => setProjectForm({ ...projectForm, budget: event.target.value })}
                    placeholder="2500000"
                  />
                </label>
                <label>
                  Start date
                  <input
                    required
                    type="date"
                    value={projectForm.start_date}
                    onChange={(event) => setProjectForm({ ...projectForm, start_date: event.target.value })}
                  />
                </label>
                <label>
                  Expected completion
                  <input
                    required
                    type="date"
                    min={projectForm.start_date || undefined}
                    value={projectForm.expected_end_date}
                    onChange={(event) => setProjectForm({ ...projectForm, expected_end_date: event.target.value })}
                  />
                </label>
                <label>
                  Progress (%)
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={projectForm.progress}
                    onChange={(event) => setProjectForm({ ...projectForm, progress: event.target.value })}
                  />
                </label>
              </div>

              <div className="form-actions">
                <button className="button button-primary" type="submit" disabled={projectSaving}>
                  {projectSaving ? "Saving project..." : "Save project"}
                </button>
              </div>
            </form>
          )}

          <section className="projects-section" id="projects">
            <div className="section-toolbar">
              <div>
                <h2>Your projects</h2>
                <p className="muted">Projects available to your authenticated account.</p>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => loadProjects()}
                disabled={dashboardLoading}
              >
                {dashboardLoading ? "Refreshing..." : "↻ Refresh"}
              </button>
            </div>

            <label className="project-search">
              <span>Search projects</span>
              <input
                type="search"
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder="Search by project name or location"
              />
            </label>

            {dashboardLoading ? (
              <div className="empty-state"><p>Loading projects...</p></div>
            ) : visibleProjects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <h3>{projects.length === 0 ? "No projects yet" : "No matching projects"}</h3>
                <p>
                  {projects.length === 0
                    ? "Use Add project to upload a PDF and start tracking your project."
                    : "Try another project name or location."}
                </p>
                {projects.length === 0 && (
                  <button className="button button-primary" type="button" onClick={openAddProject}>
                    + Add your first project
                  </button>
                )}
              </div>
            ) : (
              <div className="project-grid">
                {visibleProjects.map((project) => {
                  const progress = Math.min(100, Math.max(0, Number(project.progress) || 0));

                  return (
                    <article className="project-card" key={project.id}>
                      <div className="project-card-top">
                        <div className="project-icon">📁</div>
                        <span className="project-id">PROJECT #{project.id}</span>
                      </div>
                      <h3>{project.name}</h3>
                      <p className="project-location">{project.location || "Location not specified"}</p>

                      <div className="project-budget">
                        <span>Project budget</span>
                        <strong>{money(project.budget)}</strong>
                      </div>

                      <div className="project-progress-heading">
                        <span>Project progress</span><strong>{progress}%</strong>
                      </div>
                      <div
                        className="project-progress-track"
                        role="progressbar"
                        aria-label={`${project.name} progress`}
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className="project-progress-fill" style={{ width: `${progress}%` }} />
                      </div>

                      <div className="project-dates">
                        <div><span>Start date</span><strong>{project.start_date || "Not set"}</strong></div>
                        <div><span>Expected completion</span><strong>{project.expected_end_date || "Not set"}</strong></div>
                      </div>

                      <div className="project-card-actions">
                        <button className="button button-primary" type="button" onClick={() => predictProject(project.id)}>
                          Check delay risk <span aria-hidden="true">→</span>
                        </button>
                        <button
                          className="button button-danger"
                          type="button"
                          onClick={() => deleteProject(project)}
                          disabled={deletingProjectId === project.id}
                        >
                          {deletingProjectId === project.id ? "Deleting..." : "Delete project"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {selectedPrediction && (
            <section className="prediction-panel" id="predictions" aria-live="polite">
              <div className="prediction-heading">
                <div><span className="eyebrow">AI ANALYSIS</span><h2>Delay-risk prediction</h2></div>
                <button className="button button-quiet" type="button" onClick={() => setSelectedPrediction(null)}>
                  Close
                </button>
              </div>

              {selectedPrediction.loading ? (
                <p className="muted">Analyzing project...</p>
              ) : selectedPrediction.error ? (
                <p className="status-message">{selectedPrediction.error}</p>
              ) : (
                <>
                  <div className="prediction-project-title">
                    <div>
                      <h3>{selectedPrediction.project_name || "Selected project"}</h3>
                      <p className="muted">A schedule snapshot based on the project data currently recorded.</p>
                    </div>
                    <span className={`risk-pill risk-${String(selectedPrediction.risk || "unknown").toLowerCase()}`}>
                      {selectedPrediction.risk || "Risk unavailable"} risk
                    </span>
                  </div>

                  <div className="prediction-summary-grid">
                    <article className="prediction-summary-card">
                      <span>Expected progress</span>
                      <strong>{Number(selectedPrediction.expected_progress ?? 0).toFixed(1)}%</strong>
                      <small>Time-based schedule estimate</small>
                    </article>
                    <article className="prediction-summary-card">
                      <span>Actual progress</span>
                      <strong>{Number(selectedPrediction.actual_progress ?? 0).toFixed(1)}%</strong>
                      <small>Latest recorded completion</small>
                    </article>
                    <article className="prediction-summary-card">
                      <span>Schedule gap</span>
                      <strong className={Number(selectedPrediction.delay_gap || 0) > 0 ? "metric-warning" : "metric-positive"}>
                        {Number(selectedPrediction.delay_gap || 0) > 0 ? "+" : ""}{Number(selectedPrediction.delay_gap || 0).toFixed(1)} pts
                      </strong>
                      <small>{Number(selectedPrediction.delay_gap || 0) > 0 ? "Behind expected progress" : "At or ahead of schedule"}</small>
                    </article>
                    <article className="prediction-summary-card">
                      <span>Milestones assessed</span>
                      <strong>{selectedPrediction.milestone_count ?? "—"}</strong>
                      <small>{selectedPrediction.milestones_predicted_delayed ?? 0} predicted delayed</small>
                    </article>
                  </div>

                  <div className="prediction-detail-grid">
                    <section className="prediction-detail-card">
                      <h4>What this result means</h4>
                      <p>{selectedPrediction.reason || "No explanation was returned by the prediction service."}</p>
                      <div className="prediction-budget-lines">
                        <div><span>Project budget</span><strong>{money(selectedPrediction.project_budget)}</strong></div>
                        <div><span>Planned milestone budget</span><strong>{money(selectedPrediction.milestone_planned_budget)}</strong></div>
                        <div><span>Recorded milestone spend</span><strong>{money(selectedPrediction.milestone_actual_spend)}</strong></div>
                      </div>
                    </section>
                    <section className="prediction-detail-card">
                      <h4>Suggested next steps</h4>
                      {Number(selectedPrediction.delay_gap || 0) > 10 || String(selectedPrediction.risk).toLowerCase() === "high" ? (
                        <ul>
                          <li>Review delayed work packages with the site team.</li>
                          <li>Update milestone completion and actual-spend records.</li>
                          <li>Assign owners and dates to recovery actions, then reassess.</li>
                        </ul>
                      ) : Number(selectedPrediction.delay_gap || 0) > 0 || String(selectedPrediction.risk).toLowerCase() === "medium" ? (
                        <ul>
                          <li>Check upcoming milestones and any emerging blockers.</li>
                          <li>Keep actual progress and spending records current.</li>
                          <li>Re-run the prediction after the next progress update.</li>
                        </ul>
                      ) : (
                        <ul>
                          <li>Continue tracking milestone dates and actual progress.</li>
                          <li>Record costs regularly so budget comparisons stay useful.</li>
                          <li>Reassess after schedule or site conditions change.</li>
                        </ul>
                      )}
                    </section>
                  </div>

                  <details className="prediction-technical-details">
                    <summary>Technical model details</summary>
                    <div className="prediction-results">
                      <div className="prediction-result"><span>Model label</span><strong>{selectedPrediction.model_prediction_label ?? selectedPrediction.model_prediction ?? "Not provided"}</strong></div>
                      <div className="prediction-result"><span>Model score</span><strong>{selectedPrediction.model_probability == null ? "Not provided" : `${(Number(selectedPrediction.model_probability) * 100).toFixed(1)}%`}</strong></div>
                      <div className="prediction-result prediction-result-wide"><span>Model status</span><strong>{selectedPrediction.model_status || "No model status was provided."}</strong></div>
                    </div>
                    <p className="prediction-disclaimer">Important: the model score is not a validated real-world delay probability unless the model has been trained and independently evaluated on representative project data. Use it as an experimental signal alongside project records and professional judgement.</p>
                  </details>
                </>
              )}
            </section>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <a className="brand-logo" href="#login">
          <span className="brand-icon">IP</span>
          <span>InfraPredict <strong>AI</strong></span>
        </a>

        <div className="brand-content">
          <span className="eyebrow">CONSTRUCTION INTELLIGENCE</span>
          <h1>
            {isRegister ? (
              <>Your projects.<br />Your insights.<br />One platform.</>
            ) : (
              <>Build with confidence.<br />Deliver on time.</>
            )}
          </h1>
          <p>
            Intelligent construction monitoring and delay-risk insights to help
            your team make better project decisions.
          </p>
          <div className="brand-statistics">
            <div>
              <span className="stat-icon">â†—</span>
              <strong>Project insights</strong>
              <small>Track progress in one place</small>
            </div>
            <div>
              <span className="stat-icon">✓</span>
              <strong>Risk intelligence</strong>
              <small>Identify schedule risks early</small>
            </div>
          </div>
        </div>

        <p className="brand-footer">© 2026 InfraPredict AI · Construction Risk Intelligence</p>
      </section>

      <section className="login-form-panel" id="login">
        <div className="login-form-container">
          <div className="mobile-brand">
            <span className="brand-icon">IP</span>
            <span>InfraPredict <strong>AI</strong></span>
          </div>
          <div className="welcome-icon">{isRegister ? "+" : "â†—"}</div>
          <span className="form-eyebrow">{isRegister ? "GET STARTED" : "WELCOME BACK"}</span>
          <h2>{isRegister ? "Create your account" : "Sign in to your account"}</h2>
          <p className="muted">
            {isRegister
              ? "Create your account to manage construction projects and monitor risks."
              : "Enter your credentials to access your project dashboard."}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <label>
                Full name
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </label>
            )}

            <label>
              Work email
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <div className="password-label">
              <label htmlFor="password">Password</label>
              {!isRegister && (
                <button
                  className="inline-link"
                  type="button"
                  onClick={() => setMessage("Password recovery is not available yet.")}
                >
                  Forgot password?
                </button>
              )}
            </div>

            <div className="password-input">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={isRegister ? "Create a password" : "Enter your password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 8 : undefined}
                required
              />
              <button
                className="show-password"
                type="button"
                onClick={() => setShowPassword((show) => !show)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {isRegister && (
              <>
                <label>
                  Confirm password
                  <div className="password-input">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      className="show-password"
                      type="button"
                      onClick={() => setShowConfirmPassword((show) => !show)}
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <p className="helper-text">Use at least 8 characters for your password.</p>
              </>
            )}

            {!isRegister && (
              <label className="remember-option">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
            )}

            {message && (
              <p className="status-message" role="status" aria-live="polite">{message}</p>
            )}

            <button className="button button-primary auth-submit" type="submit" disabled={isLoading}>
              {isLoading ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className="auth-switch">
            <span>{isRegister ? "Already have an account?" : "New to InfraPredict AI?"}</span>
            <button
              className="inline-link"
              type="button"
              disabled={isLoading}
              onClick={() => switchPage(!isRegister)}
            >
              {isRegister ? "Sign in" : "Create account"}
            </button>
          </div>

          <div className="security-note">
            <span>📅</span> Secure access to your construction workspace
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;


