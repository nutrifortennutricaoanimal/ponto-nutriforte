import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { formatarData } from "../lib/dates";

export default function Home() {
  const navigate = useNavigate();
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="page" style={{ justifyContent: "center" }}>
      <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="page-title" style={{ marginBottom: "0.25rem" }}>
          Ponto Nutriforte
        </h1>
        <p className="page-subtitle" style={{ marginBottom: "2rem" }}>
          Bata seu ponto pelo celular
        </p>

        <div className="relogio">{format(agora, "HH:mm:ss")}</div>
        <p className="page-subtitle" style={{ marginBottom: "2.5rem" }}>
          {formatarData(agora)}
        </p>

        <button type="button" className="btn btn-success" onClick={() => navigate("/ponto")}>
          Bater ponto
        </button>

        <Link to="/login" className="btn-link" style={{ marginTop: "2rem", display: "inline-block" }}>
          Admin
        </Link>
      </div>
    </div>
  );
}
