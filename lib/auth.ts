const API = process.env.NEXT_PUBLIC_API_BASE!;

export async function loginAdmin(email: string, password: string) {
  const res = await fetch(`${API}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error("Credenciales inválidas");
  return res.json();
}

export async function loginAdminWithGoogle(idToken: string) {
  const res = await fetch(`${API}/auth/admin/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || "No se pudo ingresar con Google");
  }
  return data;
}
