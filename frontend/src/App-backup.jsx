import { useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

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

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
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

  async function loadProjects(token) {
    setDashboardLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : `Could not load projects (${response.status})`
        );
      }

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
      const endpoint = isRegister
        ? "/api/auth/register"
        : "/api/auth/login";

      const payload = isRegister
        ? {
            full_name: fullName.trim(),
            email: email.trim(),
            password,
          }
        : { email: email.trim(), password };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Request failed. Please check your details."
        );
      }

      if (isRegister) {
        setMessage("Account created successfully! Please sign in.");
        setIsRegister(false);
        setPassword("");
        setConfirmPassword("");
      } else if (data.access_token) {
        setAccessToken(data.access_token);
        setPassword("");
        setMessage("");
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
  }

  async function predictProject(projectId) {
    setSelectedPrediction({ loading: true });

    try {
      const result = await apiRequest(
        `/api/projects/${projectId}/predict`
      );
      setSelectedPrediction({ ...result, loading: false });
    } catch (error) {
      setSelectedPrediction({
        loading: false,
        error: error.message,
      });
    }
  }

  if (accessToken) {
    return (
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div className="brand-logo">
            <div className="brand-icon">IP</div>
            <span>InfraPredict <strong>AI</strong></span>
          </div>

          <button className="text-button" onClick={logout}>
            Sign out
          </button>
        </header>

        <section className="dashboard-content">
          <span className="eyebrow">CONSTRUCTION INTELLIGENCE</span>
          <h1>Your project dashboard</h1>
          <p className="form-description">
            Monitor construction projects and check schedule delay risks.
          </p>

          <div className="dashboard-statistics">
            <article className="dashboard-stat-card">
              <span>Total projects</span>
              <strong>{projects.length}</strong>
            </article>

            <article className="dashboard-stat-card">
              <span>Average progress</span>
              <strong>
                {projects.length
                  ? `${Math.round(
                      projects.reduce(
                        (sum, project) =>
                          sum + (Number(project.progress) || 0),
                        0
                      ) / projects.length
                    )}%`
                  : "—"}
              </strong>
            </article>

            <article className="dashboard-stat-card">
              <span>Risk analysis</span>
              <strong>AI</strong>
            </article>
          </div>

          {message && (
            <p role="status" aria-live="polite" className="form-description">
              {message}
            </p>
          )}

          <div className="dashboard-section-heading">
            <div>
              <h2>Your projects</h2>
              <p className="form-description">
                Projects available to your authenticated account.
              </p>
            </div>

            <button
              className="sign-in-button"
              onClick={() => loadProjects(accessToken)}
              disabled={dashboardLoading}
            >
              {dashboardLoading ? "Loading..." : "Refresh projects"}
            </button>
          </div>

          {dashboardLoading ? (
            <p>Loading projects...</p>
          ) : projects.length === 0 ? (
            <div className="dashboard-empty-state">
              <div className="welcome-icon">↗</div>
              <h3>No projects found</h3>
              <p>
                Your API is connected, but it hasn't returned any projects.
                You can add project creation from the dashboard next.
              </p>
            </div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <article className="project-card" key={project.id}>
                  <div className="project-card-top">
                    <div className="project-icon">▦</div>
                    <span className="project-id">#{project.id}</span>
                  </div>

                  <h3>{project.name}</h3>

                  <div className="project-progress-heading">
                    <span>Project progress</span>
                    <strong>{Number(project.progress) || 0}%</strong>
                  </div>

                  <div
                    className="project-progress-track"
                    role="progressbar"
                    aria-valuenow={Math.min(
                      100,
                      Math.max(0, Number(project.progress) || 0)
                    )}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="project-progress-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, Number(project.progress) || 0)
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="project-dates">
                    <div>
                      <span>Start date</span>
                      <strong>{project.start_date || "Not set"}</strong>
                    </div>
                    <div>
                      <span>Expected completion</span>
                      <strong>
                        {project.expected_end_date || "Not set"}
                      </strong>
                    </div>
                  </div>

                  <button
                    className="sign-in-button"
                    onClick={() => predictProject(project.id)}
                  >
                    Check delay risk <span>→</span>
                  </button>
                </article>
              ))}
            </div>
          )}

          {selectedPrediction && (
            <section className="prediction-panel" aria-live="polite">
              <button
                className="text-button"
                onClick={() => setSelectedPrediction(null)}
              >
                Close
              </button>

              {selectedPrediction.loading ? (
                <p>Analyzing project...</p>
              ) : selectedPrediction.error ? (
                <p>{selectedPrediction.error}</p>
              ) : (
                <>
                  <h2>Delay-risk prediction</h2>
                  <h3>{selectedPrediction.project_name}</h3>
                  {Object.entries(selectedPrediction)
                    .filter(
                      ([key]) =>
                        !["project_id", "project_name"].includes(key)
                    )
                    .map(([key, value]) => (
                      <p key={key}>
                        <strong>
                          {key.replaceAll("_", " ")}:
                        </strong>{" "}
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </p>
                    ))}
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
        <div className="brand-logo">
          <div className="brand-icon">IP</div>
          <span>InfraPredict <strong>AI</strong></span>
        </div>

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
            Intelligent construction monitoring and delay-risk insights
            to help your team make better project decisions.
          </p>

          <div className="brand-statistics">
            <div>
              <span className="stat-icon">↗</span>
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

        <p className="brand-footer">
          © 2026 InfraPredict AI · Construction Risk Intelligence
        </p>
      </section>

      <section className="login-form-panel">
        <div className="login-form-container">
          <div className="mobile-brand">
            <div className="brand-icon">IP</div>
            <span>InfraPredict <strong>AI</strong></span>
          </div>

          <div className="welcome-icon">{isRegister ? "+" : "↗"}</div>

          <span className="form-eyebrow">
            {isRegister ? "GET STARTED" : "WELCOME BACK"}
          </span>

          <h2>
            {isRegister ? "Create your account" : "Sign in to your account"}
          </h2>

          <p className="form-description">
            {isRegister
              ? "Create your account to manage construction projects and monitor risks."
              : "Enter your credentials to access your project dashboard."}
          </p>

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </>
            )}

            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <div className="password-label">
              <label htmlFor="password">Password</label>
              {!isRegister && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    setMessage("Password recovery is not available yet.")
                  }
                >
                  Forgot password?
                </button>
              )}
            </div>

            <div className="password-input">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={
                  isRegister ? "Create a password" : "Enter your password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  isRegister ? "new-password" : "current-password"
                }
                minLength={isRegister ? 8 : undefined}
                required
              />

              <button
                className="show-password"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {isRegister && (
              <>
                <div className="password-label">
                  <label htmlFor="confirmPassword">Confirm password</label>
                </div>

                <div className="password-input">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />

                  <button
                    className="show-password"
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <p className="form-description">
                  Use at least 8 characters for your password.
                </p>
              </>
            )}

            {!isRegister && (
              <label className="remember-option">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
            )}

            {message && (
              <p className="form-description" role="status" aria-live="polite">
                {message}
              </p>
            )}

            <button
              className="sign-in-button"
              type="submit"
              disabled={isLoading}
            >
              {isLoading
                ? "Please wait..."
                : isRegister
                  ? "Create Account"
                  : "Sign in"}
              {!isLoading && <span>→</span>}
            </button>
          </form>

          <div className="auth-switch">
            <span>
              {isRegister
                ? "Already have an account?"
                : "New to InfraPredict AI?"}
            </span>

            <button
              className="text-button"
              type="button"
              disabled={isLoading}
              onClick={() => switchPage(!isRegister)}
            >
              {isRegister ? "Sign in" : "Create account"}
            </button>
          </div>

          <div className="security-note">
            <span>▣</span>
            Secure access to your construction workspace
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;