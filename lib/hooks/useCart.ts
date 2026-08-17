import { useCallback, useEffect, useState } from 'react';
import { cartItem } from '@/lib/storage';
import type { SelectedCourse } from '@/lib/types';

/** Live view of the course cart, kept in sync across every tab and frame. */
export function useCart() {
  const [cart, setCart] = useState<SelectedCourse[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    cartItem.getValue().then((value) => {
      if (!active) return;
      setCart(value);
      setLoaded(true);
    });
    const unwatch = cartItem.watch((value) => setCart(value ?? []));
    return () => {
      active = false;
      unwatch();
    };
  }, []);

  const add = useCallback(async (course: SelectedCourse) => {
    const current = await cartItem.getValue();
    if (current.some((c) => c.id === course.id)) return;
    await cartItem.setValue([...current, course]);
  }, []);

  const remove = useCallback(async (id: string) => {
    const current = await cartItem.getValue();
    await cartItem.setValue(current.filter((c) => c.id !== id));
  }, []);

  const clear = useCallback(async () => {
    await cartItem.setValue([]);
  }, []);

  return { cart, loaded, add, remove, clear };
}
