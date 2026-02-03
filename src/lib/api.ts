const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  condition: string;
  description: string;
  size?: string;
  brand?: string;
  color?: string;
  material?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: number;
  productId: number;
  product?: Product;
  quantity: number;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
}

// Generate or get session ID
export function getSessionId(): string {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

// Products API
export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE_URL}/products`);
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  return response.json();
}

// Cart API
export async function fetchCart(): Promise<CartItem[]> {
  const sessionId = getSessionId();
  const response = await fetch(`${API_BASE_URL}/cart?sessionId=${sessionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch cart');
  }
  return response.json();
}

export async function addToCart(productId: number, quantity: number = 1): Promise<CartItem> {
  const sessionId = getSessionId();
  const response = await fetch(`${API_BASE_URL}/cart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId,
      quantity,
      sessionId,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to add to cart');
  }
  return response.json();
}

export async function updateCartItem(id: number, quantity: number): Promise<CartItem> {
  const response = await fetch(`${API_BASE_URL}/cart/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ quantity }),
  });
  if (!response.ok) {
    throw new Error('Failed to update cart item');
  }
  return response.json();
}

export async function removeFromCart(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/cart/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to remove from cart');
  }
}

