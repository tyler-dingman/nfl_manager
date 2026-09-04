import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
export type MobileCartItem = { productId: string; size: string; quantity: number };
type Value = {
  items: MobileCartItem[];
  count: number;
  add: (productId: string, size: string, quantity?: number) => void;
  update: (productId: string, size: string, quantity: number) => void;
  clear: () => void;
};
const Cart = createContext<Value | null>(null);
const KEY = 'dd-commerce-cart-v1';
export function CommerceCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<MobileCartItem[]>([]),
    [ready, setReady] = useState(false);
  useEffect(() => {
    void SecureStore.getItemAsync(KEY)
      .then((value) => {
        if (value) setItems(JSON.parse(value));
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) void SecureStore.setItemAsync(KEY, JSON.stringify(items));
  }, [items, ready]);
  const value = useMemo<Value>(
    () => ({
      items,
      count: items.reduce((n, x) => n + x.quantity, 0),
      add: (productId, size, quantity = 1) =>
        setItems((current) => {
          const found = current.find((x) => x.productId === productId && x.size === size);
          return found
            ? current.map((x) => (x === found ? { ...x, quantity: x.quantity + quantity } : x))
            : [...current, { productId, size, quantity }];
        }),
      update: (productId, size, quantity) =>
        setItems((current) =>
          quantity <= 0
            ? current.filter((x) => x.productId !== productId || x.size !== size)
            : current.map((x) =>
                x.productId === productId && x.size === size ? { ...x, quantity } : x,
              ),
        ),
      clear: () => setItems([]),
    }),
    [items],
  );
  return <Cart.Provider value={value}>{children}</Cart.Provider>;
}
export function useCommerceCart() {
  const value = useContext(Cart);
  if (!value) throw new Error('Missing CommerceCartProvider');
  return value;
}
