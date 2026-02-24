const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('phork_token');
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Request failed: ${res.status}`);
    }
    return data;
  }

  get(path: string) { return this.request('GET', path); }
  post(path: string, body: any) { return this.request('POST', path, body); }
  put(path: string, body: any) { return this.request('PUT', path, body); }
  delete(path: string) { return this.request('DELETE', path); }
}

export const api = new ApiClient();
