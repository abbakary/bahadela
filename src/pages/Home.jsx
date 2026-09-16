import { Link } from "react-router-dom";

export default function Home() {
  return (
    <section className="hero">
      <img className="hero-logo" src="/BAHDELA-logo.png" alt="Bahdela" />
      <h1>Bahdela</h1>
      <p>
        Fast registration and attendance for Hikvision terminals — manage users,
        capture biometrics, and generate site reports from any phone or desktop.
      </p>
      <div className="cta-row">
        <Link className="btn btn-primary" to="/register">
          Register employee
        </Link>
        <Link className="btn btn-secondary" to="/users">
          Manage users
        </Link>
        <Link className="btn btn-secondary" to="/reports">
          Attendance reports
        </Link>
        <Link className="btn btn-ghost" to="/device">
          Connect device IP
        </Link>
      </div>
      <p className="home-install-hint mobile-only">
        On your phone, tap <strong>Install</strong> to add Bahdela to your home screen with the
        Bahdela logo.
      </p>
    </section>
  );
}
