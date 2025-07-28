import React, { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import CompareResult from "./components/CompareResult";
import CompareReport from "./components/CompareReport";
import DenzitaReport from "./components/DenzitaReport";
import PantoneReport from "./components/PantoneReport";
import DashboardReport from "./components/DashboardReport";
import AppBackground from "./components/AppBackground";

// LOGIN FORM
function LoginForm({ onLogin }: { onLogin: (role: string) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "BantVegas") {
      onLogin("admin");
    } else if (username === "operator" && password === "etis1") {
      onLogin("operator");
    } else {
      setError("Nesprávne meno alebo heslo");
    }
  };

  return (
    <div className="bg-white/80 p-12 rounded-2xl shadow-lg max-w-xl w-full">
      <h1 className="text-3xl font-extrabold mb-16 text-gray-800 text-center">Scancontroll</h1>
      <p className="mb-6 text-gray-600 text-center">Prihlásenie do systému</p>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} autoComplete="off">
        <select
          className="px-4 py-2 rounded border text-gray-800 bg-white"
          value={username}
          onChange={e => {
            setUsername(e.target.value);
            setError("");
          }}
        >
          <option value="admin">admin</option>
          <option value="operator">operator</option>
        </select>
        <input
          type="password"
          placeholder="Heslo"
          className="px-4 py-2 rounded border"
          value={password}
          onChange={e => {
            setPassword(e.target.value);
            setError("");
          }}
          required
        />
        {error && (
          <div className="text-red-500 font-semibold text-center">{error}</div>
        )}
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition"
        >
          Prihlásiť sa
        </button>
      </form>
    </div>
  );
}

// OPERATOR FORM
function OperatorForm({ role }: { role: string }) {
  const [operator, setOperator] = useState(role === "admin" ? "admin" : "");
  const [zakazka, setZakazka] = useState("");
  const [produkt, setProdukt] = useState("");
  const [stroj, setStroj] = useState("");
  const [datum, setDatum] = useState("");
  const [cas, setCas] = useState("");
  const navigate = useNavigate();

  React.useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setDatum(`${yyyy}-${mm}-${dd}`);
    const hh = String(today.getHours()).padStart(2, "0");
    const min = String(today.getMinutes()).padStart(2, "0");
    setCas(`${hh}:${min}`);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { operator, zakazka, produkt, stroj, datum, cas, role };
    navigate("/compare-result", { state: data });
  };

  return (
    <form
      className="bg-white/90 rounded-2xl shadow-lg p-12 w-full max-w-lg space-y-8"
      onSubmit={handleSubmit}
      style={{ minHeight: 560 }}
    >
      <h2 className="text-3xl font-bold text-gray-800 mb-5 text-center">
        Údaje o skene
      </h2>
      <input
        type="text"
        name="operator"
        placeholder="Meno operátora"
        className="w-full border px-4 py-3 rounded text-lg"
        value={operator}
        onChange={e => setOperator(e.target.value)}
        required
        readOnly={role === "admin"}
      />
      <input
        type="text"
        name="zakazka"
        placeholder="Číslo zákazky"
        className="w-full border px-4 py-3 rounded text-lg"
        value={zakazka}
        onChange={e => setZakazka(e.target.value)}
        required
      />
      <input
        type="text"
        name="produkt"
        placeholder="Číslo produktu"
        className="w-full border px-4 py-3 rounded text-lg"
        value={produkt}
        onChange={e => setProdukt(e.target.value)}
        required
      />
      <select
        name="stroj"
        className="w-full border px-4 py-3 rounded text-lg bg-white"
        value={stroj}
        onChange={e => setStroj(e.target.value)}
        required
      >
        <option value="" disabled>
          Vyber stroj
        </option>
        <option value="Gidue">Gidue</option>
        <option value="X4">X4</option>
        <option value="X6">X6</option>
        <option value="Gallus">Gallus</option>
      </select>
      <div className="flex gap-4">
        <input
          type="date"
          name="datum"
          className="w-full border px-4 py-3 rounded text-lg"
          value={datum}
          onChange={e => setDatum(e.target.value)}
          required
        />
        <input
          type="time"
          name="cas"
          className="w-full border px-4 py-3 rounded text-lg"
          value={cas}
          onChange={e => setCas(e.target.value)}
          required
        />
      </div>
      <button
        type="submit"
        className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition text-lg"
      >
        Pokračovať
      </button>
    </form>
  );
}

// HOME-SWITCH
function HomeSwitch() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleDenzitaClick = () => {
    navigate("/denzita-report");
  };

  const handlePantoneClick = () => {
    navigate("/pantone-report");
  };

  const handleDashboardClick = () => {
    navigate("/dashboardreport");
  };

  return (
    <>
      {!loggedIn ? (
        <LoginForm
          onLogin={userRole => {
            setRole(userRole);
            setLoggedIn(true);
          }}
        />
      ) : (
        <div className="flex flex-row gap-8 items-start">
          <OperatorForm role={role!} />
          <div className="flex flex-col items-center">
            <button
              type="button"
              className="bg-green-600 text-white font-bold px-8 py-4 rounded-2xl shadow-lg mt-12 h-fit hover:bg-green-700 transition text-lg whitespace-nowrap"
              onClick={handleDenzitaClick}
            >
              Denzita
            </button>
            <button
              type="button"
              className="bg-purple-600 text-white font-bold px-8 py-4 rounded-2xl shadow-lg mt-6 h-fit hover:bg-purple-700 transition text-lg whitespace-nowrap"
              onClick={handlePantoneClick}
            >
              Pantone
            </button>
            <button
              type="button"
              className="bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl shadow-lg mt-6 h-fit hover:bg-blue-800 transition text-lg whitespace-nowrap"
              onClick={handleDashboardClick}
            >
              Dashboard
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ************ TOTO JE HLAVNÁ ZMENA ************
export default function App() {
  return (
    <AppBackground>
      <Routes>
        <Route path="/" element={<HomeSwitch />} />
        <Route path="/compare-result" element={<CompareResult />} />
        <Route path="/compare-report" element={<CompareReport />} />
        <Route path="/denzita-report" element={<DenzitaReport />} />
        <Route path="/pantone-report" element={<PantoneReport />} />
        <Route path="/dashboardreport" element={<DashboardReport />} />
        <Route path="/dashboard" element={<DashboardReport />} />
      </Routes>
    </AppBackground>
  );
}













