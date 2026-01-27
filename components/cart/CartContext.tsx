"use client"; // Next.js directive to ensure this component is rendered on the client side only (not server-side)

import React, { 
  createContext, // Used to create a new React Context for sharing state globally
  useContext,   // Hook to consume the context value in components
  useEffect,    // Hook to run side effects (e.g. syncing with localStorage)
  useMemo,     // Hook to memoize expensive calculations or objects to optimize performance
  useReducer,  // Hook to manage complex state logic with a reducer function
  useRef      // Hook to persist mutable values across renders without triggering re-renders
} from "react";

// Represents a single item in the shopping cart with all necessary details and quantity
type CartItem = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  color?: string | null;
  size?: string | null;
  qty: number;
};

// Represents the overall state of the cart, including all items and whether the cart UI is open
type CartState = {
  items: CartItem[];
  isOpen: boolean;
};

// Defines the shape of the context value that will be provided to components consuming the cart context
// Includes cart data and functions to manipulate the cart
type CartContextValue = {
  items: CartItem[];
  isOpen: boolean;
  itemCount: number; // total quantity of all items
  subtotal: number;  // total price of all items
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
};

// Defines all possible actions that can update the cart state in the reducer
// the vertical bar means or.  the leading vertical bar is just for readability. It can be omitted.

type CartAction =
  // in the reducer, if the it says type = "INIT", it knows the items must exist.

  | { type: "INIT"; items: CartItem[] }       // Initialize cart with items (e.g. from localStorage)
  | { type: "ADD"; item: CartItem }            // Add new item or increase quantity of existing item
  | { type: "REMOVE"; id: string }             // Remove item by id
  | { type: "UPDATE_QTY"; id: string; qty: number } // Update quantity of specific item
  | { type: "CLEAR" }                           // Clear all items from cart
  | { type: "OPEN" }                            // Open the cart UI
  | { type: "CLOSE" }                           // Close the cart UI
  | { type: "TOGGLE" };                         // Toggle cart UI open/closed

// Create the cart context with initial value null.
// Null indicates no default context value and helps detect usage outside provider.
// using createContext, React automatically gives you two components:
// CartContext.Provider and CartContext.Consumer.

const CartContext = createContext<CartContextValue | null>(null);

// Key used to store cart items in localStorage as a JSON string
const STORAGE_KEY = "cart";

// a reducer is single place that decides
// “Given the current cart state and an action, what should the next state be?”
// used for updating the state when various actions on the cart is taken.
// dispatch({ type: "ADD", item }),the object parameter is the action

function cartReducer(state: CartState, action: CartAction): CartState {
  // Reducer function updates cart state based on action type and payload
  switch (action.type) {
    case "INIT":
      // Replace current items with those loaded from storage or elsewhere
      return { ...state, items: action.items };
    case "ADD": {
      // If item already exists, merge by increasing quantity instead of duplicating
      // i is just one item in the array items. If the condition is true, that item will be returned.
      // existing will be CartItem or undefined.
      const existing = state.items.find((i) => i.id === action.item.id); 

      if (existing) {
        // loop through all item in current state
        // if the item.id = existing
        // we increase the quantity of the found item.
        const nextItems = state.items.map((i) =>
          i.id === action.item.id ? { ...i, qty: i.qty + action.item.qty } : i
        );
        return { ...state, items: nextItems };
      }

      // Add new item to cart if it doesn't exist yet
      return { ...state, items: [...state.items, action.item] };
    }
    case "REMOVE":
      // Remove item matching given id
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "UPDATE_QTY": {
      // Ensure quantity is at least 1 to prevent invalid zero or negative quantities
      const qty = Math.max(1, action.qty);
      // { ...i, qty } = {{ ...i, qty : qty }}
      // create an new array of items, so the items state can be updated correctly. in-place change doesn't work.

      const nextItems = state.items.map((i) => (i.id === action.id ? { ...i, qty } : i));
      return { ...state, items: nextItems };
    }
    case "CLEAR":
      // Remove all items from cart
      return { ...state, items: [] };
    case "OPEN":
      // Set cart UI to open
      return { ...state, isOpen: true };
    case "CLOSE":
      // Set cart UI to closed
      return { ...state, isOpen: false };
    case "TOGGLE":
      // Toggle cart UI open/closed state
      return { ...state, isOpen: !state.isOpen };
    default:
      return state;
  }
}

// get children field from props.
// the props must contain a field called children
// the following usage will allow all children to access the CartContext.
// CartContext.Provider is different from the following custom CartProvider. 
// CartContext.Provider is provided by React when we created the CartContext.
// <CartContext.Provider value={value}>
//   {children}
// </CartContext.Provider>


export function CartProvider({ children }: { children: React.ReactNode }) {
  // children represents nested components that will have access to the cart context
  // <CartProvider>
  //   <Header />
  //   <ProductsPage />
  // </CartProvider>

  // useReducer is preferred here over multiple useState calls because cart state is complex and involves multiple related values and actions
  
  // “Create a state object called state, and a function called dispatch that can update that state using cartReducer.”
  // cartReducer is the “rules” function, “When we want to update the cart, use cartReducer to decide the next state.”
  // { items: [], isOpen: false } is used for initializing the state. This object has the same shape as our CartState.
  // CartState is just a TS type, not a state in memory.

  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false });

  // useRef is used to track if the initialization from localStorage has already run
  // This avoids double initialization caused by React Strict Mode in development which invokes effects twice
  // useRef(false) creates an object like this:
  // didInit = { current: false }
  const didInit = useRef(false);

  // Initialize cart items from localStorage on first render only
  useEffect(() => {
    //if current is true, do nothing
    if (didInit.current) return; // Prevent double init in React Strict Mode during development
    
    didInit.current = true;
    // do the initialization
    try {
      // raw is null or an object.

      const raw = window.localStorage.getItem(STORAGE_KEY);
      // if raw is null
      // do nothing
      if (!raw) return;
      // if raw is not null
      // converts a JSON string into the corresponding JavaScript object.

      const parsed = JSON.parse(raw);
      
      // Verify parsed data is an array before initializing cart items
      if (Array.isArray(parsed)) {
        dispatch({ type: "INIT", items: parsed });
      }
    } catch {
      // Ignore JSON parsing or storage errors and fallback to empty cart
    }
  }, []);

  // Persist cart items to localStorage whenever the items array changes
  // Dependency on state.items ensures this effect runs only when cart content changes, not UI open state
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Ignore storage errors (e.g. quota exceeded)
    }
  }, [state.items]);

  // Memoize the context value to avoid unnecessary re-renders in consuming components
  // itemCount and subtotal are derived values calculated from current cart items
  // Functions dispatch actions to update state, keeping state logic centralized in reducer

  // explanation about the signature.
  // T is the return type.
  //   useMemo<T>(
  //   factory: () => T, factory is a function that computes a value.
  //   deps: DependencyList
  // ): T

  // <CartContextValue> is the return type of useMemo
  const value = useMemo<CartContextValue>(() => {
    //  useMemo caches the result of the function

    // just concise why of looping through the items in the array and accumlate a sum.
    const itemCount = state.items.reduce((sum, item) => sum + item.qty, 0); // 0 the initial value of sum, the running total.
    const subtotal = state.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    // the following is CartContextValue type
    return {
      items: state.items,
      isOpen: state.isOpen,
      itemCount,
      subtotal,
      // the reducer will receive all the actions.
      // dispatch({ type: "ADD", item }) the object parameter is the action

      addItem: (item) => dispatch({ type: "ADD", item }),
      removeItem: (id) => dispatch({ type: "REMOVE", id }),
      updateQty: (id, qty) => dispatch({ type: "UPDATE_QTY", id, qty }),
      clearCart: () => dispatch({ type: "CLEAR" }),
      openCart: () => dispatch({ type: "OPEN" }),
      closeCart: () => dispatch({ type: "CLOSE" }),
      toggleCart: () => dispatch({ type: "TOGGLE" }),
    };
    // only recompute if the the following two changed.
  }, [state.items, state.isOpen]);

  //It wraps all child components with a Cart Context, so they can read and modify the cart state using useCart().
  // value is the value returned my useMemo
  // When the value prop of a Context Provider changes (by reference),
  //all components that consume that context will re-render.
  // Components that call useCart() → re-render
	// Components that do NOT use the context → do NOT re-render because of context
  // if a component in Provider doesn't subscribe to context, it will not be re-rendered.
  // value is a prop passed to CartContext.Provider

  // in my layout file, many children were wrapped into the provider.

          // <Providers>
          //   <Header />
          //   {children}
          //   <Footer />
          //   <CartDrawer />
          // </Providers>

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Custom hook to consume cart context easily in components
// Throws an error if used outside CartProvider to help catch bugs early and ensure context is available




export function useCart() {
  //“Give me the current value provided by the nearest <CartContext.Provider> above me in the component tree.”
  // const CartContext = createContext<CartContextValue | null>(null);
  // So before a Provider exists, useContext(CartContext) returns null.
  // If a component wrapped in <CartContext.Provider> calls useCart(), react will look for such a wrapper. 
  // when found, will return the value = {value} of the Provider.
  
  const ctx = useContext(CartContext);// ctx = CartContextValue

  // The component calling useCart() is NOT wrapped inside <CartProvider> in the React component tree.

  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export type { CartItem };
