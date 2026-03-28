import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchCart, type CartItem as APICartItem } from '../lib/api';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const refreshCart = async () => {
    try {
      const items = await fetchCart();
      const converted = items.map((item: APICartItem) => ({
        id: String(item.id),
        productId: String(item.productId),
        name: item.product?.name || '',
        price: item.product?.price || 0,
        image: item.product?.image || '',
        quantity: item.quantity,
      }));
      setCartItems(converted);
      localStorage.setItem('cartCount', String(converted.reduce((sum, i) => sum + i.quantity, 0)));
      // Dispatch event for header to update
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: converted }));
    } catch (err) {
      console.error('Failed to refresh cart:', err);
    }
  };

  useEffect(() => {
    refreshCart();
  }, []);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, cartCount, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
