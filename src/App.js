import React, { useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import "./styles.css";

/**
 * CONFIG
 */
// const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";
const BACKEND = process.env.REACT_APP_BACKEND_URL || "https://securityboat-backend-3odb.onrender.com";

/**
 * Helpers
 */
function saveToken(token) {
  localStorage.setItem("token", token);
}
function getToken() {
  return localStorage.getItem("token");
}
function removeToken() {
  localStorage.removeItem("token");
}

/**
 * Layout (Header + Footer)
 */
function Layout({ children }) {
  const token = getToken();
  const navigate = useNavigate();
  function logout() {
    removeToken();
    navigate("/login");
  }
  return (
    <div>
      <header className="header">
        <div className="brand"><Link to="/">SecurityBoat</Link></div>
        <nav>
          {token ? (
            <>
              <Link to="/products">Products</Link>
              <button className="link-btn" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Signup</Link>
            </>
          )}
        </nav>
      </header>

      <main className="main">{children}</main>

      <footer className="footer">© SecurityBoat — +91 7709437063 — Pune, India</footer>
    </div>
  );
}

/**
 * Protected Route - wrapper for routes that require login
 */
function PrivateRoute({ children }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Signup component
 */
function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Signup successful. Please login.");
        nav("/login");
      } else {
        alert(data.error || "Signup failed");
      }
    } catch (err) {
      console.error(err);
      alert("Signup failed");
    }
  }

  return (
    <div className="box auth-box">
      <h2>Sign up</h2>
      <form onSubmit={handleSubmit}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
        <button>Sign up</button>
      </form>
    </div>
  );
}

/**
 * Login component
 */
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        saveToken(data.token);
        nav("/products");
      } else {
        alert(data.error || "Login failed");
      }
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  }

  return (
    <div className="box auth-box">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
        <button>Login</button>
      </form>
    </div>
  );
}

/**
 * Card component (reusable)
 */
function Card({ p, onClick }) {
  return (
    <div className="card" onClick={() => onClick && onClick(p)}>
      <img src={p.thumbnailUrl || p.url} alt={p.title} />
      <h3>{p.title}</h3>
      <p className="meta">{p.category} • ₹{p.price}</p>
    </div>
  );
}

/**
 * Filter component (reusable)
 */
function Filters({ categories, filters, setFilters, minMax }) {
  return (
    <div className="filters">
      <input
        placeholder="Search by name..."
        value={filters.search}
        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
      />

      <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
        <option value="">All Categories</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <div className="range-row">
        <input type="number" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} placeholder={`Min (${minMax.min})`} />
        <input type="number" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} placeholder={`Max (${minMax.max})`} />
      </div>

      <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
        <option value="">Sort</option>
        <option value="asc">Price: Low → High</option>
        <option value="desc">Price: High → Low</option>
      </select>
    </div>
  );
}

/**
 * ProductList page
 * - fetches from backend /api/products (which runs a GraphQL query to external API)
 * - augment items with category & price so filters have data to operate on
 */
function ProductList() {
  const [items, setItems] = useState([]); // original fetched
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", category: "", minPrice: "", maxPrice: "", sort: "" });
  const navigate = useNavigate();

  // categories used (deterministic mapping based on id)
  const categories = useMemo(() => ["Mobile", "Laptop", "Accessories", "Home", "Grocery"], []);
  // helper to create deterministic category & price for each item
  function augment(photo) {
    const id = Number(photo.id) || Math.floor(Math.random() * 1000);
    const category = categories[id % categories.length];
    // deterministic-ish price between 500 and 150000
    const price = Math.floor(((id * 97) % 149500) + 500);
    return { ...photo, category, price };
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = getToken();
        if (!token) {
          // redirect to login
          return navigate("/login");
        }
        // call convenience endpoint that runs a GraphQL photos query
        const res = await fetch(`${BACKEND}/api/products`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        // data.photos.data => array
        const arr = data?.data?.photos?.data || data?.photos?.data || [];
        // map to products
        const products = arr.map(augment);
        setItems(products);
      } catch (err) {
        console.error("fetch products error", err);
        alert("Failed to fetch products (token might be invalid). Please login again.");
        removeToken();
        navigate("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  // filter & sort
  const minMax = useMemo(() => {
    if (!items.length) return { min: 0, max: 0 };
    const prices = items.map((i) => i.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [items]);

  const filtered = useMemo(() => {
    let out = items.slice();
    if (filters.search) {
      out = out.filter((p) => p.title.toLowerCase().includes(filters.search.toLowerCase()));
    }
    if (filters.category) {
      out = out.filter((p) => p.category === filters.category);
    }
    const minP = Number(filters.minPrice) || -Infinity;
    const maxP = Number(filters.maxPrice) || Infinity;
    out = out.filter((p) => p.price >= minP && p.price <= maxP);
    if (filters.sort === "asc") out.sort((a, b) => a.price - b.price);
    if (filters.sort === "desc") out.sort((a, b) => b.price - a.price);
    return out;
  }, [items, filters]);

  if (loading) return <div className="box">Loading products...</div>;

  return (
    <div>
      <div className="controls">
        <Filters categories={categories} filters={filters} setFilters={setFilters} minMax={minMax} />
      </div>

      <div className="grid">
        {filtered.map((p) => (
          <Card
            key={p.id}
            p={p}
            onClick={() => {
              // pass product in state via URL param (simple)
              navigate(`/products/${p.id}`, { state: { product: p } });
            }}
          />
        ))}
      </div>

      {filtered.length === 0 && <div className="box">No products match the filters.</div>}
    </div>
  );
}

/**
 * Product Details page (dynamic route)
 */
function ProductDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const [product, setProduct] = useState(null);
  // If navigate passed product in state, use it. Otherwise, get from backend collection
  useEffect(() => {
    // try reading from history state
    const st = window.history.state && window.history.state.usr && window.history.state.usr.state;
    if (st && st.product && st.product.id == id) {
      setProduct(st.product);
      return;
    }
    // fallback: fetch products again and find id (cheap)
    (async () => {
      try {
        const token = getToken();
        if (!token) return nav("/login");
        const res = await fetch(`${BACKEND}/api/products`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const arr = data?.data?.photos?.data || data?.photos?.data || [];
        const categories = ["Mobile", "Laptop", "Accessories", "Home", "Grocery"];
        const found = arr.map((photo) => {
          const idn = Number(photo.id) || Math.floor(Math.random() * 10000);
          const category = categories[idn % categories.length];
          const price = Math.floor(((idn * 97) % 149500) + 500);
          return { ...photo, category, price };
        }).find((p) => String(p.id) === String(id));
        setProduct(found || null);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [id, nav]);

  if (!product) return <div className="box">Product not found or loading...</div>;

  return (
    <div className="box details-box">
      <button onClick={() => nav(-1)} className="back-btn">← Back</button>
      <div className="detail-grid">
        <img src={product.url || product.thumbnailUrl} alt={product.title} />
        <div>
          <h2>{product.title}</h2>
          <p><b>Category:</b> {product.category}</p>
          <p><b>Price:</b> ₹{product.price}</p>
          <p><b>ID:</b> {product.id}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * App root - routes
 */
function AppRoutes() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/products" element={
            <PrivateRoute>
              <ProductList />
            </PrivateRoute>
          } />
          <Route path="/products/:id" element={
            <PrivateRoute>
              <ProductDetails />
            </PrivateRoute>
          } />
        </Routes>
      </Layout>
    </Router>
  );
}

/**
 * Render
 */
// const root = createRoot(document.getElementById("root"));
// root.render(<App />);


// export default App;
export default AppRoutes;
