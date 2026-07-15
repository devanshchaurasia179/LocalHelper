import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  CUSTOMER: "@customer",
} as const;

/**
 * Persists the customer object to AsyncStorage so the app can show
 * a quick loading state while the /me check completes on boot.
 */
export const StorageService = {
  async saveCustomer(customer: object): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.CUSTOMER, JSON.stringify(customer));
    } catch (e) {
      console.warn("[StorageService] saveCustomer failed", e);
    }
  },

  async getCustomer<T = unknown>(): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.CUSTOMER);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (e) {
      console.warn("[StorageService] getCustomer failed", e);
      return null;
    }
  },

  async clearCustomer(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEYS.CUSTOMER);
    } catch (e) {
      console.warn("[StorageService] clearCustomer failed", e);
    }
  },
};
