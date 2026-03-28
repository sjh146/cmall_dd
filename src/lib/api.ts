const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Product {
  id: number;
  sellerId: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  productType: 'program' | 'instruction' | 'diary';
  version?: string;
  downloadUrl?: string;
  fileSize?: string;
  licenseKey?: string;
  description: string;
  features?: string;
  systemRequirements?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: number;
  productId: number;
  product?: Product;
  quantity: number;
  sessionId?: string;
  userId?: number;
  createdAt: string;
  updatedAt: string;
}

// Session ID management
export function getSessionId(): string {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

// Token management
export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function removeToken(): void {
  localStorage.removeItem('token');
}

export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

export function setCurrentUser(user: User): void {
  localStorage.setItem('user', JSON.stringify(user));
}

export function removeCurrentUser(): void {
  localStorage.removeItem('user');
}

// Logout function
export function logout(): void {
  removeToken();
  removeCurrentUser();
}

// Auth API
export async function register(email: string, password: string, name: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }
  
  return response.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }
  
  return response.json();
}

export async function getCurrentUserFromAPI(): Promise<User> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!response.ok) {
    throw new Error('Failed to get user');
  }
  
  return response.json();
}

export async function updateUser(data: { name?: string; bio?: string; avatar?: string }): Promise<User> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update user');
  }
  
  return response.json();
}

// Products API
export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE_URL}/products`);
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  return response.json();
}

export async function searchProducts(params: { q?: string; type?: string; category?: string }): Promise<Product[]> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.append('q', params.q);
  if (params.type) searchParams.append('type', params.type);
  if (params.category) searchParams.append('category', params.category);
  
  const response = await fetch(`${API_BASE_URL}/products/search?${searchParams}`);
  if (!response.ok) {
    throw new Error('Failed to search products');
  }
  return response.json();
}

export async function fetchProduct(id: number): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/products/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch product');
  }
  return response.json();
}

// Seller Products API (requires auth)
export async function fetchMyProducts(): Promise<Product[]> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/my-products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch my products');
  }
  return response.json();
}

export async function createProduct(data: {
  name: string;
  price: number;
  productType: 'program' | 'instruction' | 'diary';
  image?: string;
  category?: string;
  description?: string;
  version?: string;
  downloadUrl?: string;
  fileSize?: string;
  features?: string;
  systemRequirements?: string;
  originalPrice?: number;
}): Promise<Product> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create product');
  }
  return response.json();
}

export async function updateProduct(id: number, data: Partial<Product>): Promise<Product> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update product');
  }
  return response.json();
}

export async function deleteProduct(id: number): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to delete product');
  }
}

// Cart API
export async function fetchCart(): Promise<CartItem[]> {
  const token = getToken();
  const sessionId = getSessionId();
  
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const url = token 
    ? `${API_BASE_URL}/cart` 
    : `${API_BASE_URL}/cart?sessionId=${sessionId}`;
  
  const response = await fetch(url, { headers });
  if (!response.ok) {
    return []; // Return empty array if cart doesn't exist
  }
  const data = await response.json();
  return data || [];
}

export async function addToCart(productId: number, quantity: number = 1): Promise<CartItem> {
  const token = getToken();
  const sessionId = getSessionId();
  
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const response = await fetch(`${API_BASE_URL}/cart`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ productId, quantity, sessionId }),
  });
  if (!response.ok) {
    throw new Error('Failed to add to cart');
  }
  return response.json();
}

export async function updateCartItem(id: number, quantity: number): Promise<CartItem> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/cart/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ quantity }),
  });
  if (!response.ok) {
    throw new Error('Failed to update cart');
  }
  return response.json();
}

export async function removeFromCart(id: number): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/cart/${id}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error('Failed to remove from cart');
  }
}

export async function mergeCart(): Promise<void> {
  const token = getToken();
  const sessionId = getSessionId();
  const response = await fetch(`${API_BASE_URL}/cart/merge?sessionId=${sessionId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to merge cart');
  }
}

// Diary API
export interface DiaryComment {
  id: number;
  diaryId: number;
  userId: number;
  userName?: string;
  content: string;
  createdAt: string;
}

export interface DiaryEntry {
  id: number;
  userId: number;
  userName?: string;
  title: string;
  content: string;
  createdAt: string;
  comments: DiaryComment[];
}

export async function fetchDiaries(): Promise<DiaryEntry[]> {
  const response = await fetch(`${API_BASE_URL}/diaries`);
  if (!response.ok) {
    throw new Error('Failed to fetch diaries');
  }
  return response.json();
}

export async function createDiary(data: { title: string; content: string }): Promise<DiaryEntry> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/diaries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create diary');
  }
  return response.json();
}

export async function deleteDiary(id: number): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/diaries`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw new Error('Failed to delete diary');
  }
}

export async function updateDiary(id: number, data: { title: string; content: string }): Promise<DiaryEntry> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/diaries/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update diary');
  }
  return response.json();
}

export async function createDiaryComment(data: { diaryId: number; content: string }): Promise<DiaryComment> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/diary-comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create comment');
  }
  return response.json();
}

export async function deleteDiaryComment(id: number): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/diary-comments`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw new Error('Failed to delete comment');
  }
}

// ===== Lecture API =====

export interface Lecture {
  id: number;
  title: string;
  description?: string;
  content?: string;
  thumbnail?: string;
  videoUrl?: string;
  duration?: string;
  instructor?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchLectures(): Promise<Lecture[]> {
  const response = await fetch(`${API_BASE_URL}/lectures`);
  if (!response.ok) {
    throw new Error('Failed to fetch lectures');
  }
  return response.json();
}

export async function fetchLecture(id: number): Promise<Lecture> {
  const response = await fetch(`${API_BASE_URL}/lectures/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch lecture');
  }
  return response.json();
}

export async function fetchAllLectures(): Promise<Lecture[]> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/admin/lectures`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch all lectures');
  }
  return response.json();
}

export async function createLecture(data: {
  title: string;
  description?: string;
  content?: string;
  thumbnail?: string;
  videoUrl?: string;
  duration?: string;
  instructor?: string;
  isPublished?: boolean;
}): Promise<Lecture> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/lectures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create lecture');
  }
  return response.json();
}

export async function updateLecture(id: number, data: Partial<{
  title: string;
  description: string;
  content: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
  instructor: string;
  isPublished: boolean;
}>): Promise<Lecture> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/lectures/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update lecture');
  }
  return response.json();
}

export async function deleteLecture(id: number): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/lectures/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to delete lecture');
  }
}

// ===== Notice API =====

export interface Notice {
  id: number;
  title: string;
  content: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchNotices(): Promise<Notice[]> {
  const response = await fetch(`${API_BASE_URL}/notices`);
  if (!response.ok) {
    throw new Error('Failed to fetch notices');
  }
  return response.json();
}

export async function fetchNotice(id: number): Promise<Notice> {
  const response = await fetch(`${API_BASE_URL}/notices/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch notice');
  }
  return response.json();
}

export async function fetchAllNotices(): Promise<Notice[]> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/admin/notices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch all notices');
  }
  return response.json();
}

export async function createNotice(data: {
  title: string;
  content: string;
  isPublished?: boolean;
}): Promise<Notice> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create notice');
  }
  return response.json();
}

export async function updateNotice(id: number, data: Partial<{
  title: string;
  content: string;
  isPublished: boolean;
}>): Promise<Notice> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/notices/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update notice');
  }
  return response.json();
}

export async function deleteNotice(id: number): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/notices/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to delete notice');
  }
}

// Set current user as admin (for testing)
export async function setUserAsAdmin(): Promise<{ message: string; email: string }> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/admin/set-admin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set admin');
  }
  return response.json();
}
